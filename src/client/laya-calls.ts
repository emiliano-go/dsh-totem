/** Fetches the Laya judge calls recorded for one turn or one assistant message. */
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

/** One judge answer. */
export interface LayaCallAnswer {
  type?: string
  noul?: number
  score?: number
  choice?: string
  confidence?: number
  legend?: Record<string, string>
  probabilities?: Record<string, number>
}

/** One judge invocation, as recorded by the Host. */
export interface LayaCall {
  id: number
  ts: string
  kind: 'mutation' | 'answer' | 'step' | 'advisory' | string
  authoritative: boolean
  session?: string
  messageId?: string
  turn?: number
  task: string
  /** Request state; absent from list responses, fetched by id when expanded. */
  state?: unknown
  /** Judge questions; absent from list responses, fetched by id when expanded. */
  questions?: unknown
  /** True when the review was not backed by evidence of a real problem. */
  reviewOnly?: boolean
  answers: Record<string, LayaCallAnswer>
  verdict: string
  composite: number | null
  margin: number | null
  threshold: number
  missing: string[]
  vetoes: string[]
  findings: { rule: string; severity: string; detail: string; path?: string }[]
  usage?: { input_tokens?: number; output_tokens?: number }
  ms: number
  error?: string
}

/**
 * Calls recorded for one turn, pinned to the newest session that saw that turn.
 *
 * Turn numbers restart per session, so a turn number alone is ambiguous; the
 * newest matching call identifies the timeline the browser is showing.
 */
export function selectTurnCalls(calls: readonly LayaCall[], turn: number): LayaCall[] {
  const matching = calls.filter(call => call.turn === turn)
  if (matching.length === 0) return []
  const session = matching[matching.length - 1].session
  return session === undefined ? matching : matching.filter(call => call.session === session)
}

/**
 * User-facing label for one recorded call kind.
 *
 * The wire vocabulary distinguishes a turn evaluation with changes
 * (`mutation`) from one without (`answer`), but both are the turn's decision, so
 * they share one label. `step` and `advisory` are checks, not decisions, and say
 * so.
 */
export function callKindLabel(kind: string): string {
  switch (kind) {
    case 'answer':
    case 'mutation':
      return 'Turn judgement'
    case 'step':
      return 'Step check'
    case 'advisory':
      return 'Advisory judgement'
    default:
      return kind
  }
}

/** Files a recorded judge call saw changed, read from its canonical state. */
export function changedPaths(state: unknown): string[] {
  if (typeof state !== 'object' || state === null) return []
  const changes = (state as { changes?: unknown }).changes
  if (!Array.isArray(changes)) return []
  const paths = changes
    .map(change => (typeof change === 'object' && change !== null ? (change as { path?: unknown }).path : undefined))
    .filter((path): path is string => typeof path === 'string' && path.length > 0)
  return [...new Set(paths)].slice(0, 8)
}

interface CallsConfig {
  apiToken?: string
}

/** How long one list response serves every card on the page. */
const CACHE_MS = 600

/** Lookup faces used by the in-chat card and the message badge. */
export class LayaCallsController {
  private cache: { at: number; calls: LayaCall[] } | undefined
  private inflight: Promise<LayaCall[]> | undefined
  private detail = new Map<number, LayaCall>()

  constructor(private readonly form: SettingsFormScope<CallsConfig>) {}

  private async fetchCalls(query: string): Promise<LayaCall[]> {
    const token = (this.form.getSnapshot().value as CallsConfig | undefined)?.apiToken?.trim() ?? ''
    if (token.length === 0) return []
    try {
      const response = await fetch(`/totem/laya/calls?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) return []
      const data = await response.json() as { calls?: LayaCall[]; call?: LayaCall | null }
      if (Array.isArray(data.calls)) return data.calls
      if (data.call !== undefined && data.call !== null) return [data.call]
      return []
    } catch {
      return []
    }
  }

  /**
   * Every recorded call, fetched once per cache window.
   *
   * A card mounts per completed turn, so a per-card request turns a long
   * transcript into a burst of identical calls and stalls session load. One
   * shared list serves them all; concurrent callers join the same in-flight
   * request.
   */
  async all(force = false): Promise<LayaCall[]> {
    const now = Date.now()
    if (!force && this.cache !== undefined && now - this.cache.at < CACHE_MS) return this.cache.calls
    if (this.inflight !== undefined) return this.inflight
    this.inflight = this.fetchCalls('limit=300')
      .then((calls) => {
        this.cache = { at: Date.now(), calls }
        return calls
      })
      .finally(() => { this.inflight = undefined })
    return this.inflight
  }

  /** Read the calls for one message id; empty when none are recorded. */
  lookup = async (messageId: string): Promise<LayaCall[]> => {
    if (messageId.length === 0) return []
    const all = await this.all()
    const matching = all.filter(call => call.messageId === messageId)
    return matching.length > 0 ? matching : this.fetchCalls(`message=${encodeURIComponent(messageId)}&limit=50`)
  }

  /** Read every call recorded for one turn, from the shared list. */
  lookupTurn = async (turn: number): Promise<LayaCall[]> => {
    if (!Number.isFinite(turn) || turn < 0) return []
    return selectTurnCalls(await this.all(), turn)
  }

  /**
   * One call with its request state, for the expanded row.
   *
   * The list is slim, so this costs a request the first time; the result is
   * cached because a row can be collapsed and reopened.
   */
  lookupDetail = async (id: number): Promise<LayaCall | undefined> => {
    const cached = this.detail.get(id)
    if (cached !== undefined) return cached
    const fromList = (await this.all()).find(call => call.id === id)
    if (fromList !== undefined && fromList.state !== undefined) {
      this.detail.set(id, fromList)
      return fromList
    }
    const [fetched] = await this.fetchCalls(`id=${id}`)
    if (fetched !== undefined && fetched.id === id) {
      this.detail.set(id, fetched)
      return fetched
    }
    return fromList
  }
}
