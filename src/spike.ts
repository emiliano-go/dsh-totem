/**
 * Solution tournaments: three small MVPs built in disposable directories, judged
 * by one harness-owned measurement, before any of them reaches the project.
 *
 * The model writes the candidates. It does not decide how many there are, how
 * long each may take, what counts as better, or which one wins — those are code,
 * so the elimination step cannot be a thought.
 *
 * Everything mechanical lives here: criteria validation, the fixed briefs, the
 * timebox, the shared measurement, the arithmetic ranking, and the record that
 * makes calibration possible later (including every timeout).
 *
 * @module dsh-totem/spike
 */
import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemService } from './service.ts'

/** One thing the winner must be better at. */
export interface SpikeCriterion {
  readonly name: string
  /** `pass` is a hard gate: a candidate that fails it is disqualified. */
  readonly direction: 'min' | 'max' | 'pass'
  readonly weight: number
}

/** The three angles, fixed so the candidates are not three drafts of one idea. */
export const ANGLES = [
  'the simplest thing that could possibly work: fewest moving parts, no new dependencies, boring and obviously correct',
  'the one optimised for the first criterion above all else: accept extra complexity where it buys a better measured number',
  'the unconventional one: a different architecture or data model from the other two, chosen for a property they ignore',
] as const

/** What one candidate produced. */
export interface SpikeCandidate {
  readonly id: string
  readonly angle: string
  readonly dir: string
  readonly elapsedMs: number
  /** True when the timebox stopped it; recorded so the budget can be tuned. */
  readonly timedOut: boolean
  readonly error?: string
  readonly measurements?: Record<string, number | boolean>
  readonly files: number
  readonly loc: number
}

/** A finished tournament. */
export interface SpikeRun {
  readonly id: string
  readonly question: string
  readonly criteria: SpikeCriterion[]
  readonly measure?: string
  /** True when one harness-owned benchmark measured every candidate. */
  readonly comparable: boolean
  readonly timeboxMs: number
  readonly candidates: SpikeCandidate[]
  readonly ranking: { id: string; score: number; qualified: boolean; reasons: string[] }[]
  readonly winner?: string
}

/** Reject prose criteria: "feels cleaner" cannot be measured. */
export function parseCriteria(input: unknown): SpikeCriterion[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('criteria must be a non-empty array')
  return input.map((raw, index) => {
    const entry = raw as { name?: unknown; direction?: unknown; weight?: unknown }
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (name.length === 0) throw new Error(`criteria[${index}] needs a name`)
    if (!/^[a-z][a-z0-9_]*$/u.test(name)) {
      throw new Error(`criteria[${index}] name "${name}" must be a measurement key like p95_ms or deps`)
    }
    const direction = entry.direction
    if (direction !== 'min' && direction !== 'max' && direction !== 'pass') {
      throw new Error(`criteria[${index}] direction must be min, max or pass`)
    }
    const weight = typeof entry.weight === 'number' && Number.isFinite(entry.weight) && entry.weight > 0 ? entry.weight : 1
    return { name, direction, weight }
  })
}

