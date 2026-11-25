/**
 * The exploration gate: when the same failure repeats and nothing new has been
 * tried, further edits are refused.
 *
 * Humans do not debug by editing the same line again with the same mental
 * model — they go and find out what is actually true: a REPL line, a tiny
 * script, a curl, a print. That is an *experiment*, and it is the step agents
 * skip most often: they re-derive a theory and apply it again.
 *
 * This module watches the commands a session runs and the checks that fail. Two
 * consecutive failures with the same signature, and no new command since the
 * last one, mark the session as stuck. While stuck, mutating tools are denied
 * with a message that names the failure and asks for a probe. Any first-time
 * non-inspection command clears it.
 *
 * No model judgement is involved: a command is new or it is not, the exit code
 * is zero or it is not, and the last non-empty output line is compared after
 * normalising numbers and paths.
 *
 * @module dsh-totem/explore
 */

/** Commands that look at the world without changing the question. */
const INSPECTION = new Set([
  'ls', 'cat', 'head', 'tail', 'less', 'more', 'pwd', 'echo', 'find', 'tree',
  'grep', 'rg', 'ag', 'ack', 'wc', 'sort', 'uniq', 'diff', 'stat', 'file',
  'git status', 'git diff', 'git log', 'git show', 'git branch',
  'which', 'type', 'env', 'printenv', 'date', 'whoami', 'jq',
])

/** Tool calls that change files. */
export const MUTATING_TOOLS = new Set(['write', 'edit', 'apply_patch'])

/**
 * True when a command only reads: it cannot discover anything the agent does
 * not already believe, so it does not count as an experiment.
 * @param command - the shell command as written.
 */
export function isInspection(command: string): boolean {
  const trimmed = command.trim().replace(/^\(+\s*/u, '')
  if (trimmed.length === 0) return true
  // A compound command is an experiment if any part of it is.
  const parts = trimmed.split(/&&|\|\||;/u).map(part => part.trim()).filter(Boolean)
  if (parts.length > 1) return parts.every(isInspection)
  const first = parts[0] ?? trimmed
  const head = first.split(/\s+/u).slice(0, 2).join(' ')
  if (INSPECTION.has(head)) return true
  const word = first.split(/\s+/u)[0] ?? ''
  return INSPECTION.has(word)
}

/** Stable key for a command, so repeats are cheap to spot. */
export function commandKey(command: string): string {
  return command.trim().replace(/\s+/gu, ' ')
}

/**
 * Signature of a failure: the interesting part of the output, without the
 * numbers and paths that change between runs of the same bug.
 */
export function failureSignature(check: { exitCode: number; output?: string; command?: string }): string {
  const lines = (check.output ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !/^\s*at\s/u.test(line))
  const interesting = lines.find(line => /error|fail|expected|assert|cannot|undefined|exception|refused|timeout/iu.test(line))
    ?? lines.at(-1)
    ?? ''
  const normalised = interesting
    .replace(/\/[\w./-]+\.(?:[cm]?[jt]sx?|py|rs|go)\b/gu, '<file>')
    .replace(/\b\d+(?:\.\d+)?\b/gu, '<n>')
    .replace(/\s+/gu, ' ')
    .slice(0, 160)
  return normalised.length > 0 ? normalised : `exit ${check.exitCode}: ${(check.command ?? '').slice(0, 80)}`
}

interface Failure {
  readonly signature: string
  readonly at: number
}

interface SessionState {
  /** Command keys this session has already run. */
  readonly ran: Set<string>
  /** Consecutive failing checks; a pass clears it. */
  failures: Failure[]
  /** When the last genuinely new, non-inspection command ran. */
  lastProbeAt: number
}

/** What the gate knows about one session. */
export interface ExploreSnapshot {
  readonly stuck: boolean
  readonly signature?: string
  readonly probes: number
  readonly failures: number
}

/** Tracks command novelty and repeated failures per session. */
export class ExploreGate {
  private readonly sessions = new Map<string, SessionState>()

  private state(sessionId: string): SessionState {
    let state = this.sessions.get(sessionId)
    if (state === undefined) {
      state = { ran: new Set(), failures: [], lastProbeAt: 0 }
      this.sessions.set(sessionId, state)
    }
    return state
  }

  /** Forget a session (disposal). */
  forget(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /**
   * Record a bash command. A command that has not run before and is not pure
   * inspection counts as an experiment.
   * @returns true when it counted as a probe.
   */
  recordCommand(sessionId: string, command: string, at = Date.now()): boolean {
    const state = this.state(sessionId)
    const key = commandKey(command)
    const seen = state.ran.has(key)
    state.ran.add(key)
    if (seen || isInspection(command)) return false
    state.lastProbeAt = at
    return true
  }

  /** Record a check outcome; a pass clears the stuck state. */
  recordCheck(sessionId: string, check: { exitCode: number; output?: string; command?: string }, at = Date.now()): void {
    const state = this.state(sessionId)
    if (check.exitCode === 0) {
      state.failures = []
      return
    }
    state.failures.push({ signature: failureSignature(check), at })
    if (state.failures.length > 5) state.failures.shift()
  }

  /** What the gate currently believes about a session. */
  snapshot(sessionId: string): ExploreSnapshot {
    const state = this.sessions.get(sessionId)
    if (state === undefined) return { stuck: false, probes: 0, failures: 0 }
    const last = state.failures.at(-1)
    const previous = state.failures.at(-2)
    const stuck = last !== undefined && previous !== undefined
      && last.signature === previous.signature
      && state.lastProbeAt < last.at
    return { stuck, probes: state.lastProbeAt, failures: state.failures.length, ...last === undefined ? {} : { signature: last.signature } }
  }

  /**
   * Why a mutation must be refused right now, if it must.
   * @returns the message for the model, or undefined when editing is fine.
   */
  blocked(sessionId: string | undefined): string | undefined {
    if (sessionId === undefined) return undefined
    const state = this.snapshot(sessionId)
    if (!state.stuck) return undefined
    return [
      `[explore gate] The same failure has now happened twice and nothing new has been tried since:`,
      state.signature === undefined ? '' : `  ${state.signature}`,
      '',
      'Editing again from the same mental model is what produced it. Find out what is actually true first — run one small experiment:',
      '  • a one-liner (`bun -e "…"`, `node -e "…"`, `python3 - <<\'PY\' … PY`)',
      '  • a request against the real service (`curl …`)',
      '  • a five-line script in a scratch directory that prints what you are guessing at',
      '',
      'Any command this session has not run before clears this block. Then edit.',
    ].filter((line, index) => !(index === 1 && line === '')).join('\n')
  }
}

/** Prompt text that states the habit before the gate has to enforce it. */
export const EXPLORE_PROMPT = `## Experiments before edits

When the cause of a problem is not already proven, run a small experiment before editing: a one-liner, a curl, a five-line script that prints the thing you are guessing about. Do not re-apply the same theory twice — if a check fails again with the same output, the model in your head is wrong, and the cheapest correction is a command, not another edit. Once you are stuck that way (two identical failures, nothing new tried), the host refuses file edits until a command the session has not run before has been executed.`
