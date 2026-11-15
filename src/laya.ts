/** Laya decision engine: managed HTTP server, turn evaluation, feedback, and logging. */
import { spawn, type ChildProcess } from 'node:child_process'
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Volatile } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { diffLines } from 'diff'
import { verifyAnswer, verifyChanges, verifyExternalFiles, executionEvidence, runVerifyCommand, type VerifyChange, type VerifyFinding } from './verify.ts'
import { verifyExtraChanges } from './rules.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemService } from './service.ts'

/** One turn's evidence for the judge. */
export interface TurnSnapshot {
  task: string
  answer: string
  toolCalls: { name: string; arguments: string }[]
  changes: { tool: string; path: string; input: string; output: string; diff?: string }[]
  grounding: { tool: string; input?: string; output: string }[]
  messageId?: string
}

/** One hunk of a unified diff, with its added lines for option previews. */
export interface DiffHunk {
  index: number
  header: string
  added: string[]
}

/** Ranked localization result; `top` is the hunk index with the highest score. */
export interface LocalizationResult {
  top: number | null
  hunks: { index: number; header: string; added: string[]; score: number }[]
  ms: number
}

/** Split a unified diff into hunks. Empty input yields no hunks. */
export function splitDiffHunks(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let current: string[] | null = null
  // Track the destination file so a multi-file diff reports which file a hunk
  // belongs to; a bare `@@ -1 +1 @@` is useless for localization otherwise.
  let file = ''
  const push = () => {
    if (current === null) return
    const range = current[0] ?? ''
    const header = file.length > 0 ? `${file} ${range}` : range
    const added = current
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.slice(1))
    hunks.push({ index: hunks.length, header, added })
  }
  let previousRemovedFile = false
  for (const line of diff.split('\n')) {
    if (line.startsWith('--- ')) {
      previousRemovedFile = true
      continue
    }
    // A new file header closes the previous file's last hunk; only the header
    // pair `---`/`+++` is treated as such, so added content that happens to
    // start with `+++` stays inside its hunk.
    if (previousRemovedFile && line.startsWith('+++ ')) {
      push()
      current = null
      file = line.slice(4).replace(/^b\//u, '').trim()
      previousRemovedFile = false
      continue
    }
    previousRemovedFile = false
    if (line.startsWith('@@')) {
      push()
      current = [line]
    } else if (current !== null) current.push(line)
  }
  push()
  return hunks
}

/**
 * Diff text to localize over.
 *
 * The route always supplies `diff` as a string, so an absent diff arrives as
 * `''`; a blank value must fall through to the change payloads instead of
 * producing zero hunks.
 */
export function localizationDiff(input: { diff?: string; changes?: TurnSnapshot['changes'] }): string {
  const provided = (input.diff ?? '').trim()
  if (provided.length > 0) return input.diff ?? ''
  return (input.changes ?? []).map(change => change.diff ?? change.input).join('\n')
}

/**
 * Hunks to rank, falling back to one hunk per change.
 *
 * A change payload is often a few added lines rather than a unified diff, and a
 * unified diff opened at the top of a file has no `@@` header at all. Both would
 * otherwise localize to nothing, so each change becomes a candidate with its
 * path as the header.
 */
export function hunksForLocalization(
  diff: string,
  changes: TurnSnapshot['changes'] = [],
): DiffHunk[] {
  const hunks = splitDiffHunks(diff)
  if (hunks.length > 0) return hunks
  return changes.flatMap((change, index) => {
    const lines = (change.diff ?? change.input ?? '')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\+{1,3}\s?/u, ''))
      .filter(line => line.length > 0)
    if (lines.length === 0) return []
    return [{ index, header: change.path.length > 0 ? change.path : `change ${index + 1}`, added: lines.slice(0, 12) }]
  })
}

/** Build the ordered localization result from per-hunk probabilities. */
export function rankLocalization(
  hunks: DiffHunk[],
  probabilities: Record<string, number>,
  ms = 0,
): LocalizationResult {
  const ranked = hunks
    .map(hunk => ({ ...hunk, score: probabilities[`hunk-${hunk.index}`] ?? 0 }))
    .sort((left, right) => right.score - left.score)
  return { top: ranked.length === 0 ? null : ranked[0].index, hunks: ranked, ms }
}

interface LayaAnswer {
  type?: string
  noul?: number
  score?: number
  choice?: string
  confidence?: number
  probabilities?: Record<string, number>
}

interface LayaResponse {
  answers?: Record<string, LayaAnswer>
  usage?: unknown
}

interface Failure {
  key: string
  instructions: string
  observed: number | string | undefined
  confidence: number | undefined
  criterion?: string
  distribution?: Record<string, number>
}

/** Decision result shared by the turn hook and the decision tool. */
export interface DecisionOutcome {
  verdict: 'pass' | 'fail' | 'needs_review'
  composite: number | null
  /** composite − effective threshold; negative means below the bar. */
  margin: number | null
  threshold: number
  vetoes: string[]
  failures: Failure[]
  /** Configured questions the judge did not answer (fail-closed). */
  missing: string[]
  answers: Record<string, LayaAnswer>
  bugClass?: string
  paths: string[]
  findings?: VerifyFinding[]
  calibrationVersion?: string
  /** needs_review caused only by a marginal, near-pass, or low-confidence result. */
  reviewOnly?: boolean
}

/** Calls kept in memory and on disk: enough for a long session's turn cards. */
const MAX_CALLS = 300
/** Rewrite the whole store once this many lines were appended since compaction. */
const COMPACT_AFTER = 500

/**
 * Parse the persisted call store.
 *
 * Bad lines are skipped rather than failing the load: a half-written final line
 * from a crash must not cost every earlier record.
 */
export function parseCallLines(text: string): LayaCallRecord[] {
  return text.split('\n').flatMap((line) => {
    if (line.trim().length === 0) return []
    try {
      const value = JSON.parse(line) as LayaCallRecord
      return typeof value === 'object' && value !== null && typeof value.id === 'number' ? [value] : []
    } catch {
      return []
    }
  }).slice(-MAX_CALLS)
}

/**
 * One call without the heavy request state, for list responses.
 *
 * `state` carries the task, every changed file with a clipped diff, the answer,
 * tool calls, grounding, and memory; it is the largest part of a record and only
 * the expanded row needs it, so it is fetched by id on demand.
 */
export function slimCall(call: LayaCallRecord): LayaCallRecord {
  const slim: LayaCallRecord = { ...call }
  delete slim.state
  delete slim.questions
  return slim
}

