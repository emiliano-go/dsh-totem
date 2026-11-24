/**
 * Session titles and hover TLDRs.
 *
 * The base harness titles a session once, from its first human message. This
 * module replaces that provider with one that keeps refining the title through
 * the first five human turns, then settles. A manual rename still wins: the
 * title service pins `source.kind === 'user'` and stops scheduling automatic
 * work, and this provider re-checks that before writing.
 *
 * The same cheap model also writes a two-sentence TLDR of the last three
 * completed turns. The browser half reads it back from the hover card slot, so
 * the card never waits on a model.
 *
 * @module dsh-totem/titles
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import {
  SessionTitleProviderId,
  fallbackSessionTitle,
  normalizeSessionTitle,
  type SessionTitleProviderRequest,
  type SessionTitleProviderResult,
  type SessionTitleSnapshot,
  type SessionTitleUserMessage,
} from '@deepseek-ai/dsh-session-title'
import { executeSessionTitleLlm } from '@deepseek-ai/dsh-session-title-llm'
import { JsonStore, statePath } from './store.ts'
import { runOneShot, type DistillTarget } from './distill.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface LlmRequestPurposeMap {
    'totem-title': true
  }
}

/** Human messages that may shape a title before it settles. */
export const TITLE_TURNS = 5

/** Completed turns a hover TLDR summarizes. */
export const TLDR_TURNS = 3

/** Delay after the last turn before the TLDR is regenerated. */
const TLDR_DEBOUNCE_MS = 15_000

/** Longest TLDR kept from one model response. */
const TLDR_MAX_CHARS = 240

/** Title request bounds. */
const TITLE_MAX_INPUT_BYTES = 8_192
// Reasoning a model cannot switch off counts as output too, so this is a
// ceiling against runaway output, not a length target (the prompt keeps the
// title short). A tiny cap truncates the title on reasoning models.
const TITLE_MAX_OUTPUT_TOKENS = 4_096
const TITLE_TIMEOUT_MS = 20_000

/** TLDR request bounds. */
const TLDR_MAX_INPUT_BYTES = 12_000
const TLDR_MAX_OUTPUT_TOKENS = 2_048
const TLDR_TIMEOUT_MS = 20_000

/** One completed turn as the TLDR model sees it. */
export interface TurnDigest {
  user: string
  assistant: string
  files: string[]
}

/** Stored hover summary for one session. */
export interface TldrRecord {
  tldr: string
  /** Epoch milliseconds of the generation. */
  updatedAt: number
}

interface TldrDocument {
  version: 1
  entries: Record<string, TldrRecord>
}

const TLDR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const TLDR_MAX_ENTRIES = 500

const EMPTY_TLDR: TldrDocument = { version: 1, entries: {} }

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
}

/** Shared host-side store for hover summaries. */
export class TldrStore {
  private readonly store: JsonStore<TldrDocument>

  constructor(path = statePath('session-tldr.json')) {
    this.store = new JsonStore<TldrDocument>(path, EMPTY_TLDR)
  }

  /** Summary for one session, or undefined when none is stored. */
  async get(sessionId: string): Promise<TldrRecord | undefined> {
    if (!validId(sessionId)) return undefined
    const record = (await this.store.read()).entries[sessionId]
    return record === undefined ? undefined : record
  }

  /** Store one summary and prune the document. */
  async put(sessionId: string, record: TldrRecord): Promise<void> {
    if (!validId(sessionId) || record.tldr.trim().length === 0) return
    await this.store.update((current) => {
      const cutoff = Date.now() - TLDR_MAX_AGE_MS
      const entries = Object.entries({ ...current.entries, [sessionId]: record })
        .filter(([id, item]) => validId(id) && Number.isFinite(item.updatedAt) && item.updatedAt >= cutoff)
        .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
        .slice(0, TLDR_MAX_ENTRIES)
      return { version: 1, entries: Object.fromEntries(entries) }
    })
  }
}

/** Join the text blocks of one message payload. */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content.flatMap((block) => {
    if (typeof block !== 'object' || block === null) return []
    const record = block as { type?: unknown; text?: unknown }
    return record.type === 'text' && typeof record.text === 'string' ? [record.text] : []
  }).join('\n')
}

/**
 * Fold the last completed turns out of a session log.
 * @param events - live or replayed session events.
 * @param limit - turns to keep, newest last.
 * @returns compact digests, oldest first.
 */
