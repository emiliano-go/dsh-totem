/**
 * Secondary-model memory distillation for Totem.
 *
 * The file tools are not allowed to author memory prose themselves; this
 * module turns the observed change (tool, path, before/after, symbol) into a
 * compact durable memory using a separately configured model. Every failure
 * returns `undefined` so the caller falls back to a deterministic draft.
 *
 * @module dsh-totem/distill
 */
import type { Context } from '@deepseek-ai/cordis'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm/types' {
  interface LlmRequestPurposeMap {
    'totem-memory': true
    'totem-compact': true
  }
}

/** One changed symbol reported by the memory model. */
export interface Signature {
  name: string
  kind: string
  signature: string
  statement?: string
  startLine?: number
  endLine?: number
}

/** The durable fields the secondary model may write. */
export interface MemoryDraft {
  title?: string
  statement?: string
  reason?: string
  details?: string
  tags?: string[]
  signatures?: Signature[]
}

/** Everything the memory model needs to describe one file touch. */
export interface DistillInput {
  tool: 'read' | 'write' | 'edit' | 'apply_patch'
  action: 'read' | 'write' | 'edit' | 'patch'
  path: string
  symbol?: string
  before?: string | null
  after?: string | null
  startLine?: number
  endLine?: number
}

/** Resolved secondary-model route. */
export interface DistillTarget {
  provider: string
  model: string
  maxTokens: number
  maxInputBytes: number
  timeoutMs: number
}

const SYSTEM = `You write durable engineering memory for a coding agent.
Given one file touch, return a compact JSON object describing what the code now does and why it changed.
Rules:
- "title": short noun phrase, max 80 characters.
- "statement": one factual sentence about the file or symbol after the change.
- "reason": one sentence for why the change was made (writes/edits only).
- "details": optional extra facts, max 400 characters.
- "tags": 1-4 lowercase kebab-case tags.
- "signatures": for each changed function/type/variable, {name, kind, signature, statement}.
  kind is one of api, function, type, config, schema, variable.
  signature is the declaration line.
Return ONLY the JSON object, no markdown or prose.`

/** Truncate by UTF-8 bytes without splitting a code point. */
function clip(text: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(text)
  if (encoded.length <= maxBytes) return text
  return new TextDecoder().decode(encoded.slice(0, maxBytes)) + '\n[...truncated]'
}

function frame(input: DistillInput, maxBytes: number): string {
  const payload: Record<string, unknown> = {
    tool: input.tool,
    action: input.action,
    path: input.path,
    ...input.symbol === undefined ? {} : { symbol: input.symbol },
    ...input.startLine === undefined ? {} : { startLine: input.startLine },
    ...input.endLine === undefined ? {} : { endLine: input.endLine },
    ...input.before === undefined || input.before === null ? {} : { before: clip(input.before, Math.floor(maxBytes / 2)) },
    ...input.after === undefined || input.after === null ? {} : { after: clip(input.after, Math.floor(maxBytes / 2)) },
  }
  return `Describe this file touch as memory JSON:\n${JSON.stringify(payload)}`
}

function parseDraft(text: string): MemoryDraft | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    if (typeof value !== 'object' || value === null) return undefined
    const draft: MemoryDraft = {}
    if (typeof value.title === 'string' && value.title.trim()) draft.title = value.title.trim().slice(0, 200)
    if (typeof value.statement === 'string' && value.statement.trim()) draft.statement = value.statement.trim().slice(0, 800)
    if (typeof value.reason === 'string' && value.reason.trim()) draft.reason = value.reason.trim().slice(0, 400)
    if (typeof value.details === 'string' && value.details.trim()) draft.details = value.details.trim().slice(0, 2000)
    if (Array.isArray(value.tags)) {
      draft.tags = value.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'))
        .filter(Boolean)
        .slice(0, 6)
    }
    if (Array.isArray(value.signatures)) {
      draft.signatures = value.signatures
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .flatMap((item) => {
          if (typeof item.name !== 'string' || typeof item.signature !== 'string') return []
          return [{
            name: item.name.slice(0, 200),
            kind: typeof item.kind === 'string' ? item.kind : 'function',
            signature: item.signature.slice(0, 400),
            ...typeof item.statement === 'string' ? { statement: item.statement.slice(0, 400) } : {},
            ...typeof item.startLine === 'number' ? { startLine: item.startLine } : {},
            ...typeof item.endLine === 'number' ? { endLine: item.endLine } : {},
          }]
        })
        .slice(0, 12)
    }
    return draft.statement === undefined && draft.signatures === undefined ? undefined : draft
  } catch {
    return undefined
  }
}