/** One observed judge call, kept for the UI card and diagnostics. */
export interface LayaCallRecord {
  id: number
  ts: string
  kind: 'mutation' | 'answer' | 'step' | 'advisory'
  authoritative: boolean
  session?: string
  messageId?: string
  turn?: number
  task: string
  /** Canonical request state; omitted from list responses to keep them small. */
  state?: unknown
  /** Judge questions; omitted from list responses to keep them small. */
  questions?: unknown
  /** True when the review was not backed by evidence of a real problem. */
  reviewOnly?: boolean
  answers: Record<string, LayaAnswer>
  verdict: string
  composite: number | null
  margin: number | null
  threshold: number
  missing: string[]
  vetoes: string[]
  findings: VerifyFinding[]
  usage?: unknown
  ms: number
  error?: string
}

const DEFAULT_QUESTIONS = {
  requirements_met: {
    type: 'noul',
    instructions: 'The code correctly implements every requirement in the task, including all edge cases.',
  },
  bug_risk: {
    type: 'score',
    instructions: 'Does the code contain a bug or miss an edge case?',
    criteria: ['No bug, the code is correct', 'Minor risk', 'Likely a bug', 'Definitely buggy'],
  },
  bug_class: {
    type: 'choice',
    instructions: "If the change likely introduces a bug, what kind of bug is it? Choose the best match, or 'none' if no bug is likely.",
    criteria: {
      none: 'No bug is likely',
      'off-by-one': 'Off-by-one, boundary, or loop/inclusive-range error',
      'null-empty': 'Missing null/empty/undefined handling',
      'wrong-comparison': 'Wrong comparison or operator',
      'scope-unrelated': 'Unrequested or unrelated changes / scope creep',
      'swallowed-exception': 'Exception swallowed or errors hidden',
      'resource-leak': 'Unclosed resource or cleanup missing',
      'type-coercion': 'Wrong type, coercion, or serialization issue',
      other: 'A different bug class',
    },
  },
} as const

const WEIGHTS: Record<string, number> = {
  requirements_met: 0.4,
  no_unrelated_changes: 0.25,
  bug_risk: 0.25,
  unsafe_patterns: 0.1,
  answer_quality: 0.4,
}

/** Per-question calibration fitted from harness labels. */
export interface LayaCalibrator {
  kind: 'platt' | 'isotonic'
  a?: number
  b?: number
  points?: [number, number][]
}

export interface LayaCalibration {
  version?: string
  questions?: Record<string, LayaCalibrator>
  passThreshold?: number
  confidenceFloor?: number
}

export interface DecisionSettings {
  passThreshold: number
  reviewBand?: number
  vetoThreshold?: number
  confidenceFloor?: number
  calibration?: LayaCalibration
}