export function recentTurns(events: readonly SessionEvent[], limit = TLDR_TURNS): TurnDigest[] {
  const turns: TurnDigest[] = []
  let current: TurnDigest | undefined
  const push = (): void => {
    if (current === undefined) return
    if (current.user.trim().length > 0 || current.assistant.trim().length > 0) turns.push(current)
    current = undefined
  }
  for (const event of events) {
    if (event.type === 'user/message') {
      const data = event.data as {
        message?: { content?: unknown; source?: { kind?: unknown } }
        content?: unknown
        source?: { kind?: unknown }
      }
      const message = data.message ?? data
      if (message.source?.kind !== 'user') continue
      push()
      current = { user: textOf(message.content), assistant: '', files: [] }
    } else if (event.type === 'assistant/message' && current !== undefined) {
      const message = (event.data as { message?: { content?: unknown } }).message
      current.assistant += textOf(message?.content)
    } else if (event.type === 'tool/result' && current !== undefined) {
      const path = (event.data as { meta?: { path?: unknown } }).meta?.path
      if (typeof path === 'string' && path.length > 0 && !current.files.includes(path)) {
        current.files.push(path)
      }
    }
  }
  push()
  return turns.slice(-Math.max(1, limit))
}

/** Cap one digest section without splitting a code point. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/gu, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`
}

/** Build the bounded model input for one TLDR request. */
export function tldrInput(turns: readonly TurnDigest[]): string {
  return JSON.stringify({
    turns: turns.map(turn => ({
      user: clip(turn.user, 600),
      assistant: clip(turn.assistant, 900),
      files: turn.files.slice(0, 8),
    })),
  })
}

/** System instruction for the hover summary. */
const TLDR_SYSTEM = [
  'Summarize the last few turns of an AI coding-assistant session for a hover card.',
  'Return only one or two plain sentences, at most 220 characters, with no quotes, prefix, label, Markdown, or code.',
  'Say what the user asked for and the concrete outcome. Prefer specific artifacts, files, or features over process narration.',
  'Use the language of the conversation. Never start with "The user" when a direct verb phrase is shorter.',
].join('\n')