/**
 * Run one one-shot memory distillation call.
 * @returns the parsed draft, or `undefined` on any transport/model/parse failure.
 */
export async function distillMemory(
  ctx: Context,
  target: DistillTarget,
  input: DistillInput,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<MemoryDraft | undefined> {
  const deadline = AbortSignal.timeout(target.timeoutMs)
  const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline])
  try {
    const assembler = new BlockAssembler()
    const options = {
      provider: target.provider,
      model: target.model,
      system: SYSTEM,
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: frame(input, target.maxInputBytes) }] }],
      maxTokens: target.maxTokens,
      purpose: 'totem-memory' as const,
      ...sessionId === undefined ? {} : { sessionId },
      signal: combined,
    }
    for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
    const text = assembler.blocks()
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('')
    return parseDraft(text)
  } catch {
    return undefined
  }
}

/** A caller-authored memory draft to rewrite. */
export interface AuthoredDraft {
  type: string
  title?: string
  statement: string
  details?: string
  tags: string[]
}

const AUTHORED_SYSTEM = `You rewrite an engineering memory for a coding agent.
Return a compact JSON object with keys: title, statement, details, tags.
- title: short noun phrase, max 80 characters.
- statement: one factual sentence stating the claim.
- details: optional extra facts, max 400 characters.
- tags: 1-4 lowercase kebab-case tags.
Preserve the author's meaning; do not add facts that are not implied.
Return ONLY the JSON object.`

/** Rewrite an explicitly authored memory draft with the secondary model. */
export async function distillAuthored(
  ctx: Context,
  target: DistillTarget,
  draft: AuthoredDraft,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<MemoryDraft | undefined> {
  const deadline = AbortSignal.timeout(target.timeoutMs)
  const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline])
  try {
    const assembler = new BlockAssembler()
    const options = {
      provider: target.provider,
      model: target.model,
      system: AUTHORED_SYSTEM,
      messages: [{
        role: 'user' as const,
        content: [{ type: 'text' as const, text: `Rewrite this memory:\n${JSON.stringify(draft)}` }],
      }],
      maxTokens: target.maxTokens,
      purpose: 'totem-memory' as const,
      ...sessionId === undefined ? {} : { sessionId },
      signal: combined,
    }
    for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
    const text = assembler.blocks()
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('')
    return parseDraft(text)
  } catch {
    return undefined
  }
}

/** Evidence for one session summary. */
export interface SessionSummaryInput {
  project: string
  assistantText: string
  files: string[]
  tools: string[]
}

const SESSION_SYSTEM = `You summarize one completed work session for a coding agent.
Return one or two plain-text sentences describing what changed and why.
- Focus on the resulting behavior and the reason for it.
- Mention the most important files only when they aid recall.
- Do not list every edit, do not use markdown, and do not invent facts.
Return an empty string when the session produced no durable change.`

/** Summarize a session's changes in one or two sentences. */
export async function distillSession(
  ctx: Context,
  target: DistillTarget,
  input: SessionSummaryInput,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<string | undefined> {
  const payload = JSON.stringify({
    project: input.project,
    assistantText: input.assistantText.slice(0, 12000),
    files: input.files.slice(0, 80),
    tools: input.tools.slice(0, 20),
  })
  const text = await runOneShot(ctx, target, SESSION_SYSTEM, payload, signal, sessionId)
  if (text === undefined) return undefined
  const clean = text.trim().replace(/\s+/gu, ' ').slice(0, 800)
  return clean.length === 0 ? undefined : clean
}

/**
 * Run one generic auxiliary model call.
 * @returns the assembled text, or `undefined` on any transport/model failure.
 */
export async function runOneShot(
  ctx: Context,
  target: DistillTarget,
  system: string,
  input: string,
  signal?: AbortSignal,
  sessionId?: string,
  purpose: 'totem-memory' | 'totem-title' | 'totem-compact' = 'totem-memory',
): Promise<string | undefined> {
  const deadline = AbortSignal.timeout(target.timeoutMs)
  const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline])
  try {
    const assembler = new BlockAssembler()
    const options = {
      provider: target.provider,
      model: target.model,
      system,
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: input }] }],
      maxTokens: target.maxTokens,
      purpose,
      ...sessionId === undefined ? {} : { sessionId },
      signal: combined,
    }
    for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
    return assembler.blocks()
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join('')
  } catch {
    return undefined
  }
}
