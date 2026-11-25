/**
 * Deterministic "prove it" gate for a single turn.
 *
 * A turn that changes files without running a check afterwards is not
 * finished — it is a hypothesis. The gate turns that into a rule instead of a
 * hope: when a turn edits code and no check has passed *after* the last edit,
 * the host steers a message into the running turn, which forces another step
 * before the turn can end. No model is asked to grade itself, so the outcome
 * does not depend on how confident the agent feels.
 *
 * Everything here is pure: the caller supplies the evidence it already
 * buffers, and gets back a verdict plus the exact message to inject.
 *
 * @module dsh-totem/verify-gate
 */

/** One file mutation observed during the turn. */
export interface GateChange {
  readonly tool: string
  readonly path: string
  /** Monotonic position inside the turn, used to order edits against checks. */
  readonly seq?: number
}

/** One command that looked like a test, typecheck, lint, or build. */
export interface GateCheck {
  readonly command: string
  readonly exitCode: number
  readonly output?: string
  readonly seq?: number
}

/** Input for one turn. */
export interface GateInput {
  readonly changes: readonly GateChange[]
  readonly checks: readonly GateCheck[]
  /** The configured check to demand; empty means "the project's own command". */
  readonly command?: string
}

export type GateReason = 'no-change' | 'verified' | 'unchecked' | 'failing'

/** What the host should do with the turn. */
export interface GateVerdict {
  readonly reason: GateReason
  /** True when the turn must take another step before it may end. */
  readonly block: boolean
  /** Message to steer into the turn when blocked. */
  readonly message?: string
  /** The command the verdict is about, when known. */
  readonly command?: string
}

/** How much failing output to quote back. */
const OUTPUT_TAIL = 400

/** Prompt text explaining the rule before the first violation. */
export const GATE_PROMPT = `## Verification gate

A turn that changes files and cannot show a check that passed after the last change is not finished, it is a hypothesis. The host enforces this: when a turn ends with edits and no passing check after them, it steers one more step into the same turn asking for the command and its exit status. Answer it by running the check, or by stating in one line why it cannot run here. Do not claim work is done while a check you ran is failing.`

/**
 * Decide whether a finished turn has earned its ending.
 * @param input - mutations and checks from the turn buffer, in any order.
 * @returns the verdict, including the message to inject when blocked.
 */
export function evaluateTurn(input: GateInput): GateVerdict {
  const { changes, checks } = input
  if (changes.length === 0) return { reason: 'no-change', block: false }

  const lastChange = Math.max(...changes.map(change => change.seq ?? 0))
  const after = checks.filter(check => (check.seq ?? 0) > lastChange)
  const last = after.at(-1)
  // The most recent verdict after the last edit decides: an earlier green check
  // does not cover a later red one.
  if (last !== undefined && last.exitCode === 0) return { reason: 'verified', block: false }

  const command = (input.command ?? '').trim()
  if (last !== undefined) {
    const tail = last.output?.trim() ?? ''
    return {
      reason: 'failing',
      block: true,
      command: last.command,
      message: [
        `[verify gate] The last check after your edit failed (exit ${last.exitCode}): \`${last.command}\`.`,
        tail.length === 0 ? '' : `Output tail:\n${tail.slice(-OUTPUT_TAIL)}`,
        'Fix it, or state in one line why it cannot pass here. The turn does not end while a check you ran is red.',
      ].filter(part => part.length > 0).join('\n\n'),
    }
  }

  const files = changes.map(change => change.path).filter(path => path.length > 0)
  const shown = files.slice(0, 3).join(', ')
  const more = files.length > 3 ? ', …' : ''
  const target = command.length > 0 ? `\`${command}\`` : 'the project’s test or verify command'
  return {
    reason: 'unchecked',
    block: true,
    ...command.length > 0 ? { command } : {},
    message: [
      `[verify gate] You changed ${files.length} file${files.length === 1 ? '' : 's'} this turn (${shown}${more}) and ran no check after the last change.`,
      `Run ${target} now, and report the exit status plus any failing output.`,
      'If it cannot run in this environment, say why in one line. A turn that edits files without a check does not end.',
    ].join('\n\n'),
  }
}