function calibrateValue(calibrator: LayaCalibrator, value: number): number {
  if (calibrator.kind === 'platt') {
    return 1 / (1 + Math.exp(-((calibrator.a ?? 1) * value + (calibrator.b ?? 0))))
  }
  const points = calibrator.points ?? []
  if (points.length === 0) return value
  if (value <= points[0][0]) return points[0][1]
  for (let index = 1; index < points.length; index++) {
    const [x1, y1] = points[index]
    const [x0, y0] = points[index - 1]
    if (value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return points[points.length - 1][1]
}

/** Config fields the engine reads live. */
export interface LayaConfig {
  enabled: Volatile<boolean>
  baseUrl: Volatile<string>
  serverCommand: Volatile<string>
  manageServer: Volatile<boolean>
  passThreshold: Volatile<number>
  /** Band around the threshold that resolves to needs_review instead of a flip. */
  reviewBand: Volatile<number>
  /** Per-question normalized value below which the turn is vetoed. */
  vetoThreshold: Volatile<number>
  /** Answers below this confidence resolve to needs_review. */
  confidenceFloor: Volatile<number>
  /**
   * Steer the agent even when the review is `reviewOnly`.
   *
   * A review-only outcome is one the judge reached without evidence of a real
   * problem: a marginal margin, a near-pass, or answers under the confidence
   * floor. Enforcing it turns judge noise into extra turns, so it stays off
   * unless the deployment wants the stricter loop.
   */
  steerOnReview: Volatile<boolean>
  /** Optional calibration artifact path; empty means uncalibrated scoring. */
  calibrationFile: Volatile<string>
  maxRetries: Volatile<number>
  timeoutMs: Volatile<number>
  questionsFile: Volatile<string>
  model: Volatile<string>
  stepChecks: Volatile<'off' | 'veto' | 'full'>
  stepCadence: Volatile<'turn' | 'tool' | 'both'>
  stepMaxFeedback: Volatile<number>
  verifyCommand: Volatile<string>
  verifyExternal: Volatile<'auto' | 'on' | 'off'>
  verifyDisable: Volatile<readonly string[]>
}

function valueOf(key: string, answer: LayaAnswer): number | null {
  if (key === 'bug_risk') {
    if (answer.score === undefined) return null
    return 1 - Math.min(Math.max(answer.score, 0), 3) / 3
  }
  if (key === 'answer_quality') {
    if (answer.score === undefined) return null
    return Math.min(Math.max(answer.score, 0), 3) / 3
  }
  if (answer.noul === undefined) return null
  return Math.min(Math.max(answer.noul, 0), 1)
}

export function decide(
  answers: Record<string, LayaAnswer>,
  questions: Record<string, { type?: string; instructions?: string; criteria?: unknown }>,
  settingsInput: number | DecisionSettings,
  _evidencePassed = false,
): DecisionOutcome {
  const settings: DecisionSettings = typeof settingsInput === 'number' ? { passThreshold: settingsInput } : settingsInput
  const threshold = settings.calibration?.passThreshold ?? settings.passThreshold
  const band = Math.max(0, settings.reviewBand ?? 0.05)
  const vetoThreshold = settings.vetoThreshold ?? 0.5
  const confidenceFloor = settings.calibration?.confidenceFloor ?? settings.confidenceFloor ?? 0
  const calibrationVersion = settings.calibration?.version

  // Fail closed: every configured question must come back with a usable value.
  const answered = (answer: LayaAnswer | undefined): boolean =>
    answer !== undefined && (answer.noul !== undefined || answer.score !== undefined || answer.choice !== undefined)
  const missing = Object.keys(questions).filter(key => !answered(answers[key]))

  const entries: { key: string; value: number; weight: number }[] = []
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const answer = answers[key]
    if (answer === undefined) continue
    const raw = valueOf(key, answer)
    if (raw === null) continue
    const calibrator = settings.calibration?.questions[key]
    entries.push({ key, value: calibrator === undefined ? raw : calibrateValue(calibrator, raw), weight })
  }
  const weight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  const composite = weight === 0 ? null : entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weight
  const rawVetoes = entries.filter(entry => entry.value < vetoThreshold)
  const vetoes = rawVetoes.filter(entry => entry.value < vetoThreshold - band).map(entry => entry.key)
  const marginal = rawVetoes.length > vetoes.length
  const uncertain = Object.values(answers).some(answer => answer.confidence !== undefined && answer.confidence < confidenceFloor)

  // The per-question feedback is separate from the verdict: it names what a
  // reviewer would look at, even when the composite is inside the review band.
  const failures: Failure[] = []
  for (const entry of entries) {
    if (entry.value >= vetoThreshold) continue
    const answer = answers[entry.key]
    const raw = answer?.score ?? answer?.noul
    const distribution = answer?.probabilities
    const question = questions[entry.key]
    const criterion = question?.type === 'score' && Array.isArray(question.criteria) && answer?.score !== undefined
      ? String(question.criteria[Math.round(Math.max(0, Math.min(question.criteria.length - 1, answer.score)))] ?? '')
      : question?.type === 'choice' && answer?.choice !== undefined && question.criteria !== undefined && !Array.isArray(question.criteria)
        ? String((question.criteria as Record<string, string>)[answer.choice] ?? answer.choice)
        : raw === undefined ? undefined : String(raw)
    failures.push({
      key: entry.key,
      instructions: question?.instructions ?? '',
      observed: raw,
      confidence: answer?.confidence,
      ...criterion === undefined || criterion.length === 0 ? {} : { criterion },
      ...distribution === undefined ? {} : { distribution },
    })
  }

  const bugAnswer = answers.bug_class
  const bugClass = bugAnswer !== undefined && typeof bugAnswer.choice === 'string' && (bugAnswer.confidence ?? 0) >= 0.6
    ? bugAnswer.choice
    : undefined

  const margin = composite === null ? null : composite - threshold
  const nearPass = composite !== null && composite < threshold && composite >= threshold - band
  const hardFail = vetoes.length > 0 || composite === null || (composite !== null && composite < threshold - band)
  const clearPass = composite !== null && composite >= threshold + band
  const reviewOnly = missing.length === 0 && !hardFail && (marginal || nearPass || (uncertain && !clearPass))
  const verdict: DecisionOutcome['verdict'] = reviewOnly
    ? 'needs_review'
    : missing.length > 0 || composite === null
      ? 'needs_review'
      : hardFail
        ? 'fail'
        : composite >= threshold
          ? 'pass'
          : 'needs_review'
  return {
    verdict,
    composite,
    margin,
    threshold,
    vetoes,
    failures,
    missing,
    answers,
    ...bugClass === undefined ? {} : { bugClass },
    paths: [],
    findings: [],
    ...calibrationVersion === undefined ? {} : { calibrationVersion },
    ...reviewOnly ? { reviewOnly: true } : {},
  }
}

export function feedback(state: DecisionOutcome, threshold: number, paths: string[]): string {
  const score = state.composite === null ? 'n/a' : state.composite.toFixed(2)
  const margin = state.margin === null || state.margin === undefined
    ? 'n/a'
    : `${state.margin >= 0 ? '+' : ''}${state.margin.toFixed(3)}`
  const lines = state.failures.map((failure) => {
    const observed = failure.observed === undefined ? 'n/a' : failure.observed
    const criterion = failure.criterion === undefined ? '' : `, criterion: ${failure.criterion}`
    const distribution = failure.distribution === undefined ? '' : `\n  distribution: ${JSON.stringify(failure.distribution)}`
    return `- ${failure.key}: ${failure.instructions} (observed: ${observed}${criterion}, confidence: ${failure.confidence ?? 'n/a'})${distribution}`
  })
  const findings = state.findings ?? []
  const bar = state.threshold ?? threshold
  const heading = state.verdict === 'needs_review'
    ? `Decision engine could not confidently pass your last changes (composite ${score}, threshold ${bar}, margin ${margin}).`
    : `Decision engine evaluation of your last changes failed (composite ${score} < ${bar}, margin ${margin}).`
  return [
    heading,
    ...findings.length === 0 ? [] : ['Deterministic checks flagged:', ...findings.map(finding => `- ${finding.rule}: ${finding.detail}`)],
    ...state.missing.length === 0 ? [] : [`Missing judge answers: ${state.missing.join(', ')}.`],
    ...state.vetoes.length === 0 ? [] : [`Vetoed criteria: ${state.vetoes.join(', ')}.`],
    ...state.bugClass === undefined || state.bugClass === 'none' ? [] : [`Likely bug class: ${state.bugClass}`],
    ...paths.length === 0 ? [] : [`Changed files: ${paths.slice(0, 5).join(', ')}`],
    ...state.verdict === 'needs_review'
      ? ['Strengthen the evidence before finishing: run the relevant tests and linters, fix anything flagged, and report the results.']
      : ['Address the following issues before finishing:'],
    ...lines,
    ...state.verdict === 'needs_review' ? [] : ['Make the minimal changes needed to resolve them, then stop.'],
  ].join('\n')
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…[truncated]`
}

export interface CanonicalChange {
  tool: string
  input: string
  output: string
  path?: string
  diff?: string
}

export interface CanonicalState {
  task: string
  memory: { id?: string; type?: string; title?: string; statement?: string }[]
  changes: CanonicalChange[]
  answer: string
  toolCalls: { tool: string; title?: string; status: string }[]
  grounding: { tool: string; title?: string; output: string }[]
}

const CANONICAL = {
  task: 400,
  input: 4000,
  output: 2000,
  diff: 4000,
  diffTotal: 16_000,
  answer: 200,
  toolCalls: 10,
  memory: 3,
  memoryTitle: 48,
  memoryStatement: 120,
  grounding: 2,
  groundingOutput: 240,
} as const

/** Convert the edit tool's stored diff JSON into unified diff text. */
export function unifiedDiff(change: TurnSnapshot['changes'][number]): string | undefined {
  if (change.diff === undefined || change.diff.length === 0) return undefined
  try {
    const parsed = JSON.parse(change.diff) as { oldText?: string | null; newText?: string | null }[]
    if (!Array.isArray(parsed) || parsed.length === 0) return change.diff
    const header = change.path === undefined || change.path.length === 0 ? '' : `--- a/${change.path}\n+++ b/${change.path}\n`
    return header + parsed.map((file) => diffLines(file.oldText ?? '', file.newText ?? '')
      .flatMap((part) => part.added
        ? part.value.split('\n').filter(Boolean).map(line => `+${line}`)
        : part.removed
          ? part.value.split('\n').filter(Boolean).map(line => `-${line}`)
          : [])
      .join('\n')).join('\n')
  } catch {
    return change.diff
  }
}

function budgetDiffs(changes: CanonicalChange[], task: string): CanonicalChange[] {
  const ranked = changes
    .map((change, index) => ({ change, index }))
    .filter(entry => entry.change.diff !== undefined)
    .sort((left, right) => {
      const base = (change: CanonicalChange): string => change.path?.split('/').pop()?.toLowerCase() ?? ''
      const mentioned = (change: CanonicalChange): number => {
        const name = base(change)
        return name.length > 2 && task.includes(name) ? 1000 : 0
      }
      return mentioned(right.change) + right.index - (mentioned(left.change) + left.index)
    })
  const kept = new Map<number, string>()
  let remaining = CANONICAL.diffTotal
  for (const entry of ranked) {
    if (remaining <= 0) break
    const diff = clip(entry.change.diff ?? '', Math.min(CANONICAL.diff, remaining))
    remaining -= diff.length
    kept.set(entry.index, diff)
  }
  return changes.map((change, index) => {
    const diff = kept.get(index)
    return diff === undefined ? change : { ...change, diff }
  })
}

/** Canonical judge state; the training generator mirrors this exactly. */
export function normalizeState(
  snapshot: TurnSnapshot,
  memory: { id?: string; type?: string; title?: string; statement?: string }[] = [],
): CanonicalState {
  const task = clip(snapshot.task, CANONICAL.task)
  const changes: CanonicalChange[] = snapshot.changes.map((change) => {
    const diff = unifiedDiff(change)
    return {
      tool: change.tool,
      input: clip(change.input, CANONICAL.input),
      output: clip(change.output, CANONICAL.output),
      ...change.path.length === 0 ? {} : { path: change.path },
      ...diff === undefined || diff.length === 0 ? {} : { diff: clip(diff, CANONICAL.diff) },
    }
  })
  return {
    task,
    memory: memory.slice(0, CANONICAL.memory).map(item => ({
      ...item.id === undefined ? {} : { id: item.id },
      ...item.type === undefined ? {} : { type: item.type },
      ...item.title === undefined ? {} : { title: clip(item.title, CANONICAL.memoryTitle) },
      ...item.statement === undefined ? {} : { statement: clip(item.statement, CANONICAL.memoryStatement) },
    })),
    changes: budgetDiffs(changes, task),
    answer: clip(snapshot.answer, CANONICAL.answer),
    toolCalls: snapshot.toolCalls.slice(-CANONICAL.toolCalls).map(call => ({
      tool: call.name,
      ...call.arguments.length === 0 ? {} : { title: clip(call.arguments, 240) },
      status: 'completed',
    })),
    grounding: snapshot.grounding.slice(-CANONICAL.grounding).map(item => ({
      tool: item.tool,
      ...item.input === undefined || item.input.length === 0 ? {} : { title: clip(item.input, 120) },
      output: clip(item.output, CANONICAL.groundingOutput),
    })),
  }
}

/** Managed laya HTTP server plus the turn evaluation hook. */
export class LayaEngine {
  private child: ChildProcess | undefined
  private on = false
  private loaded = false
  private readonly recent = new Map<string, { verdict: string; composite: number | null; at: string; session: string; turn: number }>()
  private readonly calls: LayaCallRecord[] = []
  private nextCallId = 1
  /** Append-only store for judge calls, so cards survive a Host restart. */
  private readonly callsFile: string
  private appendedSinceCompact = 0
  private callsLoaded = false
  private calibrationCache: { file: string; mtimeMs: number; value?: LayaCalibration } | undefined
  private readonly stepFeedback = new Map<string, number>()
  private readonly stepSeen = new Map<string, Set<string>>()
  private readonly verifyCache = new Map<string, { at: number; findings: VerifyFinding[]; veto: boolean }>()
  private readonly onExit = (): void => {
    try { this.child?.kill('SIGTERM') } catch {}
  }
  private readonly retries = new Map<string, number>()
  private readonly stateFile: string

  constructor(
    private readonly ctx: Context,
    private readonly totem: TotemService,
    readonly config: LayaConfig,
    stateFile: string,
  ) {
    this.stateFile = stateFile
    this.callsFile = join(dirname(stateFile), 'laya-calls.jsonl')
  }

  /** Whether the engine should run for a turn. */
  enabled(): boolean {
    return this.on
  }

  /** Start the engine once the Host is ready. */
  async initialize(): Promise<void> {
    let enabled = this.config.enabled.get()
    try {
      const parsed = JSON.parse(await readFile(this.stateFile, 'utf8')) as { enabled?: unknown }
      if (typeof parsed.enabled === 'boolean') enabled = parsed.enabled
    } catch {}
    this.on = enabled
    await this.loadCalls()
    if (enabled) await this.enable().catch(() => {})
  }

  /** Stop the managed server when the plugin unloads. */
  async dispose(): Promise<void> {
    process.off('exit', this.onExit)
    await this.stopServer()
  }

  async status(): Promise<{ enabled: boolean; healthy: boolean; loaded: boolean; managed: boolean; baseUrl: string; model: string }> {
    return {
      enabled: this.enabled(),
      healthy: await this.healthy(),
      loaded: this.loaded,
      managed: this.child !== undefined,
      baseUrl: this.config.baseUrl.get(),
      model: this.config.model.get(),
    }
  }

  /** Latest authoritative decision recorded for one assistant message. */
  decisionFor(messageId: string): { verdict: string; composite: number | null; at: string; session: string; turn: number } | undefined {
    return this.recent.get(messageId)
  }

  /** Judge calls observed by this process, newest last. */
  recentCalls(input: { since?: number; messageId?: string; turn?: number; session?: string; limit?: number } = {}): LayaCallRecord[] {
    const limit = Math.min(MAX_CALLS, Math.max(1, input.limit ?? 20))
    return this.calls
      .filter(call => (input.since === undefined || call.id > input.since)
        && (input.messageId === undefined || call.messageId === input.messageId)
        && (input.turn === undefined || call.turn === input.turn)
        && (input.session === undefined || call.session === input.session))
      .slice(-limit)
  }

  /**
   * Session that most recently recorded a call for one turn number.
   *
   * The in-chat card is addressed by turn, but turn numbers restart per
   * session; the newest call is the one the live timeline is showing.
   */
  sessionForTurn(turn: number): string | undefined {
    for (let index = this.calls.length - 1; index >= 0; index -= 1) {
      const call = this.calls[index]
      if (call.turn === turn && call.session !== undefined) return call.session
    }
    return undefined
  }

  private recordCall(record: Omit<LayaCallRecord, 'id' | 'ts'>): void {
    const call = { id: this.nextCallId++, ts: new Date().toISOString(), ...record }
    this.calls.push(call)
    while (this.calls.length > MAX_CALLS) this.calls.shift()
    void this.persistCall(call)
  }

  /**
   * Load calls recorded by an earlier Host process.
   *
   * Without this the in-memory ring is the only store, so a restart empties
   * every turn card in the transcript and the judge looks like it never ran.
   */
  private async loadCalls(): Promise<void> {
    if (this.callsLoaded) return
    this.callsLoaded = true
    try {
      const kept = parseCallLines(await readFile(this.callsFile, 'utf8'))
      // A judge call can land before the load finishes; merge by id instead of
      // appending blindly so nothing is duplicated or reordered.
      const known = new Set(this.calls.map(call => call.id))
      const merged = [...kept.filter(call => !known.has(call.id)), ...this.calls]
        .sort((left, right) => left.id - right.id)
        .slice(-MAX_CALLS)
      this.calls.length = 0
      this.calls.push(...merged)
      this.nextCallId = merged.reduce((max, call) => Math.max(max, call.id + 1), 1)
    } catch {
      // No store yet, or an unreadable one: start empty.
    }
  }

  /** Append one call, compacting the file when it has grown past the ring. */
  private async persistCall(call: LayaCallRecord): Promise<void> {
    try {
      await mkdir(dirname(this.callsFile), { recursive: true })
      await appendFile(this.callsFile, `${JSON.stringify(call)}\n`)
      this.appendedSinceCompact += 1
      if (this.appendedSinceCompact >= COMPACT_AFTER) {
        this.appendedSinceCompact = 0
        await writeFile(this.callsFile, this.calls.map(entry => JSON.stringify(entry)).join('\n') + '\n')
      }
    } catch {
      // Persistence is best-effort; the live ring still serves the current Host.
    }
  }

  private settings(calibration?: LayaCalibration): DecisionSettings {
    return {
      passThreshold: this.config.passThreshold.get(),
      reviewBand: this.config.reviewBand.get(),
      vetoThreshold: this.config.vetoThreshold.get(),
      confidenceFloor: this.config.confidenceFloor.get(),
      ...calibration === undefined ? {} : { calibration },
    }
  }

  private async loadCalibration(project: string | undefined): Promise<LayaCalibration | undefined> {
    const configured = this.config.calibrationFile.get().trim()
    const file = configured.length > 0
      ? configured
      : project === undefined ? '' : join(project, '.encoder', 'decision.calibration.json')
    if (file.length === 0) return undefined
    try {
      const info = await stat(file)
      if (this.calibrationCache?.file === file && this.calibrationCache.mtimeMs === info.mtimeMs) {
        return this.calibrationCache.value
      }
      const parsed = JSON.parse(await readFile(file, 'utf8')) as LayaCalibration
      const value = typeof parsed === 'object' && parsed !== null ? parsed : undefined
      this.calibrationCache = { file, mtimeMs: info.mtimeMs, value }
      return value
    } catch {
      return undefined
    }
  }

  async enable(): Promise<void> {
    this.on = true
    this.loaded = false
    await this.persist(true)
    if (!(await this.healthy())) {
      if (!this.config.manageServer.get()) throw new Error('laya server is not running and manageServer is false')
      this.startServer()
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        if (await this.healthy()) break
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      if (!(await this.healthy())) throw new Error('laya server did not become healthy')
    }
    await this.warmup()
    this.loaded = true
  }

  /** Load the model into VRAM with one tiny request; the shim loads lazily. */
  private async warmup(): Promise<void> {
    const response = await fetch(`${this.config.baseUrl.get().replace(/\/+$/u, '')}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        state: { task: 'warmup' },
        questions: { warmup: { type: 'noul', instructions: 'Warmup request.' } },
      }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!response.ok) throw new Error(`laya warmup failed (${response.status})`)
  }

  async disable(): Promise<void> {
    this.on = false
    this.loaded = false
    await this.persist(false)
    await this.stopServer()
  }

  private async persist(enabled: boolean): Promise<void> {
    // The Volatile ref is read-only here; the state file is the durable switch.
    await mkdir(dirname(this.stateFile), { recursive: true })
    await writeFile(this.stateFile, JSON.stringify({ enabled }))
  }

  private startServer(): void {
    if (this.child !== undefined) return
    const command = this.config.serverCommand.get().trim()
    if (command.length === 0) throw new Error('laya serverCommand is empty')
    process.once('exit', this.onExit)
    this.child = spawn(command, {
      shell: true,
      stdio: 'ignore',
      detached: false,
      env: process.env,
    })
    this.child.on('exit', () => { this.child = undefined })
    this.child.on('error', () => { this.child = undefined })
  }

  private async stopServer(): Promise<void> {
    const child = this.child
    if (child === undefined) return
    this.child = undefined
    child.kill('SIGTERM')
    const deadline = Date.now() + 5000
    while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }

  private async healthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl.get().replace(/\/+$/u, '')}/health`, {
        signal: AbortSignal.timeout(2500),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async questions(): Promise<Record<string, unknown>> {
    const file = this.config.questionsFile.get().trim()
    if (file.length > 0) {
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
        if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
      } catch {}
    }
    return DEFAULT_QUESTIONS
  }

  /** Evaluate one turn snapshot; returns the decision or undefined when disabled/unavailable. */
  async evaluate(
    snapshot: TurnSnapshot,
    agent: unknown,
    signal?: AbortSignal,
    options: {
      kind?: 'mutation' | 'answer' | 'step'
      rateMemory?: boolean
      key?: string
      /** Step-level verdicts must never replace the turn decision. */
      authoritative?: boolean
    } = {},
  ): Promise<DecisionOutcome | undefined> {
    return this.run(snapshot, agent, signal, {
      kind: options.kind ?? (snapshot.changes.length > 0 ? 'mutation' : 'answer'),
      authoritative: options.authoritative !== false,
      rateMemory: options.rateMemory !== false,
      ...options.key === undefined ? {} : { key: options.key },
    })
  }

  /**
   * Advisory judge call (`decision_ask`). Never records a turn decision, never
   * rates memory, and never feeds the retry loop: an agent-curated snapshot
   * must not be able to clear a failed gate.
   */
  async advisory(
    snapshot: TurnSnapshot,
    agent: unknown,
    signal?: AbortSignal,
    context: { turn?: number } = {},
  ): Promise<DecisionOutcome | undefined> {
    return this.run(snapshot, agent, signal, {
      kind: 'advisory',
      authoritative: false,
      rateMemory: false,
      ...context.turn === undefined ? {} : { turn: context.turn },
    })
  }

  /**
   * Rank the hunks of a diff by likelihood of containing the bug.
   *
   * Manual/narrowing probe only: it never records a decision, never rates
   * memory, and never steers. It works whenever the shared server is healthy,
   * so a test can run even while the automatic gate is disabled.
   */
  async localize(
    input: { task: string; diff?: string; changes?: TurnSnapshot['changes'] },
    signal?: AbortSignal,
  ): Promise<LocalizationResult | undefined> {
    if (!(await this.healthy())) return undefined
    const changes = input.changes?.length
      ? input.changes
      : [{ tool: 'apply_patch', path: '', input: input.diff ?? '', output: 'applied' }]
    const diff = localizationDiff({ ...input.diff === undefined ? {} : { diff: input.diff }, changes })
    const hunks = hunksForLocalization(diff, changes)
    if (hunks.length === 0) return { top: null, hunks: [], ms: 0 }
    const criteria = Object.fromEntries(hunks.map(hunk => [
      `hunk-${hunk.index}`,
      (hunk.added.slice(0, 4).join(' / ') || hunk.header).slice(0, 160),
    ]))
    const started = Date.now()
    const baseUrl = this.config.baseUrl.get().replace(/\/+$/u, '')
    const response = await fetch(`${baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        state: {
          task: input.task,
          changes: [{ tool: 'apply_patch', input: diff, output: 'applied' }],
        },
        questions: {
          loc: {
            type: 'choice',
            instructions: 'Which diff hunk most likely contains the bug or incorrect edge case?',
            criteria,
          },
        },
      }),
      signal: AbortSignal.any([
        ...(signal === undefined ? [] : [signal]),
        AbortSignal.timeout(Math.min(this.config.timeoutMs.get(), 120_000)),
      ]),
    })
    if (!response.ok) return undefined
    const payload = await response.json() as LayaResponse
    const probabilities = payload.answers?.loc?.probabilities ?? {}
    return rankLocalization(hunks, probabilities, Date.now() - started)
  }

  private async run(
    snapshot: TurnSnapshot,
    agent: unknown,
    signal: AbortSignal | undefined,
    options: {
      kind: LayaCallRecord['kind']
      authoritative: boolean
      rateMemory: boolean
      key?: string
      /** Turn number when the caller has no `session:turn` key. */
      turn?: number
    },
  ): Promise<DecisionOutcome | undefined> {
    if (!this.enabled() || !this.loaded || !(await this.healthy())) return undefined
    const started = Date.now()
    const session = options.key?.split(':')[0]
      ?? (agent as { session?: { id?: string } } | undefined)?.session?.id
    const turn = options.turn
      ?? (options.key === undefined ? undefined : Number(options.key.split(':')[1]))
    const project = (agent as { session?: { header?: { cwd?: string } } } | undefined)?.session?.header?.cwd
    const verified = await this.verifySnapshot(snapshot, project, options.key)
    const findings = verified.findings
    const paths = [...new Set(snapshot.changes.map(change => change.path))]
    if (verified.veto) {
      const vetoes = [...new Set(findings.filter(finding => finding.severity === 'high').map(finding => finding.rule))]
      const outcome: DecisionOutcome = {
        verdict: 'fail',
        composite: null,
        margin: null,
        threshold: this.config.passThreshold.get(),
        vetoes,
        failures: [],
        missing: [],
        answers: {},
        paths,
        findings,
      }
      // A deterministic veto is still a judge result: without a record the
      // in-chat card would stay empty exactly when a rule fired.
      this.recordCall({
        kind: options.kind, authoritative: options.authoritative,
        ...session === undefined || session.length === 0 ? {} : { session },
        ...snapshot.messageId === undefined ? {} : { messageId: snapshot.messageId },
        ...turn === undefined || Number.isNaN(turn) ? {} : { turn },
        task: snapshot.task, state: { deterministic: true }, questions: {}, answers: {},
        verdict: 'fail', composite: null, margin: null,
        threshold: this.config.passThreshold.get(), missing: [], vetoes, findings,
        ms: Date.now() - started,
      })
      if (options.authoritative) {
        await this.log(project, { kind: options.kind, ...outcome, task: snapshot.task })
      }
      return outcome
    }
    const memory = project === undefined ? [] : await this.memoryContext(project, snapshot, signal)
    const state = normalizeState(snapshot, memory)
    const questions = await this.questions()
    const calibration = await this.loadCalibration(project)
    const baseUrl = this.config.baseUrl.get().replace(/\/+$/u, '')
    try {
      const response = await fetch(`${baseUrl}/v1/systemone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state, questions }),
        signal: AbortSignal.any([
          ...(signal === undefined ? [] : [signal]),
          AbortSignal.timeout(this.config.timeoutMs.get()),
        ]),
      })
      if (!response.ok) {
        this.recordCall({
          kind: options.kind, authoritative: options.authoritative,
          ...session === undefined ? {} : { session },
          ...snapshot.messageId === undefined ? {} : { messageId: snapshot.messageId },
          ...turn === undefined ? {} : { turn },
          task: snapshot.task, state, questions, answers: {},
          verdict: 'needs_review', composite: null, margin: null,
          threshold: this.config.passThreshold.get(), missing: [], vetoes: [], findings,
          ms: Date.now() - started, error: `HTTP ${response.status}`,
        })
        return undefined
      }
      const payload = await response.json() as LayaResponse
      if (payload.answers === undefined) {
        this.recordCall({
          kind: options.kind, authoritative: options.authoritative,
          ...session === undefined ? {} : { session },
          ...snapshot.messageId === undefined ? {} : { messageId: snapshot.messageId },
          ...turn === undefined ? {} : { turn },
          task: snapshot.task, state, questions, answers: {},
          verdict: 'needs_review', composite: null, margin: null,
          threshold: this.config.passThreshold.get(), missing: [], vetoes: [], findings,
          ms: Date.now() - started, error: 'malformed response',
        })
        return undefined
      }
      const outcome = decide(payload.answers, questions as never, this.settings(calibration), verified.evidencePassed)
      outcome.paths = paths
      outcome.findings = findings
      this.recordCall({
        kind: options.kind, authoritative: options.authoritative,
        ...session === undefined ? {} : { session },
        ...snapshot.messageId === undefined ? {} : { messageId: snapshot.messageId },
        ...turn === undefined ? {} : { turn },
        task: snapshot.task, state, questions, answers: payload.answers,
        verdict: outcome.verdict, composite: outcome.composite, margin: outcome.margin,
        threshold: outcome.threshold, missing: outcome.missing, vetoes: outcome.vetoes,
        findings, ...payload.usage === undefined ? {} : { usage: payload.usage },
        ...outcome.reviewOnly === true ? { reviewOnly: true } : {},
        ms: Date.now() - started,
      })
      if (!options.authoritative) return outcome
      await this.log(project, {
        kind: options.kind,
        ...outcome, usage: payload.usage, task: snapshot.task,
        session, messageId: snapshot.messageId,
      })
      if (snapshot.messageId !== undefined) {
        this.recent.set(snapshot.messageId, {
          verdict: outcome.verdict, composite: outcome.composite,
          at: new Date().toISOString(),
          session: session ?? '', turn: turn ?? 0,
        })
        while (this.recent.size > 200) this.recent.delete(this.recent.keys().next().value as string)
      }
      if (options.rateMemory) await this.rateMemory(project, memory, outcome)
      return outcome
    } catch (error) {
      this.recordCall({
        kind: options.kind, authoritative: options.authoritative,
        ...session === undefined ? {} : { session },
        ...snapshot.messageId === undefined ? {} : { messageId: snapshot.messageId },
        ...turn === undefined ? {} : { turn },
        task: snapshot.task, state, questions, answers: {},
        verdict: 'needs_review', composite: null, margin: null,
        threshold: this.config.passThreshold.get(), missing: [], vetoes: [], findings,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      })
      return undefined
    }
  }

  /** Deterministic verify lane: built-in rules, optional command, optional external scanners. */
  private async verifySnapshot(
    snapshot: TurnSnapshot,
    project: string | undefined,
    turnKey?: string,
  ): Promise<{ findings: VerifyFinding[]; veto: boolean; evidencePassed: boolean }> {
    const disable = this.config.verifyDisable.get()
    const changes: VerifyChange[] = [
      ...snapshot.changes.map((change) => {
        let diff = ''
        if (change.diff !== undefined) {
          try {
            const parsed = JSON.parse(change.diff) as { oldText?: string | null; newText?: string | null }[]
            diff = parsed.map((file) => diffLines(file.oldText ?? '', file.newText ?? '')
              .flatMap((part) => part.added
                ? part.value.split('\n').filter(Boolean).map(line => `+${line}`)
                : part.removed ? part.value.split('\n').filter(Boolean).map(line => `-${line}`) : [])
              .join('\n')).join('\n')
          } catch {}
        }
        return { tool: change.tool, input: change.input, output: change.output, diff, paths: change.path ? [change.path] : [] }
      }),
      ...snapshot.grounding.filter(item => item.tool === 'bash').map(item => ({ tool: 'bash', input: item.input ?? '', output: item.output })),
    ]
    const verified = verifyChanges(changes, { disable })
    // The pack adds failure modes the built-in rules do not cover; it shares the
    // same finding shape, so a high-severity hit vetoes exactly like a built-in one.
    const extra = verifyExtraChanges(changes, {
      disable,
      ...project === undefined ? {} : { root: project },
    })
    const advice = verifyAnswer(snapshot.answer, { disable })
    const findings = [...verified.findings, ...extra, ...advice.findings]
    let veto = verified.veto || extra.some(finding => finding.severity === 'high') || advice.veto

    const command = this.config.verifyCommand.get().trim()
    let commandPassed = false
    if (command.length > 0 && project !== undefined) {
      const cached = this.verifyCache.get(project)
      if (cached === undefined || Date.now() - cached.at > 30_000) {
        const run = await runVerifyCommand(command, project).catch(() => undefined)
        const entry = { at: Date.now(), findings: run?.findings ?? [], veto: run?.findings.some(finding => finding.severity === 'high') ?? false }
        commandPassed = run !== undefined && entry.findings.length === 0
        this.verifyCache.set(project, entry)
        findings.push(...entry.findings)
        veto = veto || entry.veto
      } else {
        findings.push(...cached.findings)
        veto = veto || cached.veto
        commandPassed = !cached.veto && cached.findings.length === 0
      }
    }

    const external = this.config.verifyExternal.get()
    if (external !== 'off' && project !== undefined && turnKey !== undefined) {
      const paths = snapshot.changes.map(change => change.path).filter(path => path.length > 0)
      const scanned = await verifyExternalFiles(paths.map(path => isAbsolute(path) ? path : join(project, path)), {
        cwd: project,
        external,
        disable,
      }).catch(() => [])
      findings.push(...scanned)
      veto = veto || scanned.some(finding => finding.severity === 'high')
    }
    const evidencePassed =
      !veto && (commandPassed || executionEvidence(changes).some(entry => entry.status === 'pass'))
    return { findings: findings.slice(0, 20), veto, evidencePassed }
  }

  /**
   * Step-level check: deterministic rules, plus the judge when `stepChecks` is
   * full. Returns corrective feedback only for new findings, bounded per turn.
   */
  async checkStep(input: {
    snapshot: TurnSnapshot
    agent: unknown
    signal: AbortSignal
    key: string
    project?: string
  }): Promise<string | undefined> {
    if (!this.enabled() || !this.loaded) return undefined
    const mode = this.config.stepChecks.get()
    if (mode === 'off') return undefined
    if ((this.stepFeedback.get(input.key) ?? 0) >= this.config.stepMaxFeedback.get()) return undefined
    const verified = await this.verifySnapshot(input.snapshot, input.project, input.key)
    if (verified.veto) {
      const outcome: DecisionOutcome = {
        verdict: 'fail', composite: null, margin: null,
        threshold: this.config.passThreshold.get(),
        vetoes: [...new Set(verified.findings.filter(finding => finding.severity === 'high').map(finding => finding.rule))],
        failures: [], missing: [], answers: {}, paths: [], findings: verified.findings,
      }
      // Record the veto so the turn card shows the gate that actually fired,
      // not only the calls that reached the judge.
      const [session, turnText] = input.key.split(':')
      const turn = Number(turnText)
      this.recordCall({
        kind: 'step', authoritative: false,
        ...session === undefined || session.length === 0 ? {} : { session },
        ...input.snapshot.messageId === undefined ? {} : { messageId: input.snapshot.messageId },
        ...Number.isNaN(turn) ? {} : { turn },
        task: input.snapshot.task, state: { deterministic: true }, questions: {}, answers: {},
        verdict: 'fail', composite: null, margin: null,
        threshold: this.config.passThreshold.get(), missing: [],
        vetoes: outcome.vetoes, findings: verified.findings, ms: 0,
      })
      return this.stepText(outcome, input.key)
    }
    if (mode === 'veto') return undefined
    // A step verdict is feedback for the model, not the turn gate: recording it
    // as authoritative would let a mid-turn judge result overwrite the final
    // decision the badge and the turn card report.
    // Per-tool Laya calls are review-only telemetry: evaluate and record the
    // call, but never feed back. The turn-end gate remains authoritative.
    await this.evaluate(input.snapshot, input.agent, input.signal, {
      kind: 'step',
      rateMemory: false,
      key: input.key,
      authoritative: false,
    })
    return undefined
  }

  private stepText(outcome: DecisionOutcome, key: string): string | undefined {
    const seen = this.stepSeen.get(key) ?? new Set<string>()
    const signature = (outcome.findings ?? []).length > 0
      ? [...new Set(outcome.findings?.map(finding => `${finding.rule}:${finding.path ?? ''}:${finding.detail}`) ?? [])].join('|')
      : `judge:${outcome.failures.map(failure => failure.key).join(',')}:${outcome.composite?.toFixed(2) ?? 'n/a'}`
    if (signature.length === 0 || seen.has(signature)) return undefined
    seen.add(signature)
    this.stepSeen.set(key, seen)
    this.stepFeedback.set(key, (this.stepFeedback.get(key) ?? 0) + 1)
    return feedback(outcome, this.config.passThreshold.get(), outcome.paths)
  }

  /** Turn-stopping hook: evaluate and steer for one bounded retry. */
  async onTurnStopping(input: {
    agent: { steer: (message: unknown) => void; session: { header: { cwd?: string } } }
    turn: number
    signal: AbortSignal
    snapshot: TurnSnapshot
  }): Promise<void> {
    if (!this.enabled()) return
    const key = `${input.agent.session.id}:${input.turn}`
    const used = this.retries.get(key) ?? 0
    if (used >= this.config.maxRetries.get()) return
    const outcome = await this.evaluate(input.snapshot, input.agent, input.signal, { key })
    if (outcome === undefined || outcome.verdict === 'pass') return
    // A review-only outcome is noise unless the deployment opts into enforcing it.
    if (outcome.reviewOnly === true && !this.config.steerOnReview.get()) return
    this.retries.set(key, used + 1)
    const text = feedback(outcome, this.config.passThreshold.get(), outcome.paths)
    input.agent.steer(createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'laya-feedback' },
    }))
  }

  private async log(project: string | undefined, entry: unknown): Promise<void> {
    if (project === undefined || !isAbsolute(project)) return
    try {
      const dir = join(project, '.encoder')
      await mkdir(dir, { recursive: true })
      await appendFile(join(dir, 'decision-log.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), ...entry as object })}\n`)
    } catch {}
  }

  private async memoryContext(
    project: string,
    snapshot: TurnSnapshot,
    signal?: AbortSignal,
  ): Promise<{ id?: string; type?: string; title?: string; statement?: string }[]> {
    try {
      const paths = snapshot.changes.map(change => change.path)
      const query = [clip(snapshot.task, 300), ...paths].join(' ')
      let items = await this.totem.call('memory_search_tool', {
        query,
        limit: 3,
        project,
      }, signal)
      let list = Array.isArray(items) ? items : []
      if (list.length === 0) {
        items = await this.totem.call('memory_recent_tool', { limit: 3, project }, signal)
        list = Array.isArray(items) ? items : []
      }
      return list.slice(0, 3).map((item) => {
        const row = item as Record<string, unknown>
        return {
          ...typeof row.id === 'string' ? { id: row.id } : {},
          ...typeof row.type === 'string' ? { type: row.type } : {},
          ...typeof row.title === 'string' ? { title: row.title } : {},
          ...typeof row.statement === 'string' ? { statement: clip(row.statement, 400) } : {},
        }
      })
    } catch {
      return []
    }
  }

  private async rateMemory(
    project: string | undefined,
    memory: { id?: string }[],
    outcome: DecisionOutcome,
  ): Promise<void> {
    if (project === undefined) return
    for (const item of memory) {
      if (item.id === undefined) continue
      try {
        const current = await this.totem.call('memory_get_tool', { id: item.id, project }, AbortSignal.timeout(5000)) as { metadata?: Record<string, unknown> }
        const metadata = { ...(current.metadata ?? {}), decision: { verdict: outcome.verdict, composite: outcome.composite } }
        await this.totem.call('memory_update_tool', {
          id: item.id,
          metadata,
          reason: 'laya decision rating',
          project,
        }, AbortSignal.timeout(5000))
      } catch {}
    }
  }
}