/** The brief every worker gets; identical except for its angle and its directory. */
export function buildBrief(input: {
  question: string
  angle: string
  criteria: SpikeCriterion[]
  measure?: string
  dir: string
  timeboxMs: number
  contract?: string
  harnessed?: boolean
}): string {
  const lines = [
    `# Solution tournament candidate`,
    ``,
    `Question: ${input.question}`,
    ``,
    `Your angle: ${input.angle}`,
    ``,
    `Work only inside ${input.dir} — use that absolute path for every file you create. Do not read or write the rest of the project repository.`,
    `Build the smallest runnable MVP that settles this question from your angle — a few files, no polish, no tests beyond one smoke check.`,
    `That directory is the deliverable: leave the MVP runnable, plus a RESULT.md saying what you chose and the dependencies.`,
    `You have ${Math.round(input.timeboxMs / 60_000)} minutes. A rough MVP that exists beats a careful one that does not.`,
  ]
  if (input.contract !== undefined && input.contract.trim().length > 0) {
    lines.push(
      ``,
      `The harness owns the benchmark. Implement your approach in impl.ts satisfying exactly this contract:`,
      '```ts',
      input.contract.trim(),
      '```',
      input.harnessed === true
        ? `bench.ts is provided by the harness, identical for every candidate, and restored before measuring. Do not edit it and do not write your own benchmark.`
        : `Do not write your own benchmark if a bench.ts is present.`,
    )
  } else if (input.measure !== undefined && input.measure.trim().length > 0) {
    lines.push(
      ``,
      `The harness will run this inside your directory and read one JSON object from stdout:`,
      '```',
      input.measure.trim(),
      '```',
    )
  }
  lines.push(
    ``,
    `Keys it will read: ${input.criteria.map(criterion => criterion.name).join(', ')} (plus files and loc, computed by the harness).`,
    `Print exactly one JSON object (compact or indented, both are fine) with a number for every min/max key, and \`true\` or a non-zero count for every pass key. Anything else reads as "not measured" and disqualifies you.`,
  )
  return lines.join('\n')
}

/** Count source files and lines in a candidate directory. */
export async function inspectDir(dir: string): Promise<{ files: number; loc: number }> {
  let files = 0
  let loc = 0
  const walk = async (current: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
        continue
      }
      if (!/\.(?:[cm]?[jt]sx?|py|rs|go|css|html|json|md)$/u.test(entry.name)) continue
      files += 1
      if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) continue
      try {
        loc += (await readFile(path, 'utf8')).replace(/\n$/u, '').split('\n').length
      } catch {
        // Unreadable file: it still counts as a file.
      }
    }
  }
  try {
    if (!(await stat(dir)).isDirectory()) return { files: 0, loc: 0 }
    await walk(dir)
  } catch {
    return { files: 0, loc: 0 }
  }
  return { files, loc }
}

/**
 * Rank by per-criterion rank sums: scale-free, so a 42 ms p95 and 3 deps can be
 * compared without inventing normalisation. Lowest score wins; `pass` criteria
 * disqualify instead of scoring.
 */
export function rank(candidates: readonly SpikeCandidate[], criteria: readonly SpikeCriterion[]): SpikeRun['ranking'] {
  const entries = candidates.map(candidate => ({
    candidate,
    score: 0,
    /** Per-criterion rank, in criterion order: the tie-break. */
    ranks: [] as number[],
    reasons: [] as string[],
    qualified: true,
  }))
  for (const criterion of criteria) {
    if (criterion.direction === 'pass') {
      for (const entry of entries) {
        const value = entry.candidate.measurements?.[criterion.name]
        // A pass criterion may be proved by the boolean or by a non-zero count:
        // `indexed: 20000` is a stronger proof than `indexed: true`.
        const satisfied = value === true || (typeof value === 'number' && value > 0)
        if (!satisfied) {
          entry.qualified = false
          entry.reasons.push(`${criterion.name}: not satisfied`)
        }
      }
      continue
    }
    const present = entries.filter(entry => typeof entry.candidate.measurements?.[criterion.name] === 'number')
    const ordered = [...present].sort((a, b) => {
      const left = a.candidate.measurements?.[criterion.name] as number
      const right = b.candidate.measurements?.[criterion.name] as number
      return criterion.direction === 'min' ? left - right : right - left
    })
    // Equal measurements share a rank. Assigning distinct ranks to a tie lets
    // iteration order decide a criterion, which is the model's taste sneaking
    // back in through the sort.
    let rank = 0
    let previous: number | undefined
    ordered.forEach((entry, index) => {
      const value = entry.candidate.measurements?.[criterion.name] as number
      if (previous === undefined || value !== previous) rank = index
      previous = value
      entry.score += rank * criterion.weight
      entry.ranks.push(rank)
      if (rank === 0) {
        entry.reasons.push(`${criterion.name}: best (${String(value)})`)
      }
    })
    for (const entry of entries) {
      if (!present.includes(entry)) {
        entry.qualified = false
        entry.reasons.push(`${criterion.name}: missing`)
      }
    }
  }
  const lexicographic = (a: number[], b: number[]): number => {
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      if (a[index] !== b[index]) return a[index]! - b[index]!
    }
    return a.length - b.length
  }
  return entries
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || a.score - b.score || lexicographic(a.ranks, b.ranks))
    .map(entry => ({ id: entry.candidate.id, score: entry.score, qualified: entry.qualified, reasons: entry.reasons }))
}