/** Take one clean line out of the model response. */
export function tldrFromOutput(text: string): string | undefined {
  const line = text
    .split(/\r?\n/u)
    .map(item => item.trim())
    .find(item => item.length > 0)
  if (line === undefined) return undefined
  const clean = line
    .replace(/^title\s*:\s*/iu, '')
    .replace(/^tldr\s*:\s*/iu, '')
    .replace(/^["'`*_]+|["'`*_]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  if (clean.length === 0) return undefined
  return clean.length <= TLDR_MAX_CHARS ? clean : `${clean.slice(0, TLDR_MAX_CHARS - 1).trimEnd()}…`
}

/** Asterisk emphasis wrapping a whole line, such as `**Title**`. */
const EMPHASIS_WRAPPER = /^(?<marker>\*{1,3})(?<inner>\S(?:.*\S)?)\k<marker>$/u

/** Take the title from model output: first non-empty line, without wrapping emphasis. */
export function titleFromOutput(text: string): string {
  const line = text.split(/\r?\n/u).map(item => item.trim()).find(item => item.length > 0) ?? ''
  const groups = EMPHASIS_WRAPPER.exec(line)?.groups
  const marker = groups?.marker
  const inner = groups?.inner
  return marker === undefined || inner === undefined || inner.includes(marker) ? line : inner
}

/** Read one non-empty title out of an assembled title response. */
function titleFromResponse(response: {
  finish: { kind: string }
  blocks: readonly { type: string; text?: string }[]
}): string {
  if (response.finish.kind === 'tool-calls') throw new Error('totem-titles: title output must contain text only')
  if (response.finish.kind === 'max-tokens') throw new Error('totem-titles: title output reached its token cap')
  if (response.blocks.some(block => block.type === 'tool-call')) throw new Error('totem-titles: title output must contain text only')
  const title = normalizeSessionTitle(
    titleFromOutput(response.blocks.filter(block => block.type === 'text').map(block => block.text ?? '').join(' ')),
    Number.MAX_SAFE_INTEGER,
  )
  if (title.length === 0) throw new Error('totem-titles: title model produced no text')
  return title
}

/** System instruction for one title revision. */
function titleSystem(anchored: boolean): string {
  return [
    'Create a concise title for an AI coding-assistant session from the supplied human messages.',
    'Return only the title on one line, in plain text of natural language, with no quotes, prefix, explanation, Markdown, or terminal control codes. No code is allowed.',
    'Use the language of the messages.',
    'Aim for about 5 words in non-CJK languages or 10 CJK characters.',
    'The title is provisional while the task is still taking shape: rebuild it when the latest messages make the task clearer or broader.',
    'If the messages give little to name, still return a short best-effort title, such as Greeting, instead of explaining.',
    ...anchored
      ? [
          'An existing title is supplied as currentTitle. Keep it exactly when it still names the main task.',
          'Refine it only when the newer messages materially clarify or change the main task; do not reword for style.',
        ]
      : [],
  ].join('\n')
}

/** Frame the window as JSON so message text cannot break delimiters. */
function frameMessages(messages: readonly { text: string }[], currentTitle: string | undefined): string {
  return currentTitle === undefined
    ? `Generate the session title from this JSON array of human messages:\n${JSON.stringify(messages.map(message => message.text))}`
    : `Update the session title from this JSON object:\n${JSON.stringify({
        currentTitle,
        messages: messages.map(message => message.text),
      })}`
}

/** Resolved title model route and generation policy. */
export interface TitlesConfig {
  /** Explicit provider route; empty uses the main request route. */
  provider: string
  /** Explicit model id; empty uses the main request route. */
  model: string
  /** Whether hover summaries are generated. */
  tldr: boolean
}

/** What one title revision should do. */
export type TitleDecision =
  | { mode: 'manual'; title: string }
  | { mode: 'settled'; title: string }
  | { mode: 'generate'; window: readonly SessionTitleUserMessage[]; anchor?: string }

/**
 * Decide whether one revision may rewrite the title.
 * @param messages - every eligible human message, oldest first.
 * @param current - latest accepted title, when one exists.
 * @returns a manual or settled hold, or the window to send to the model.
 */
export function titleDecision(
  messages: readonly SessionTitleUserMessage[],
  current: SessionTitleSnapshot | undefined,
): TitleDecision {
  if (current?.source.kind === 'user') return { mode: 'manual', title: current.title }
  if (messages.length > TITLE_TURNS && current?.source.kind === 'provider') {
    return { mode: 'settled', title: current.title }
  }
  const window = messages.slice(0, TITLE_TURNS)
  return {
    mode: 'generate',
    window,
    ...current?.source.kind === 'provider' ? { anchor: current.title } : {},
  }
}

/** Collaborators the title service needs from the plugin. */
export interface TitlesHost {
  /** Resolve the cheap auxiliary route for TLDR generation. */
  titleTarget: () => DistillTarget | undefined
}

/**
 * Session-title provider plus hover TLDR generation.
 *
 * Owns no long-lived model connection: every call is a bounded one-shot and a
 * failure leaves the previous title or summary in place.
 */
export class TitlesService {
  private readonly providerId = SessionTitleProviderId('totem-titles')
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly running = new Map<string, Promise<void>>()

  constructor(
    private readonly ctx: Context,
    private readonly host: TitlesHost,
    private readonly config: () => TitlesConfig,
    readonly store = new TldrStore(),
  ) {}

  /** Register the sole title provider; a manual title always outranks it. */
  register(): () => Promise<void> {
    return this.ctx.sessionTitle.register({
      id: this.providerId,
      automatic: 'all-prompts',
      generate: request => this.generate(request),
    })
  }

  /** Summary for the hover card, or undefined when none exists yet. */
  async tldr(sessionId: string): Promise<TldrRecord | undefined> {
    return this.store.get(sessionId)
  }

  /**
   * Read a summary, generating one on demand for a live session that has none.
   * Hovering an old session is cheap: only live sessions reach the model.
   */
  async ensure(sessionId: string): Promise<TldrRecord | undefined> {
    const stored = await this.store.get(sessionId)
    if (stored !== undefined && Date.now() - stored.updatedAt < 60_000) return stored
    const session = this.ctx.sessions.get(sessionId as never)
    if (session === undefined) return stored
    await this.enqueue(session)
    return this.store.get(sessionId)
  }

  /** Schedule a summary refresh after one completed turn. */
  noteTurnEnd(session: Session): void {
    if (!this.config().tldr) return
    if (session.header.origin === 'subagent') return
    const id = session.id
    const pending = this.timers.get(id)
    if (pending !== undefined) clearTimeout(pending)
    this.controllers.get(id)?.abort(new Error('newer turn superseded the hover summary'))
    const timer = setTimeout(() => {
      this.timers.delete(id)
      // A title is a nice-to-have: a failure here must never escape a timer
      // callback, because an uncaught error takes the whole host down.
      void this.enqueue(session).catch((error: unknown) => {
        console.error('[totem] title summarization failed:', (error as Error)?.message ?? String(error))
      })
    }, TLDR_DEBOUNCE_MS)
    timer.unref?.()
    this.timers.set(id, timer)
  }

  /** Stop pending summaries and abort live calls. */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    for (const controller of this.controllers.values()) controller.abort(new Error('titles service disposed'))
    this.controllers.clear()
  }

  /** Rebuild one title revision from at most the first five human messages. */
  private async generate(request: SessionTitleProviderRequest): Promise<SessionTitleProviderResult> {
    const messages = request.messages
    if (messages.length === 0) throw new Error('totem-titles: no human message is available')
    const current = request.currentTitle
    const decision = titleDecision(messages, current)
    // A manual rename is authoritative. The service stops scheduling these and
    // aborts an in-flight revision, so this is only a defensive stop: throwing
    // leaves the accepted title untouched instead of rewriting its source.
    if (decision.mode === 'manual') throw new Error('totem-titles: manual title is authoritative')
    // A provider-sourced title is settled after the fifth turn.
    if (decision.mode === 'settled') {
      return { title: decision.title, messageSeqs: [messages[0].seq] }
    }
    // Subagent transcripts are internal; do not spend a model call on them.
    if (request.session.header.origin === 'subagent') {
      const fallback = fallbackSessionTitle(messages[0].text, 5, 40)
      const title = fallback.length > 0 ? fallback : current?.title ?? 'Session'
      return { title, messageSeqs: [messages[0].seq] }
    }
    const window = decision.window
    const anchor = decision.anchor
    const explicit = this.config()
    const response = await executeSessionTitleLlm(
      this.ctx,
      {
        maxInputBytes: TITLE_MAX_INPUT_BYTES,
        maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
        timeoutMs: TITLE_TIMEOUT_MS,
        ...explicit.provider.length > 0 && explicit.model.length > 0
          ? { provider: explicit.provider, model: explicit.model }
          : {},
      },
      request,
      this.providerId,
      {
        system: titleSystem(anchor !== undefined),
        input: frameMessages(window, anchor),
        messageSeqs: window.map(message => message.seq),
        selectReasoningEffort: model => model.reasoning?.efforts[0]?.id,
      },
    )
    return {
      title: titleFromResponse(response),
      messageSeqs: window.map(message => message.seq),
      model: response.model,
    }
  }

  /** Generate and store one hover summary. */
  private enqueue(session: Session): Promise<void> {
    const id = session.id
    const running = this.running.get(id)
    if (running !== undefined) return running
    const task = this.summarize(session)
    this.running.set(id, task)
    void task.finally(() => {
      if (this.running.get(id) === task) this.running.delete(id)
    })
    return task
  }

  /** Generate and store one hover summary. */
  private async summarize(session: Session): Promise<void> {
    const target = this.host.titleTarget()
    if (target === undefined) return
    if (this.ctx.sessions.get(session.id) !== session) return
    const turns = recentTurns(session.snapshotEvents(), TLDR_TURNS)
    if (turns.length === 0) return
    const controller = new AbortController()
    this.controllers.set(session.id, controller)
    const deadline = AbortSignal.timeout(TLDR_TIMEOUT_MS)
    const signal = AbortSignal.any([controller.signal, deadline])
    try {
      const text = await runOneShot(
        this.ctx,
        {
          ...target,
          maxTokens: TLDR_MAX_OUTPUT_TOKENS,
          maxInputBytes: TLDR_MAX_INPUT_BYTES,
          timeoutMs: TLDR_TIMEOUT_MS,
        },
        TLDR_SYSTEM,
        tldrInput(turns),
        signal,
        session.id,
        'totem-title',
      )
      if (text === undefined || controller.signal.aborted) return
      const tldr = tldrFromOutput(text)
      if (tldr === undefined) return
      await this.store.put(session.id, {
        tldr,
        updatedAt: Date.now(),
      })
    } catch {
      // A failed summary keeps the previous one; the hover card never shows an
      // error for auxiliary work.
    } finally {
      if (this.controllers.get(session.id) === controller) this.controllers.delete(session.id)
    }
  }
}
