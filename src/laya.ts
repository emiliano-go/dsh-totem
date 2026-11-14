/** Laya decision engine: managed HTTP server, turn evaluation, feedback, and logging. */
import { spawn, type ChildProcess } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Volatile } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { diffLines } from 'diff'
import { verifyAnswer, verifyChanges, verifyExternalFiles, runVerifyCommand, type VerifyChange, type VerifyFinding } from './verify.ts'
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
  vetoes: string[]
  failures: Failure[]
  answers: Record<string, LayaAnswer>
  bugClass?: string
  paths: string[]
  findings?: VerifyFinding[]
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

const WEIGHTS: Record<string, number> = { requirements_met: 0.4, no_unrelated_changes: 0.25, bug_risk: 0.25, unsafe_patterns: 0.1 }

/** Config fields the engine reads live. */
export interface LayaConfig {
  enabled: Volatile<boolean>
  baseUrl: Volatile<string>
  serverCommand: Volatile<string>
  manageServer: Volatile<boolean>
  passThreshold: Volatile<number>
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
  if (answer.noul === undefined) return null
  return Math.min(Math.max(answer.noul, 0), 1)
}

export function decide(
  answers: Record<string, LayaAnswer>,
  questions: Record<string, { instructions?: string; criteria?: unknown }>,
  threshold: number,
): DecisionOutcome {
  const entries: { key: string; value: number; weight: number }[] = []
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const answer = answers[key]
    if (answer === undefined) continue
    const value = valueOf(key, answer)
    if (value !== null) entries.push({ key, value, weight })
  }
  const weight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  const composite = weight === 0 ? null : entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weight
  const vetoes = entries.filter(entry => entry.value < 0.5).map(entry => entry.key)
  const failures: Failure[] = []
  for (const entry of entries) {
    if (entry.value >= 0.5) continue
    const answer = answers[entry.key]
    const raw = answer?.score ?? answer?.noul
    const distribution = answer?.probabilities
    const criterion = distribution !== undefined && raw !== undefined
      ? (String(Math.round(raw)) in distribution ? String(Math.round(raw)) : Object.keys(distribution).sort((a, b) => (distribution[b] ?? 0) - (distribution[a] ?? 0))[0])
      : raw === undefined ? undefined : String(raw)
    failures.push({
      key: entry.key,
      instructions: questions[entry.key]?.instructions ?? '',
      observed: raw,
      confidence: answer?.confidence,
      ...criterion === undefined ? {} : { criterion },
      ...distribution === undefined ? {} : { distribution },
    })
  }
  const bugAnswer = answers.bug_class
  const bugClass = bugAnswer !== undefined && typeof bugAnswer.choice === 'string' && (bugAnswer.confidence ?? 0) >= 0.6
    ? bugAnswer.choice
    : undefined
  const verdict = composite === null ? 'needs_review'
    : vetoes.length > 0 || composite < threshold ? 'fail'
      : 'pass'
  return { verdict, composite, vetoes, failures, answers, ...bugClass === undefined ? {} : { bugClass }, paths: [], findings: [] }
}