/**
 * Pull measurements out of a command's stdout.
 *
 * Three shapes occur in practice: one compact object on one line, a
 * pretty-printed object spanning many lines, and a compact object printed after
 * a line of noise. All three are measurements; only the first used to be read,
 * which silently disqualified every candidate that formatted its JSON.
 * @param stdout - the command's captured output.
 */
export function readMeasurements(stdout: string): Record<string, number | boolean> {
  const settle = (value: unknown): Record<string, number | boolean> | undefined => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    const clean: Record<string, number | boolean> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === 'number' || typeof entry === 'boolean') clean[key] = entry
    }
    return Object.keys(clean).length > 0 ? clean : undefined
  }

  const text = stdout.trim()
  try {
    const whole = settle(JSON.parse(text))
    if (whole !== undefined) return whole
  } catch {
    // Not one object from start to finish; look for the last balanced object.
  }

  for (let end = text.lastIndexOf('}'); end >= 0; end = text.lastIndexOf('}', end - 1)) {
    let depth = 0
    for (let start = end; start >= 0; start -= 1) {
      const char = text[start]
      if (char === '}') depth += 1
      else if (char === '{') {
        depth -= 1
        if (depth === 0) {
          try {
            const candidate = settle(JSON.parse(text.slice(start, end + 1)))
            if (candidate !== undefined) return candidate
          } catch {
            // Keep walking back: this brace pair is not valid JSON.
          }
          break
        }
      }
    }
  }
  return {}
}

/**
 * Run a command in a directory with a hard timeout.
 *
 * `node:child_process`, not `Bun.spawn`: the host may be Node, where `Bun` does
 * not exist, and a swallowed ReferenceError is indistinguishable from a
 * measurement that printed nothing.
 */
export function runCommand(command: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise(resolve => {
    const child = spawn('bash', ['-lc', command], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let settled = false
    const finish = (value: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(stdout)
    }, timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { stdout += chunk })
    child.on('error', () => finish(stdout))
    child.on('close', () => finish(stdout))
  })
}

/** What the tool needs from the host. */
export interface SpikeDeps {
  readonly subagents?: {
    startActivation(spec: {
      provider: string
      label: string
      request: {
        prompt: { type: 'text'; text: string }[]
        parent: unknown
        signal: AbortSignal
        cwd: string
      }
      signal: AbortSignal
      delivery: 'caller'
    }): Promise<{
      result: Promise<{ output: readonly { type: string; text?: string }[]; stopReason: string }>
      dispose(): Promise<void>
    }>
  }
}