/** Register the model-facing decision tool; hidden while the engine is disabled. */
/** Read the turn number a session is currently on, when the caller tracks it. */
export type CurrentTurn = (agent: unknown) => number | undefined

export function registerLayaTool(ctx: Context, engine: LayaEngine, currentTurn?: CurrentTurn): void {
  ctx.tools.register(defineTool({
    name: 'decision_ask',
    description: 'Advisory only. Ask the local Laya decision judge to inspect a coding turn. Provide the task and optional answer/changes/tool calls; returns an advisory verdict, composite, failing criteria, and the raw answers. This never counts as the turn gate and cannot pass a failed turn.',
    parameters: {
      task: { type: 'string', required: true, description: 'The user task being judged.' },
      answer: { type: 'string', description: 'The assistant answer text.' },
      changes: { type: 'array', items: { type: 'json' }, description: 'Changed files: {tool,path,input,output,diff?}.' },
      toolCalls: { type: 'array', items: { type: 'json' }, description: 'Tool calls: {name,arguments}.' },
      memory: { type: 'json', description: 'Optional memory context items.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{
      type: 'text',
      text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    }] },
    async execute(args, exec) {
      const snapshot: TurnSnapshot = {
        task: args.task,
        answer: args.answer ?? '',
        toolCalls: (args.toolCalls ?? []) as { name: string; arguments: string }[],
        changes: (args.changes ?? []) as TurnSnapshot['changes'],
        grounding: [],
      }
      const turn = currentTurn?.(exec.agent)
      const result = await engine.advisory(
        snapshot,
        exec.agent,
        exec.signal,
        turn === undefined ? {} : { turn },
      )
      if (result === undefined) throw new Error('laya engine is disabled or unavailable')
      return { ...result, authoritative: false, note: 'Advisory only; the turn gate is the authoritative decision.' }
    },
  }), { when: () => engine.enabled() })

  ctx.tools.register(defineTool({
    name: 'laya_localize',
    description: 'Manual narrowing probe. Rank the hunks of a diff by likelihood of containing the bug using Laya. Returns every hunk with a score and the top hunk. Never gates or steers the turn.',
    parameters: {
      task: { type: 'string', required: true, description: 'The bug/issue description or the task being narrowed.' },
      diff: { type: 'string', description: 'Unified diff to rank. Omit when passing changes.' },
      changes: { type: 'array', items: { type: 'json' }, description: 'Changed files: {tool,path,input,output,diff?}.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{
      type: 'text',
      text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    }] },
    async execute(args, exec) {
      if ((args.diff ?? '').trim().length === 0 && (args.changes ?? []).length === 0) {
        throw new Error('provide diff or changes')
      }
      const result = await engine.localize({
        task: args.task,
        diff: args.diff,
        changes: (args.changes ?? []) as TurnSnapshot['changes'],
      }, exec.signal)
      if (result === undefined) throw new Error('laya server is unavailable')
      return { ...result, note: 'Manual localization only; the turn gate is unchanged.' }
    },
  }), { when: () => engine.enabled() })
}
