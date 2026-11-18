/**
 * Continue turns that a Host restart cut in half.
 *
 * DSH persists every turn as an append-only event log and can resume a Session
 * on demand, but nothing continues an interrupted turn on its own. A graceful
 * shutdown records `turn/end { reason: aborted, reason: { kind: disposed } }`
 * before the process exits; a crash leaves the tail turn open. Both are
 * detectable from the stored log, and both leave the work unfinished.
 *
 * On boot this module scans recent, non-subagent, non-running Sessions, finds
 * those two shapes, and queues one continuation prompt through
 * `sessionController.prompt()`. That call resumes the cold Session, appends the
 * synthetic closers for a crash tail, and starts a new turn whose first message
 * tells the agent to verify state instead of repeating side effects.
 *
 * A small ledger makes the pass idempotent and crash-loop safe: the same tail
 * event never resumes twice, and one Session cannot be auto-resumed more than
 * `maxAttempts` times per cooldown window.
 *
 * @module dsh-totem/resume
 */
import { interruptedTurnClosers } from '@deepseek-ai/dsh-session'
import type { Context } from '@deepseek-ai/cordis'
import { JsonStore, statePath } from './store.ts'

/** Why a turn looks unfinished. */
export type Interruption = 'crash' | 'shutdown'

/** The slice of one persisted session event this module reads. */
export interface ResumeEvent {
  type: string
  seq: number
  time: number
  data?: unknown
}

/** One visible session row, as the Session API publishes it. */
export interface ResumeSummary {
  sessionId: string
  updatedAt: number
  running?: boolean
  blank?: boolean
  origin?: 'subagent'
  agentAvailable?: boolean
}

/** Session API surface used to find and prompt interrupted work. */
export interface ResumeSessionController {
  list: (request: object, signal: AbortSignal) => Promise<{ items: readonly ResumeSummary[] }>
  prompt: (
    request: {
      requestId: string
      sessionId: string
      mode: 'queue' | 'steer'
      content: readonly { type: 'text'; text: string }[]
    },
    signal: AbortSignal,
  ) => Promise<unknown>
}

/** One stored Session handle, reduced to the read this module needs. */
export interface ResumeSessionHandle {
  read: (
    offset?: number,
    length?: number,
    options?: { signal?: AbortSignal },
  ) => Promise<{ events: readonly ResumeEvent[] }>
  close: () => Promise<void> | void
}

/** Persistence surface used to inspect a stored log without resuming it. */
export interface ResumePersistence {
  open: (id: string, access: 'read', options?: { signal?: AbortSignal }) => Promise<ResumeSessionHandle>
}

/** One boot pass's decision, for logs and tests. */
export interface ResumeDecision {
  sessionId: string
  action: 'resumed' | 'skipped'
  reason: string
}

/** Result of one boot pass. */
export interface ResumeReport {
  resumed: number
  decisions: readonly ResumeDecision[]
}

/** Defaults, matching the plugin config. */
export const RESUME_DEFAULTS = {
  windowMinutes: 30,
  maxSessions: 3,
  maxAttempts: 3,
  cooldownMinutes: 30,
  maxScan: 20,
} as const

interface ResumeLedger {
  version: 1
  sessions: Record<string, { seq: number; attempts: number; lastAt: number }>
}

/**
 * Decide whether a stored log ends inside interrupted work.
 *
 * An open tail turn (a `turn/start` with no `turn/end`) is a crash: the loop
 * never got to close it. A closed tail whose reason is `aborted/disposed` is a
 * shutdown that disposed the agent. User, parent, and hook cancellations are
 * deliberate and never resume.
 */
export function interruptionOf(events: readonly ResumeEvent[]): Interruption | undefined {
  if (events.length === 0) return undefined
  if (interruptedTurnClosers(events as never).length > 0) return 'crash'
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== 'turn/end') continue
    const reason = (event.data as {
      reason?: { kind?: string; reason?: { kind?: string } }
    } | undefined)?.reason
    if (reason?.kind === 'aborted' && reason.reason?.kind === 'disposed') return 'shutdown'
    return undefined
  }
  return undefined
}

/** The continuation message queued into an interrupted Session. */
export function continuationPrompt(reason: Interruption): string {
  const cause = reason === 'crash' ? 'crash' : 'graceful shutdown'
  return [
    `(dsh-totem auto-resume) The DSH host restarted while this turn was running (${cause}). Continue the interrupted task now.`,
    '',
    'Before acting:',
    '- Review the transcript and identify which steps completed and which tool calls were interrupted or have unknown outcomes.',
    '- Verify the current state (files, git status, running processes) instead of assuming it.',
    '- Do not repeat side effects that already succeeded.',
    '',
    'Finish the remaining work, then report what changed. If the task is already complete, say so and stop.',
  ].join('\n')
}

/** Deterministic request id: one continuation per tail event. */
export function resumeRequestId(sessionId: string, lastSeq: number): string {
  return `totem-resume:${sessionId}:${lastSeq}`
}

/** Collaborators and policy for one boot pass. */
export interface ResumeDeps {
  controller: ResumeSessionController
  persistence: ResumePersistence
  ledgerPath?: string
  now?: () => number
  windowMs?: number
  maxSessions?: number
  maxAttempts?: number
  cooldownMs?: number
  maxScan?: number
}

/** Scan recent Sessions once and continue the interrupted ones. */
export class InterruptedTurnResumer {
  private readonly store: JsonStore<ResumeLedger>