/** Run one tournament and return its record. */
export async function runSpike(
  deps: SpikeDeps,
  options: {
    question: string
    criteria: SpikeCriterion[]
    measure?: string
    harness?: string
    contract?: string
    candidates?: number
    timeboxMs?: number
    parent: unknown
    signal?: AbortSignal
    /** Directory the workspaces are created under; defaults to the process cwd. */
    workspace?: string
  },
): Promise<SpikeRun> {
  if (deps.subagents === undefined) throw new Error('the subagents service is not mounted; the tournament needs it to run candidates')
  const candidates = Math.max(1, Math.min(options.candidates ?? 3, 5))
  const timeboxMs = options.timeboxMs ?? 600_000
  const id = `spike-${Date.now().toString(36)}`
  // Candidates live inside the session workspace, which is the only place the
  // file sandbox lets a child write. Outside it they silently produce nothing.
  const workspace = options.workspace ?? process.cwd()
  const root = join(workspace, '.spike', id)

  const results: SpikeCandidate[] = []
  await Promise.all(
    Array.from({ length: candidates }, async (_unused, index) => {
      const angle = ANGLES[index % ANGLES.length] as string
      const dir = join(root, `${index + 1}`)
      await mkdir(dir, { recursive: true })
      const harnessed = options.harness !== undefined && options.harness.trim().length > 0
      const brief = buildBrief({
        question: options.question,
        angle,
        criteria: options.criteria,
        measure: options.measure,
        dir,
        timeboxMs,
        ...options.contract === undefined ? {} : { contract: options.contract },
        harnessed,
      })
      await writeFile(join(dir, 'BRIEF.md'), brief, 'utf8')
      if (options.contract !== undefined && options.contract.trim().length > 0) {
        const commented = options.contract.trim().split('\n').map(line => `// ${line}`).join('\n')
        await writeFile(join(dir, 'impl.ts'), `// Implement the contract below. The harness imports this module.\n//\n${commented}\n`, 'utf8')
      }
      if (harnessed) await writeFile(join(dir, 'bench.ts'), options.harness as string, 'utf8')

      const controller = new AbortController()
      const started = Date.now()
      const timer = setTimeout(() => controller.abort(new Error('timebox')), timeboxMs)
      const candidate: SpikeCandidate = {
        id: `c${index + 1}`,
        angle,
        dir: relative(process.cwd(), dir),
        elapsedMs: 0,
        timedOut: false,
        files: 0,
        loc: 0,
      }
      try {
        const activation = await deps.subagents!.startActivation({
          provider: 'fork',
          label: `spike ${index + 1}`,
          request: {
            prompt: [{ type: 'text', text: brief }],
            parent: options.parent,
            signal: controller.signal,
            cwd: dir,
          },
          signal: options.signal ?? controller.signal,
          delivery: 'caller',
        })
        try {
          await activation.result
        } finally {
          await activation.dispose().catch(() => undefined)
        }
      } catch (error) {
        candidate.timedOut = controller.signal.aborted
        if (!candidate.timedOut) candidate.error = (error as Error)?.message ?? String(error)
      } finally {
        clearTimeout(timer)
      }
      candidate.elapsedMs = Date.now() - started
      const stats = await inspectDir(dir)
      let measurements: Record<string, number | boolean> | undefined
      if (harnessed) await writeFile(join(dir, 'bench.ts'), options.harness as string, 'utf8')
      const command = harnessed ? 'bun run bench.ts' : options.measure
      if (command !== undefined && command.trim().length > 0) {
        const raw = await runCommand(command, dir, Math.min(timeboxMs, 120_000))
        measurements = readMeasurements(raw)
        if (Object.keys(measurements).length === 0 && candidate.error === undefined) {
          candidate.error = 'the measurement command printed no JSON object'
        }
      }
      results.push({ ...candidate, ...stats, files: stats.files, loc: stats.loc, ...measurements === undefined ? {} : { measurements } })
    }),
  )

  const measured = results.map(candidate => ({
    ...candidate,
    measurements: { files: candidate.files, loc: candidate.loc, ...candidate.measurements },
  }))
  const ranking = rank(measured, options.criteria)
  const run: SpikeRun = {
    id,
    question: options.question,
    criteria: options.criteria,
    comparable: options.harness !== undefined && options.harness.trim().length > 0,
    ...options.measure === undefined ? {} : { measure: options.measure },
    timeboxMs,
    candidates: measured,
    ranking,
    ...ranking[0]?.qualified === true ? { winner: ranking[0].id } : {},
  }
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'run.json'), JSON.stringify(run, null, 2), 'utf8')
  return run
}

