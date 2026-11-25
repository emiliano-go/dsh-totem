/**
 * Deterministic verify lane, wired to a finished turn.
 *
 * The rules in `verify.ts` and `rules.ts` used to run only inside the removed
 * model judge. This module keeps them in the loop without a model: it feeds the
 * turn's tool calls through both lanes (plus the optional project command) and
 * stores the findings for the in-chat card.
 *
 * Warning only. A high-severity finding is reported, never enforced: the turn
 * is not blocked, not retried, and not rewritten.
 *
 * @module dsh-totem/verify-lane
 */
import { diffLines } from 'diff'
import {
  runVerifyCommand,
  verifyAnswer,
  verifyChanges,
  type VerifyChange,
  type VerifyFinding,
} from './verify.ts'
import { RULES, verifyExtraChanges } from './rules.ts'

/** One recorded mutation, as the turn buffer saw it. */
export interface LaneChange {
  tool: string
  path: string
  input: string
  output: string
  /** JSON array of `{oldText, newText}` from the patch tool's metadata. */
  diff?: string
}

/** One bash call that looked like a test/lint/build, with its exit code. */
export interface LaneCheck {
  command: string
  cwd?: string
  exitCode: number
  output: string
}

/** Input for one turn. */
export interface LaneInput {
  session: string
  turn: number
  changes: readonly LaneChange[]
  checks?: readonly LaneCheck[]
  answer?: string
  project?: string
}

/** A finding plus which lane produced it. */
export interface LaneFinding extends VerifyFinding {
  source: 'builtin' | 'extra' | 'answer' | 'command'
}

/** One turn's verification result. */
export interface LaneResult {
  session: string
  turn: number
  at: string
  ms: number
  findings: LaneFinding[]
  command?: { ran: boolean; ok: boolean; ms: number }
}

/** Rules and their descriptions, for the settings tab. */
export function ruleCatalog(): { id: string; severity: string; description: string }[] {
  return RULES.map(rule => ({ id: rule.id, severity: rule.severity, description: rule.description }))
}

/** Rebuild a unified diff from the patch tool's `{oldText,newText}` metadata. */
function unifiedDiff(change: LaneChange): string {
  if (change.diff === undefined || change.diff.length === 0) return ''
  try {
    const parsed = JSON.parse(change.diff) as { oldText?: string | null; newText?: string | null }[]
    if (!Array.isArray(parsed)) return ''
    // The hunk header matters: `addedLines` only trusts the diff when it can
    // see one, and falls back to the tool input otherwise.
    return parsed.map((file) => '@@ -1 +1 @@\n' + diffLines(file.oldText ?? '', file.newText ?? '')
      .flatMap(part => part.added
        ? part.value.split('\n').filter(Boolean).map(line => `+${line}`)
        : part.removed
          ? part.value.split('\n').filter(Boolean).map(line => `-${line}`)
          : [])
      .join('\n')).join('\n')
  } catch {
    return ''
  }
}

/** The verify lane's view of a turn: mutations plus the test commands it ran. */
export function toVerifyChanges(input: LaneInput): VerifyChange[] {
  const changes: VerifyChange[] = input.changes.map(change => ({
    tool: change.tool,
    input: change.input,
    output: change.output,
    diff: unifiedDiff(change),
    ...change.path.length === 0 ? {} : { paths: [change.path] },
  }))
  for (const check of input.checks ?? []) {
    changes.push({ tool: 'bash', input: check.command, output: check.output })
  }
  return changes
}

/** Runs the deterministic lanes. Pure apart from the optional project command. */
export class VerifyLane {
  constructor(
    private readonly config: {
      command: { get(): string }
      disable: { get(): readonly string[] }
    },
  ) {}

  /** Current settings, for the settings tab. */
  settings(): { command: string; disable: readonly string[] } {
    return { command: this.config.command.get(), disable: this.config.disable.get() }
  }

  async run(input: LaneInput): Promise<LaneResult> {
    const started = Date.now()
    const disable = this.config.disable.get()
    const changes = toVerifyChanges(input)
    const builtin = verifyChanges(changes, { disable })
    const extra = verifyExtraChanges(changes, input.project === undefined
      ? { disable }
      : { disable, root: input.project })
    const answer = verifyAnswer(input.answer ?? '', { disable })

    const findings: LaneFinding[] = [
      ...builtin.findings.map(finding => ({ ...finding, source: 'builtin' as const })),
      ...extra.map(finding => ({ ...finding, source: 'extra' as const })),
      ...answer.findings.map(finding => ({ ...finding, source: 'answer' as const })),
    ]

    let command: LaneResult['command']
    const configured = this.config.command.get().trim()
    if (configured.length > 0 && input.project !== undefined) {
      const began = Date.now()
      const run = await runVerifyCommand(configured, input.project).catch(() => undefined)
      command = { ran: run !== undefined, ok: (run?.findings.length ?? 1) === 0, ms: Date.now() - began }
      findings.push(...(run?.findings ?? []).map(finding => ({ ...finding, source: 'command' as const })))
    }

    return {
      session: input.session,
      turn: input.turn,
      at: new Date().toISOString(),
      ms: Date.now() - started,
      findings,
      ...command === undefined ? {} : { command },
    }
  }
}

/**
 * Findings by turn, newest session wins.
 *
 * Turn numbers restart per session, so a bare turn is ambiguous; the browser
 * shows the newest timeline, and that is the one it asks about.
 */
export class VerifyStore {
  private readonly byTurn = new Map<number, LaneResult>()
  private lastResult: LaneResult | undefined

  add(result: LaneResult): void {
    this.byTurn.set(result.turn, result)
    this.lastResult = result
    if (this.byTurn.size > 200) {
      const oldest = this.byTurn.keys().next().value
      if (oldest !== undefined) this.byTurn.delete(oldest)
    }
  }

  forTurn(turn: number): LaneResult | undefined {
    return this.byTurn.get(turn)
  }

  last(): LaneResult | undefined {
    return this.lastResult
  }
}
