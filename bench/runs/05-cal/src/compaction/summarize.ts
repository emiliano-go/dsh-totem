/**
 * Memory-agent summarization for native compaction.
 *
 * `BasicCompactionEngine` owns the hard part: selecting a balanced range,
 * taking the durable lock, replacing it, and releasing the lock. This module
 * only turns the selected messages into the prose a compact needs. The model
 * is the same separately configured one used by the rest of Totem, so a
 * compaction costs a bounded auxiliary call rather than the main model.
 *
 * @module dsh-totem/compaction/summarize
 */
import type { Context } from '@deepseek-ai/cordis'
import { runOneShot, type DistillTarget } from '../distill.ts'

/** The part of `SummarizationInput` this module reads. */
export interface CompactionInput {
  messages: readonly unknown[]
  tools?: readonly unknown[]
}

/** A test seam for the one-shot model call. */
export type CompactRunner = (
  ctx: Context,
  target: DistillTarget,
  system: string,
  input: string,
  signal: AbortSignal | undefined,
  sessionId: string | undefined,
  purpose: 'totem-compact',
) => Promise<string | undefined>

const SYSTEM = `You compress an engineering conversation for a coding agent that must continue the work after the older messages are removed.

Write one plain-text compact. Preserve, in this order:
1. The user's goal and every explicit constraint.
2. Decisions and why they were made.
3. Exact file paths, symbol names, commands, errors, versions, and values.
4. What was completed, what was verified, and what remains open.
5. Failed attempts and the lesson that makes them worth not repeating.

Omit greetings, restating the prompt, and generic advice. Do not invent facts. Do not use code fences or a preamble. Keep it dense and under 1,200 words.`

function blockText(block: unknown): string {
  if (typeof block !== 'object' || block === null) return ''
  const record = block as Record<string, unknown>
  switch (record.type) {
    case 'text':
      return typeof record.text === 'string' ? record.text : ''
    case 'tool-call':
      return `Tool call ${String(record.name ?? 'unknown')}(${typeof record.arguments === 'string' ? record.arguments : JSON.stringify(record.arguments ?? {})})`
    case 'tool-result': {
      const content = Array.isArray(record.content)
        ? record.content.map(blockText).filter(Boolean).join('\n')
        : typeof record.content === 'string' ? record.content : ''
      return `Tool result:\n${content}`
    }
    case 'reasoning':
      return ''
    default:
      return ''
  }
}

function messageText(message: unknown): string {
  if (typeof message !== 'object' || message === null) return ''
  const record = message as Record<string, unknown>
  const role = typeof record.role === 'string' ? record.role : 'unknown'
  const content = Array.isArray(record.content)
    ? record.content.map(blockText).filter(Boolean).join('\n')
    : typeof record.content === 'string' ? record.content : ''
  if (content.trim().length === 0) return ''
  return `${role.toUpperCase()}:\n${content}`
}

/** Render the selected messages into a bounded, readable transcript. */
export function renderCompactionInput(input: CompactionInput, maxBytes: number): string {
  const tools = (input.tools ?? [])
    .map((tool) => {
      const record = tool as { name?: unknown }
      return typeof record.name === 'string' ? record.name : ''
    })
    .filter(Boolean)
  const header = tools.length === 0 ? '' : `Available tools: ${tools.join(', ')}\n\n`
  const body = input.messages.map(messageText).filter(Boolean).join('\n\n')
  const text = `${header}${body}`
  const limit = Math.max(1024, Math.floor(maxBytes))
  if (Buffer.byteLength(text, 'utf8') <= limit) return text
  return `${Buffer.from(text, 'utf8').subarray(0, limit).toString('utf8')}\n\n[transcript truncated at ${limit} bytes]`
}

/**
 * Ask the Totem memory agent for one compact.
 * @returns summary text, or `undefined` when there is no target or no output.
 */
export async function summarizeWithTotem(
  ctx: Context,
  target: DistillTarget | undefined,
  input: CompactionInput,
  signal?: AbortSignal,
  sessionId?: string,
  runner: CompactRunner = runOneShot,
): Promise<string | undefined> {
  if (target === undefined) return undefined
  const transcript = renderCompactionInput(input, target.maxInputBytes)
  if (transcript.trim().length === 0) return undefined
  const text = await runner(ctx, target, SYSTEM, transcript, signal, sessionId, 'totem-compact')
  const cleaned = text?.trim()
  return cleaned === undefined || cleaned.length === 0 ? undefined : cleaned
}