/** Render the record as the table the model and the human read. */
export function renderSpike(run: SpikeRun): string {
  const lines = [`## ${run.id}: ${run.question}`, '']
  lines.push(`| candidate | angle | time | files | loc | verdict |`)
  lines.push(`| --- | --- | --- | --- | --- | --- |`)
  for (const candidate of run.candidates) {
    const rank = run.ranking.find(entry => entry.id === candidate.id)
    const verdict = candidate.timedOut
      ? `timed out at ${Math.round(run.timeboxMs / 60_000)}m`
      : candidate.error !== undefined
        ? `failed: ${candidate.error}`
        : rank?.qualified === false
          ? 'disqualified'
          : candidate.id === run.winner ? 'winner' : 'qualified'
    lines.push(`| ${candidate.id} | ${candidate.angle.slice(0, 60)}… | ${Math.round(candidate.elapsedMs / 1000)}s | ${candidate.files} | ${candidate.loc} | ${verdict} |`)
  }
  lines.push('')
  lines.push(`winner: ${run.winner ?? 'none qualified'} — implement this, or state in one line why you deviate.`)
  if (!run.comparable) lines.push('comparability: each candidate supplied its own benchmark, so the numbers may measure different workloads.')
  for (const entry of run.ranking) lines.push(`- ${entry.id}: score ${entry.score}${entry.reasons.length > 0 ? ` (${entry.reasons.join('; ')})` : ''}`)
  return lines.join('\n')
}

/** Register the model-facing tool. */
export function registerSpikeTool(ctx: import('@deepseek-ai/cordis').Context, totem: TotemService): void {
  ctx.tools.register(defineTool({
    name: 'spike',
    description:
      'Settle a design question by building three small MVPs in disposable directories and measuring all three, instead of choosing from memory. Use before implementing performance- or security-sensitive decisions, or whenever several approaches look plausible. Returns a ranked table; the winners and losers are stored.',
    parameters: {
      question: { type: 'string', required: true, description: 'The decision to settle, in one sentence.' },
      criteria: {
        type: 'array',
        required: true,
        description: 'Measurable criteria: name is a measurement key, direction is min/max/pass.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            direction: { type: 'string', enum: ['min', 'max', 'pass'], required: true },
            weight: { type: 'number' },
          },
        },
      },
      measure: {
        type: 'string',
        description: 'Command run inside every candidate directory; it must print one JSON object with a value per criterion key. Ignored when harness is given.',
      },
      harness: {
        type: 'string',
        description: 'Source of the benchmark written as bench.ts into every candidate and restored before measuring, so all candidates share one instrument.',
      },
      contract: {
        type: 'string',
        description: 'The exact TypeScript interface each candidate must implement in impl.ts.',
      },
      candidates: { type: 'number', description: 'How many MVPs to build (2-5, default 3).' },
      timeboxMinutes: { type: 'number', description: 'Per-candidate budget in minutes (default 10).' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args: unknown, value: unknown) => [{
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      }],
    },
    async execute(args: {
      question: string
      criteria: unknown
      measure?: string
      harness?: string
      contract?: string
      candidates?: number
      timeboxMinutes?: number
    }, exec: { agent?: unknown; signal?: AbortSignal }) {
      const criteria = parseCriteria(args.criteria)
      const subagents = (ctx.get('subagents') ?? undefined) as SpikeDeps['subagents']
      const run = await runSpike({ subagents }, {
        question: args.question,
        criteria,
        ...args.measure === undefined ? {} : { measure: args.measure },
        ...args.harness === undefined ? {} : { harness: args.harness },
        ...args.contract === undefined ? {} : { contract: args.contract },
        ...args.candidates === undefined ? {} : { candidates: args.candidates },
        timeboxMs: (args.timeboxMinutes ?? totem.config.spikeTimeoutMs.get() / 60_000) * 60_000,
        parent: exec.agent,
        workspace: (exec.agent as { session?: { header?: { cwd?: string } } } | undefined)?.session?.header?.cwd,
        ...exec.signal === undefined ? {} : { signal: exec.signal },
      })
      return renderSpike(run)
    },
  }))
}

/** Prompt text stating when the tournament is expected. */
export const SPIKE_PROMPT = `## Solution tournaments

When a decision has more than one plausible answer — a storage strategy, a cache invalidation rule, an auth flow, a query shape — do not choose by reasoning alone: call \`spike\` with the question, the criteria that matter, and a measurement command. It builds three independent MVPs in disposable directories, measures all three with the same command, and returns a ranked table. Performance and security forks always go through it before implementation. Implementation follows the winner; deviating from it requires one line in the reply saying why, and every timeout is recorded so the budget can be tuned.`