export function feedback(state: DecisionOutcome, threshold: number, paths: string[]): string {
  const score = state.composite === null ? 'n/a' : state.composite.toFixed(2)
  const lines = state.failures.map((failure) => {
    const observed = failure.observed === undefined ? 'n/a' : failure.observed
    const criterion = failure.criterion === undefined ? '' : `, criterion: ${failure.criterion}`
    const distribution = failure.distribution === undefined ? '' : `\n  distribution: ${JSON.stringify(failure.distribution)}`
    return `- ${failure.key}: ${failure.instructions} (observed: ${observed}${criterion}, confidence: ${failure.confidence ?? 'n/a'})${distribution}`
  })
  const findings = state.findings ?? []
  return [
    `Decision engine evaluation of your last changes failed (composite ${score} < ${threshold}).`,
    ...findings.length === 0 ? [] : ['Deterministic checks flagged:', ...findings.map(finding => `- ${finding.rule}: ${finding.detail}`)],
    ...state.vetoes.length === 0 ? [] : [`Vetoed criteria: ${state.vetoes.join(', ')}.`],
    ...state.bugClass === undefined || state.bugClass === 'none' ? [] : [`Likely bug class: ${state.bugClass}`],
    ...paths.length === 0 ? [] : [`Changed files: ${paths.slice(0, 5).join(', ')}`],
    'Address the following issues before finishing:',
    ...lines,
    'Make the minimal changes needed to resolve them, then stop.',
  ].join('\n')
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n[...truncated]`
}

/** Managed laya HTTP server plus the turn evaluation hook. */
export class LayaEngine {
  private child: ChildProcess | undefined
  private on = false
  private loaded = false
  private readonly recent = new Map<string, { verdict: string; composite: number | null; at: string; session: string; turn: number }>()
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

  /** Latest decision recorded for one assistant message. */
  decisionFor(messageId: string): { verdict: string; composite: number | null; at: string; session: string; turn: number } | undefined {
    return this.recent.get(messageId)
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
    options: { kind?: 'mutation' | 'answer' | 'step'; rateMemory?: boolean; key?: string } = {},
  ): Promise<DecisionOutcome | undefined> {
    if (!this.enabled() || !this.loaded || !(await this.healthy())) return undefined
    const project = (agent as { session?: { header?: { cwd?: string } } } | undefined)?.session?.header?.cwd
    const verified = await this.verifySnapshot(snapshot, project, options.key)
    const findings = verified.findings
    if (verified.veto) {
      const vetoes = [...new Set(findings.filter(finding => finding.severity === 'high').map(finding => finding.rule))]
      const outcome: DecisionOutcome = {
        verdict: 'fail',
        composite: null,
        vetoes,
        failures: [],
        answers: {},
        paths: [...new Set(snapshot.changes.map(change => change.path))],
        findings,
      }
      await this.log(project, { kind: options.kind ?? (snapshot.changes.length > 0 ? 'mutation' : 'answer'), ...outcome, task: snapshot.task })
      return outcome
    }
    const memory = project === undefined ? [] : await this.memoryContext(project, snapshot, signal)
    const state = {
      task: clip(snapshot.task, 400),
      memory,
      changes: snapshot.changes.map(change => ({
        tool: change.tool,
        path: change.path,
        input: clip(change.input, 1200),
        output: clip(change.output, 800),
        ...change.diff === undefined ? {} : { diff: clip(change.diff, 2000) },
      })),
      answer: clip(snapshot.answer, 1200),
      toolCalls: snapshot.toolCalls.slice(-20).map(call => ({ name: call.name, arguments: clip(call.arguments, 600) })),
      grounding: snapshot.grounding.slice(-5).map(item => ({ tool: item.tool, output: clip(item.output, 800) })),
    }
    const questions = await this.questions()
    const response = await fetch(`${this.config.baseUrl.get().replace(/\/+$/u, '')}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, questions }),
      signal: AbortSignal.any([
        ...(signal === undefined ? [] : [signal]),
        AbortSignal.timeout(this.config.timeoutMs.get()),
      ]),
    })
    if (!response.ok) return undefined
    const payload = await response.json() as LayaResponse
    if (payload.answers === undefined) return undefined
    const outcome = decide(payload.answers, questions as never, this.config.passThreshold.get())
    outcome.paths = [...new Set(snapshot.changes.map(change => change.path))]
    outcome.findings = findings
    await this.log(project, {
      kind: options.kind ?? (snapshot.changes.length > 0 ? 'mutation' : 'answer'),
      ...outcome, usage: payload.usage, task: snapshot.task,
      session: options.key?.split(':')[0], messageId: snapshot.messageId,
    })
    if (snapshot.messageId !== undefined) {
      this.recent.set(snapshot.messageId, {
        verdict: outcome.verdict, composite: outcome.composite,
        at: new Date().toISOString(),
        session: options.key?.split(':')[0] ?? '', turn: Number(options.key?.split(':')[1] ?? 0),
      })
      while (this.recent.size > 200) this.recent.delete(this.recent.keys().next().value as string)
    }
    if (options.rateMemory !== false) await this.rateMemory(project, memory, outcome)
    return outcome
  }

  /** Deterministic verify lane: built-in rules, optional command, optional external scanners. */
  private async verifySnapshot(
    snapshot: TurnSnapshot,
    project: string | undefined,
    turnKey?: string,
  ): Promise<{ findings: VerifyFinding[]; veto: boolean }> {
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
    const advice = verifyAnswer(snapshot.answer, { disable })
    const findings = [...verified.findings, ...advice.findings]
    let veto = verified.veto || advice.veto

    const command = this.config.verifyCommand.get().trim()
    if (command.length > 0 && project !== undefined) {
      const cached = this.verifyCache.get(project)
      if (cached === undefined || Date.now() - cached.at > 30_000) {
        const run = await runVerifyCommand(command, project).catch(() => undefined)
        const entry = { at: Date.now(), findings: run?.findings ?? [], veto: run?.findings.some(finding => finding.severity === 'high') ?? false }
        this.verifyCache.set(project, entry)
        findings.push(...entry.findings)
        veto = veto || entry.veto
      } else {
        findings.push(...cached.findings)
        veto = veto || cached.veto
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
    return { findings: findings.slice(0, 20), veto }
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
        verdict: 'fail', composite: null,
        vetoes: [...new Set(verified.findings.filter(finding => finding.severity === 'high').map(finding => finding.rule))],
        failures: [], answers: {}, paths: [], findings: verified.findings,
      }
      return this.stepText(outcome, input.key)
    }
    if (mode === 'veto') return undefined
    const outcome = await this.evaluate(input.snapshot, input.agent, input.signal, { kind: 'step', rateMemory: false, key: input.key })
    if (outcome === undefined || outcome.verdict === 'pass') return undefined
    return this.stepText(outcome, input.key)
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
export function registerLayaTool(ctx: Context, engine: LayaEngine): void {
  ctx.tools.register(defineTool({
    name: 'decision_ask',
    description: 'Ask the local Laya decision judge to evaluate a coding turn. Provide the task and optional answer/changes/tool calls; returns verdict, composite, failing criteria, and the raw per-question answers.',
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
      const result = await engine.evaluate(snapshot, exec.agent, exec.signal)
      if (result === undefined) throw new Error('laya engine is disabled or unavailable')
      return result
    },
  }), { when: () => engine.enabled() })
}