  constructor(private readonly deps: ResumeDeps) {
    this.store = new JsonStore<ResumeLedger>(
      deps.ledgerPath ?? statePath('resume.json'),
      { version: 1, sessions: {} },
    )
  }

  /** One pass; safe to call again after another restart. */
  async run(): Promise<ResumeReport> {
    const now = this.deps.now?.() ?? Date.now()
    const windowMs = this.deps.windowMs ?? RESUME_DEFAULTS.windowMinutes * 60_000
    const maxSessions = this.deps.maxSessions ?? RESUME_DEFAULTS.maxSessions
    const maxAttempts = this.deps.maxAttempts ?? RESUME_DEFAULTS.maxAttempts
    const cooldownMs = this.deps.cooldownMs ?? RESUME_DEFAULTS.cooldownMinutes * 60_000
    const maxScan = this.deps.maxScan ?? RESUME_DEFAULTS.maxScan
    const decisions: ResumeDecision[] = []

    let items: readonly ResumeSummary[]
    try {
      items = (await this.deps.controller.list({}, AbortSignal.timeout(15_000))).items
    } catch (error) {
      return { resumed: 0, decisions: [{ sessionId: '', action: 'skipped', reason: `list-failed: ${message(error)}` }] }
    }

    const candidates = items
      .filter(item =>
        item.blank !== true
        && item.origin !== 'subagent'
        && item.running !== true
        && item.agentAvailable !== true
        && item.updatedAt >= now - windowMs)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, maxScan)

    let resumed = 0
    for (const summary of candidates) {
      if (resumed >= maxSessions) {
        decisions.push({ sessionId: summary.sessionId, action: 'skipped', reason: 'session-cap' })
        continue
      }

      let events: readonly ResumeEvent[]
      try {
        events = await this.readEvents(summary.sessionId)
      } catch (error) {
        decisions.push({ sessionId: summary.sessionId, action: 'skipped', reason: `read-failed: ${message(error)}` })
        continue
      }
      const interruption = interruptionOf(events)
      if (interruption === undefined) continue

      const lastSeq = events.at(-1)?.seq ?? 0
      const ledger = await this.store.read()
      const entry = ledger.sessions[summary.sessionId]
      if (entry?.seq === lastSeq) {
        decisions.push({ sessionId: summary.sessionId, action: 'skipped', reason: 'already-resumed' })
        continue
      }
      const recent = entry !== undefined && now - entry.lastAt < cooldownMs
      const attempts = recent ? entry.attempts : 0
      if (attempts >= maxAttempts) {
        decisions.push({ sessionId: summary.sessionId, action: 'skipped', reason: 'attempt-cap' })
        continue
      }

      // Record before prompting: a crash during the prompt must still count, or
      // a broken continuation could restart forever.
      await this.store.update(current => ({
        version: 1,
        sessions: {
          ...current.sessions,
          [summary.sessionId]: { seq: lastSeq, attempts: attempts + 1, lastAt: now },
        },
      }))

      try {
        await this.deps.controller.prompt({
          requestId: resumeRequestId(summary.sessionId, lastSeq),
          sessionId: summary.sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: continuationPrompt(interruption) }],
        }, AbortSignal.timeout(60_000))
        resumed += 1
        decisions.push({ sessionId: summary.sessionId, action: 'resumed', reason: interruption })
      } catch (error) {
        decisions.push({ sessionId: summary.sessionId, action: 'skipped', reason: `prompt-failed: ${message(error)}` })
      }
    }

    return { resumed, decisions }
  }

  private async readEvents(sessionId: string): Promise<readonly ResumeEvent[]> {
    const signal = AbortSignal.timeout(15_000)
    const handle = await this.deps.persistence.open(sessionId, 'read', { signal })
    try {
      const result = await handle.read(0, undefined, { signal })
      return result.events
    } finally {
      await handle.close()
    }
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Policy for the boot pass, from the plugin config. */
export interface ResumeConfig {
  enabled: boolean
  windowMinutes: number
  maxSessions: number
  maxAttempts: number
  cooldownMinutes: number
}

/**
 * Run one recovery pass shortly after the Host is composed.
 *
 * The delay lets persistence and the Session service finish starting. A pass
 * that fails (no session API, a busy store) logs and gives up; it must never
 * make the Host fail to boot.
 */
export function registerInterruptedTurnResume(ctx: Context, config: ResumeConfig): void {
  if (!config.enabled) return
  ctx.inject(['sessionController', 'sessionPersistence'], (inner) => {
    const controller = (inner as { sessionController?: ResumeSessionController }).sessionController
    const persistence = (inner as { sessionPersistence?: ResumePersistence }).sessionPersistence
    if (controller === undefined || persistence === undefined) return
    const resumer = new InterruptedTurnResumer({
      controller,
      persistence,
      windowMs: config.windowMinutes * 60_000,
      maxSessions: config.maxSessions,
      maxAttempts: config.maxAttempts,
      cooldownMs: config.cooldownMinutes * 60_000,
    })
    const timer = setTimeout(() => {
      void resumer.run().then((report) => {
        for (const decision of report.decisions) {
          if (decision.action === 'resumed') {
            ctx.logger.info(`dsh-totem: auto-resumed interrupted session ${decision.sessionId} (${decision.reason})`)
          }
        }
      }).catch((error: unknown) => {
        ctx.logger.warn(`dsh-totem: interrupted-turn resume failed: ${message(error)}`)
      })
    }, 2_000)
    ctx.effect(() => () => clearTimeout(timer), 'dsh-totem: interrupted-turn resume timer')
  })
}
