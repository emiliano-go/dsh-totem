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
  /** Disqualify above this value, whatever the direction. */
  readonly atMost?: number
  /** Disqualify below this value, whatever the direction. */
  readonly atLeast?: number
}

/**
 * @deprecated The caller now supplies the approaches; kept so a caller written
 * against the fixed-angle form still imports.
 */
export const ANGLES = [
  'the simplest thing that could possibly work',
  'the one optimised for the first criterion above all else',
  'the unconventional one',
] as const

/** The minimum and maximum number of approaches a caller may propose. */
export const MIN_APPROACHES = 3
export const MAX_APPROACHES = 5

/** What one candidate produced. */
export interface SpikeCandidate {
  readonly id: string
  /** The approach this candidate was assigned to implement, verbatim. */
  readonly approach: string
  readonly dir: string
  readonly elapsedMs: number
  /** True when the timebox stopped it; recorded so the budget can be tuned. */
  readonly timedOut: boolean
  readonly error?: string
  readonly measurements?: Record<string, number | boolean>
  /** Min/max/median per criterion across the repeated runs. */
  readonly spread?: Record<string, SpikeSpread>
  readonly files: number
  readonly loc: number
}

/** A finished tournament. */
export interface SpikeRun {
  readonly id: string
  readonly question: string
  readonly criteria: SpikeCriterion[]
  readonly measure?: string
  /** The sound oracle command, when one scored the candidates. */
  readonly verify?: string
  /** True when one harness-owned benchmark measured every candidate. */
  readonly comparable: boolean
  readonly timeboxMs: number
  readonly candidates: SpikeCandidate[]
  readonly ranking: { id: string; score: number; qualified: boolean; reasons: string[] }[]
  /** Non-dominated candidates, best-known set of defensible answers. */
  readonly pareto: string[]
  readonly repeats: number
  readonly verdict: 'winner' | 'unresolved' | 'none'
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
    const atMost = typeof entry.atMost === 'number' && Number.isFinite(entry.atMost) ? entry.atMost : undefined
    const atLeast = typeof entry.atLeast === 'number' && Number.isFinite(entry.atLeast) ? entry.atLeast : undefined
    return {
      name,
      direction,
      weight,
      ...atMost === undefined ? {} : { atMost },
      ...atLeast === undefined ? {} : { atLeast },
    }
  })
}

/** The brief every worker gets; identical except for its assigned approach and its directory. */
export function buildBrief(input: {
  question: string
  approach: string
  criteria: SpikeCriterion[]
  measure?: string
  verify?: string
  dir: string
  timeboxMs: number
  contract?: string
  harnessed?: boolean
  runner?: string
}): string {
  const lines = [
    `# Solution tournament candidate`,
    ``,
    `Question: ${input.question}`,
    ``,
    `Your assigned approach — implement exactly this, do not substitute a different design:`,
    `  ${input.approach}`,
    ``,
    `Work only inside ${input.dir} — use that absolute path for every file you create. Do not read or write the rest of the project repository.`,
    `Build the smallest runnable MVP that settles this question for your assigned approach — a few files, no polish, no tests beyond one smoke check.`,
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
        ? `The benchmark is provided by the harness (${measurementCommand({ harnessed: true, ...input.runner === undefined ? {} : { runner: input.runner }, ...input.harness === undefined ? {} : { harness: input.harness } })}), identical for every candidate, and restored before measuring. Do not edit it and do not write your own benchmark.`
        : `Do not write your own benchmark if a ${harnessFileName(input.runner)} is present.`,
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
export async function inspectDir(dir: string): Promise<{ files: number; loc: number; deps: number }> {
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
    if (!(await stat(dir)).isDirectory()) return { files: 0, loc: 0, deps: 0 }
    await walk(dir)
  } catch {
    return { files: 0, loc: 0, deps: 0 }
  }
  let deps = 0
  try {
    const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, unknown> }
    deps = Object.keys(manifest.dependencies ?? {}).length
  } catch {
    // No manifest: the MVP added no dependencies.
  }
  return { files, loc, deps }
}

/**
 * Rank by per-criterion rank sums: scale-free, so a 42 ms p95 and 3 deps can be
 * compared without inventing normalisation. Lowest score wins; `pass` criteria
 * disqualify instead of scoring.
 */
/** Distribution of one measured criterion across repeated runs. */
export interface SpikeSpread {
  readonly min: number
  readonly max: number
  readonly median: number
}

/** Middle value of a numeric sample. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

/**
 * Aggregate repeated measurements: the median is the value used for ranking,
 * the min and max say how much of the difference could be noise.
 */
export function aggregate(samples: Record<string, number[]>): {
  measurements: Record<string, number | boolean>
  spread: Record<string, SpikeSpread>
} {
  const measurements: Record<string, number | boolean> = {}
  const spread: Record<string, SpikeSpread> = {}
  for (const [key, values] of Object.entries(samples)) {
    if (values.length === 0) continue
    const medianValue = median(values)
    measurements[key] = medianValue
    spread[key] = { min: Math.min(...values), max: Math.max(...values), median: medianValue }
  }
  return { measurements, spread }
}

/** True when `a` dominates `b` on every ranked criterion and is strictly better on one. */
export function dominates(
  a: Record<string, number | boolean> | undefined,
  b: Record<string, number | boolean> | undefined,
  criteria: readonly SpikeCriterion[],
): boolean {
  let strictly = false
  for (const criterion of criteria) {
    if (criterion.direction === 'pass') continue
    const left = a?.[criterion.name]
    const right = b?.[criterion.name]
    if (typeof left !== 'number' || typeof right !== 'number') return false
    const better = criterion.direction === 'min' ? left < right : left > right
    const equal = left === right
    if (!equal && !better) return false
    if (better) strictly = true
  }
  return strictly
}

/**
 * Rank by weighted ratio-to-best, disqualifying on bounds, `pass` criteria and
 * missing measurements first. Ties at the top are reported rather than broken
 * by iteration order.
 */
export function rank(candidates: readonly SpikeCandidate[], criteria: readonly SpikeCriterion[]): SpikeRun['ranking'] {
  const entries = candidates.map(candidate => ({
    candidate,
    score: 0,
    reasons: [] as string[],
    qualified: true,
  }))

  for (const criterion of criteria) {
    const bounded = criterion.atMost !== undefined || criterion.atLeast !== undefined
    for (const entry of entries) {
      const value = entry.candidate.measurements?.[criterion.name]
      if (criterion.direction === 'pass') {
        const satisfied = bounded
          ? typeof value === 'number'
            && (criterion.atMost === undefined || value <= criterion.atMost)
            && (criterion.atLeast === undefined || value >= criterion.atLeast)
          : value === true || (typeof value === 'number' && value > 0)
        if (!satisfied) {
          entry.qualified = false
          entry.reasons.push(`${criterion.name}: not satisfied`)
        }
        continue
      }
      if (typeof value !== 'number') {
        entry.qualified = false
        entry.reasons.push(`${criterion.name}: missing`)
        continue
      }
      if (bounded) {
        const ok = (criterion.atMost === undefined || value <= criterion.atMost)
          && (criterion.atLeast === undefined || value >= criterion.atLeast)
        if (!ok) {
          entry.qualified = false
          entry.reasons.push(`${criterion.name}: outside its bound`)
        }
      }
    }
  }

  for (const criterion of criteria) {
    if (criterion.direction === 'pass') continue
    const values = entries
      .filter(entry => entry.qualified && typeof entry.candidate.measurements?.[criterion.name] === 'number')
      .map(entry => entry.candidate.measurements?.[criterion.name] as number)
    if (values.length === 0) continue
    const best = criterion.direction === 'min' ? Math.min(...values) : Math.max(...values)
    for (const entry of entries) {
      if (!entry.qualified) continue
      const value = entry.candidate.measurements?.[criterion.name] as number
      const ratio = best === 0 ? (value === 0 ? 1 : 0) : criterion.direction === 'min' ? best / value : value / best
      entry.score += criterion.weight * ratio
    }
  }

  return entries
    .sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.score - a.score)
    .map(entry => ({ id: entry.candidate.id, score: Number(entry.score.toFixed(4)), qualified: entry.qualified, reasons: entry.reasons }))
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
 * The command that measures a candidate. A harnessed run uses the shared
 * benchmark, and the interpreter running it is the caller's business: a Python
 * project cannot be measured with `bun run bench.ts`.
 * @param input - whether a shared harness was supplied, its runner, and the fallback command.
 */
export function measurementCommand(input: { harnessed: boolean; runner?: string; measure?: string; harness?: string }): string | undefined {
  if (input.harnessed) {
    const runner = (input.runner ?? '').trim()
    if (runner.length > 0) return runner
    // A harness written in Python or shell cannot be started with bun. Infer the
    // interpreter from the file the caller supplied rather than failing silently.
    const name = (input.harness ?? '').trim()
    if (name.endsWith('.py')) return 'python3 bench.py'
    if (name.endsWith('.sh')) return 'bash bench.sh'
    return 'bun run bench.ts'
  }
  const measure = (input.measure ?? '').trim()
  return measure.length > 0 ? measure : undefined
}

/**
 * How many assertions a sound oracle reports as passed. Test runners print
 * "12 passed", "12 passed, 3 failed", "ok 12 tests", so read the first pass
 * count in the output; undefined means the command said nothing useful.
 * @param output - combined stdout and stderr of the verification command.
 */
export function parsePassCount(output: string): number | undefined {
  const patterns = [
    /(\d+)\s+passed/i,
    /(\d+)\s+passing/i,
    /(\d+)\s+tests?\s+(?:ok|passed)/i,
    /ok\s+(\d+)\s+tests?/i,
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(output)
    if (match !== null) return Number(match[1])
  }
  return undefined
}

/** How many checks the oracle reported failing, when it says so. */
export function parseFailCount(output: string): number {
  const match = /(\d+)\s+(?:failed|failing)/i.exec(output)
  return match === null ? 0 : Number(match[1])
}

/**
 * The filename the shared benchmark is written as. A caller measuring a Python
 * project runs `python3 bench.py`, so the file has to be bench.py, not bench.ts.
 * @param runner - the command that runs the harness, if the caller supplied one.
 */
export function harnessFileName(runner?: string): string {
  const parts = (runner ?? '').trim().split(/\s+/u)
  const last = parts[parts.length - 1] ?? ''
  return /^[\w.-]+\.(?:py|sh|ts|js|rb|pl)$/u.test(last) ? last : 'bench.ts'
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

/**
 * Resolve the `harness` argument: inline source, or `file:<path>` to read a
 * benchmark kept on disk. Inline source has to survive being quoted into a
 * tool call; a path does not, so a shared benchmark can be reused verbatim.
 * @param source - inline source, a `file:` path, or undefined.
 */
export async function resolveHarness(source: string | undefined): Promise<string | undefined> {
  if (source === undefined) return undefined
  const trimmed = source.trim()
  if (!trimmed.startsWith('file:')) return source
  const path = trimmed.slice('file:'.length).trim()
  if (path.length === 0) throw new Error('harness: file: needs a path')
  return await readFile(path, 'utf8')
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
    /** The approaches the caller proposed; one worker implements each. */
    approaches: readonly string[]
    repeats?: number
    timeboxMs?: number
    parent: unknown
    signal?: AbortSignal
    /** How many refinement rounds to run with the oracle's failures as feedback. */
    rounds?: number
    /** Directory the workspaces are created under; defaults to the process cwd. */
    workspace?: string
  },
): Promise<SpikeRun> {
  const approaches = options.approaches.map(approach => approach.trim()).filter(approach => approach.length > 0)
  if (approaches.length < MIN_APPROACHES) {
    throw new Error(`propose at least ${MIN_APPROACHES} different approaches; the workers implement them, they do not invent them`)
  }
  if (approaches.length > MAX_APPROACHES) approaches.length = MAX_APPROACHES
  if (deps.subagents === undefined) throw new Error('the subagents service is not mounted; the tournament needs it to run candidates')
  const timeboxMs = options.timeboxMs ?? 600_000
  const repeats = Math.max(1, Math.min(options.repeats ?? 3, 10))
  const id = `spike-${Date.now().toString(36)}`
  // Candidates live inside the session workspace, which is the only place the
  // file sandbox lets a child write. Outside it they silently produce nothing.
  const workspace = options.workspace ?? process.cwd()
  const root = join(workspace, '.spike', id)

  // Selecting on the oracle is the point of `verify`; it is weighted above the
  // caller's own criteria because it is the only sound signal available.
  const criteria = (options.verify ?? '').trim().length > 0
    && !options.criteria.some(criterion => criterion.name === 'verify_passed')
    ? [...options.criteria, { name: 'verify_passed', direction: 'max' as const, weight: 10 }]
    : options.criteria
  const harnessSource = await resolveHarness(options.harness)
  const verify = (options.verify ?? '').trim()
  const rounds = Math.max(1, Math.min(options.rounds ?? 1, 5))
  const results: SpikeCandidate[] = []
  const oracleTail = new Map<string, string>()
  // The oracle's failure text is the feedback that makes the next round better
  // than a fresh sample: self-correction needs an external signal to act on.
  let feedback = ''
  for (let round = 1; round <= rounds; round += 1) {
    const beforeRound = results.length
    await Promise.all(
      approaches.map(async (approach, index) => {
        const dir = join(root, round === 1 ? `${index + 1}` : `r${round}-${index + 1}`)
        await mkdir(dir, { recursive: true })
        const harnessed = harnessSource !== undefined && harnessSource.trim().length > 0
        const brief = buildBrief({
          question: options.question,
          approach,
          criteria: options.criteria,
          measure: options.measure,
          dir,
          timeboxMs,
          ...options.contract === undefined ? {} : { contract: options.contract },
          ...options.runner === undefined ? {} : { runner: options.runner },
          harnessed,
        }) + (feedback.length === 0 ? '' : `

## Feedback from the previous round

${feedback}
`)
        await writeFile(join(dir, 'BRIEF.md'), brief, 'utf8')
        if (options.contract !== undefined && options.contract.trim().length > 0) {
          const commented = options.contract.trim().split('\n').map(line => `// ${line}`).join('\n')
          await writeFile(join(dir, 'impl.ts'), `// Implement the contract below. The harness imports this module.\n//\n${commented}\n`, 'utf8')
        }
        if (harnessed) await writeFile(join(dir, harnessFileName(options.runner)), harnessSource as string, 'utf8')

        const controller = new AbortController()
        const started = Date.now()
        const timer = setTimeout(() => controller.abort(new Error('timebox')), timeboxMs)
        const candidate: SpikeCandidate = {
          id: round === 1 ? `c${index + 1}` : `c${index + 1}r${round}`,
          approach,
          dir: relative(process.cwd(), dir),
          elapsedMs: 0,
          timedOut: false,
          files: 0,
          loc: 0,
        }
        let oracleOutput = ''
        try {
          const activation = await deps.subagents!.startActivation({
            provider: 'fork',
            label: `spike ${candidate.id}`,
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
        if (harnessed) await writeFile(join(dir, harnessFileName(options.runner)), harnessSource as string, 'utf8')
        const command = measurementCommand({ harnessed, ...options.runner === undefined ? {} : { runner: options.runner }, ...options.measure === undefined ? {} : { measure: options.measure }, ...options.harness === undefined ? {} : { harness: options.harness } })
        let spread: Record<string, SpikeSpread> | undefined
        if (command !== undefined && command.trim().length > 0) {
          const numeric: Record<string, number[]> = {}
          const booleans: Record<string, boolean> = {}
          for (let rep = 0; rep < repeats; rep += 1) {
            const raw = await runCommand(command, dir, Math.min(timeboxMs, 120_000))
            const reading = readMeasurements(raw)
            if (Object.keys(reading).length === 0 && rep === 0) {
              candidate.error = candidate.error ?? 'the measurement command printed no JSON object'
            }
            for (const [key, value] of Object.entries(reading)) {
              if (typeof value === 'number') (numeric[key] ??= []).push(value)
              else booleans[key] = booleans[key] === true ? true : value
            }
          }
          const aggregated = aggregate(numeric)
          measurements = { ...aggregated.measurements, ...booleans }
          if (Object.keys(aggregated.spread).length > 0) spread = aggregated.spread
        }
        // A sound oracle outranks a caller-written harness: it is the signal the
        // literature says sampling actually scales on.
        if (verify.length > 0) {
          oracleOutput = await runCommand(verify, dir, Math.min(timeboxMs, 300_000))
          const passed = parsePassCount(oracleOutput)
          measurements = { ...measurements, verify_passed: passed ?? 0, verify_ok: passed !== undefined }
        }
        results.push({
          ...candidate,
          ...stats,
          files: stats.files,
          loc: stats.loc,
          ...measurements === undefined ? {} : { measurements },
          ...spread === undefined ? {} : { spread },
        })
        if (verify.length > 0 && oracleOutput.length > 0) oracleTail.set(candidate.id, oracleOutput)
      }),
    )
    // Stop early when the oracle is clean or nothing can act on the feedback.
    if (verify.length === 0 || round === rounds) break
    const fresh = results.slice(beforeRound).filter(entry => !entry.timedOut)
    if (fresh.length === 0) break
    const best = fresh.reduce((a, b) => Number(b.measurements?.verify_passed ?? 0) > Number(a.measurements?.verify_passed ?? 0) ? b : a)
    const bestPassed = Number(best.measurements?.verify_passed ?? 0)
    const bestOutput = oracleTail.get(best.id) ?? ''
    const failures = parseFailCount(bestOutput)
    if (failures === 0 && bestPassed > 0) break
    feedback = `The best candidate in round ${round} passed ${bestPassed} checks${failures > 0 ? ` with ${failures} failures` : ''}. The verifier reported:\n\n\`\`\`\n${bestOutput.slice(-4000)}\n\`\`\`\n\nFix the remaining failures; keep what already passes.`
  }

  const measured = results.map(candidate => ({
    ...candidate,
    measurements: { files: candidate.files, loc: candidate.loc, ...candidate.measurements },
  }))
  const ranking = rank(measured, criteria)
  const qualified = ranking.filter(entry => entry.qualified)
  const pareto = measured
    .filter(candidate => qualified.some(entry => entry.id === candidate.id))
    .filter(candidate => !measured.some(other =>
      other.id !== candidate.id
      && qualified.some(entry => entry.id === other.id)
      && dominates(other.measurements, candidate.measurements, criteria)))
    .map(candidate => candidate.id)
  // How much of the gap between the top two could be noise: the median relative
  // spread of every ranked criterion, weighted like the criteria themselves.
  const ranked = criteria.filter(criterion => criterion.direction !== 'pass')
  const noise = ranked.reduce((sum, criterion) => {
    const ratios = measured
      .map(candidate => candidate.spread?.[criterion.name])
      .filter((entry): entry is SpikeSpread => entry !== undefined)
      .map(entry => entry.median === 0 ? 0 : (entry.max - entry.min) / Math.abs(entry.median))
    return sum + criterion.weight * median(ratios)
  }, 0)
  const first = qualified[0]
  const second = qualified[1]
  const undecided = first !== undefined && second !== undefined
    && (first.score - second.score) <= Math.max(noise, 1e-9)
  const run: SpikeRun = {
    id,
    question: options.question,
    criteria: options.criteria,
    comparable: harnessSource !== undefined && harnessSource.trim().length > 0,
    ...options.measure === undefined ? {} : { measure: options.measure },
    timeboxMs,
    candidates: measured,
    ranking,
    pareto,
    repeats,
    verdict: first === undefined ? 'none' : undecided ? 'unresolved' : 'winner',
    ...first === undefined || undecided ? {} : { winner: first.id },
  }
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'run.json'), JSON.stringify(run, null, 2), 'utf8')
  return run
}

/** Render the record as the table the model and the human read. */
export function renderSpike(run: SpikeRun): string {
  const lines = [`## ${run.id}: ${run.question}`, '']
  lines.push(`| candidate | approach | time | files | loc | verdict |`)
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
    lines.push(`| ${candidate.id} | ${candidate.approach.slice(0, 60)}… | ${Math.round(candidate.elapsedMs / 1000)}s | ${candidate.files} | ${candidate.loc} | ${verdict} |`)
  }
  lines.push('')
  // The scores alone cannot be audited; the numbers behind them have to travel
  // with the verdict or the table is just an opinion with decimals.
  const judged = run.criteria.filter(criterion => criterion.direction !== 'pass')
  if (judged.length > 0) {
    lines.push(`measurements (median over ${run.repeats ?? 1} run${(run.repeats ?? 1) === 1 ? '' : 's'}, min-max in brackets):`)
    for (const candidate of run.candidates) {
      const parts = judged.map(criterion => {
        const value = candidate.measurements?.[criterion.name]
        if (typeof value !== 'number') return `${criterion.name} —`
        const spread = candidate.spread?.[criterion.name]
        return spread === undefined
          ? `${criterion.name} ${Number(value.toFixed(3))}`
          : `${criterion.name} ${Number(value.toFixed(3))} [${Number(spread.min.toFixed(3))}–${Number(spread.max.toFixed(3))}]`
      })
      lines.push(`- ${candidate.id}: ${parts.join(', ')}`)
    }
    lines.push('')
  }
  if (run.verdict === 'winner') {
    lines.push(`winner: ${run.winner} — implement this, or state in one line why you deviate.`)
  } else if (run.verdict === 'unresolved') {
    const [a, b] = run.ranking.filter(entry => entry.qualified)
    lines.push(`verdict: unresolved — ${a?.id} and ${b?.id} are within measurement noise (${a?.score} vs ${b?.score}, ${run.repeats} runs each); add a criterion that separates them instead of trusting the gap.`)
  } else {
    lines.push('winner: none qualified')
  }
  if ((run.pareto?.length ?? 0) > 0) lines.push(`pareto front: ${run.pareto.join(', ')}`)
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
            atMost: { type: 'number', description: 'Disqualify candidates above this value.' },
            atLeast: { type: 'number', description: 'Disqualify candidates below this value.' },
          },
        },
      },
      measure: {
        type: 'string',
        description: 'Command run inside every candidate directory; it must print one JSON object with a value per criterion key. Ignored when harness is given.',
      },
      runner: {
        type: 'string',
        description: 'Command that runs the shared harness, e.g. "python3 bench.py". Defaults to "bun run bench.ts".',
      },
      harness: {
        type: 'string',
        description: 'Source of the benchmark written as bench.ts into every candidate and restored before measuring, so all candidates share one instrument. Pass `file:<path>` to read it from disk.',
      },
      contract: {
        type: 'string',
        description: 'The exact TypeScript interface each candidate must implement in impl.ts.',
      },
      approaches: {
        type: 'array',
        required: true,
        description: 'The different approaches you want tested. Each is implemented by its own worker; three is the minimum, and the workers never invent their own.',
        items: { type: 'string' },
      },
      verify: {
        type: 'string',
        description: 'Sound oracle command run inside every candidate, e.g. the repository test suite. Its pass count ranks the candidates above your own criteria, and its failures become feedback for the next round.',
      },
      rounds: {
        type: 'number',
        description: 'Refinement rounds: after the first round the best candidate\'s oracle failures are given to the next round of candidates (default 1, max 5).',
      },
      timeboxMinutes: { type: 'number', description: 'Per-candidate budget in minutes (default 10).' },
      repeats: { type: 'number', description: 'How many times the benchmark runs per candidate (default 3); the median ranks, the spread decides unresolved.' },
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
      runner?: string
      verify?: string
      rounds?: number
      approaches: string[]
      timeboxMinutes?: number
      repeats?: number
    }, exec: { agent?: unknown; signal?: AbortSignal }) {
      const criteria = parseCriteria(args.criteria)
      const subagents = (ctx.get('subagents') ?? undefined) as SpikeDeps['subagents']
      const run = await runSpike({ subagents }, {
        question: args.question,
        criteria,
        approaches: Array.isArray(args.approaches) ? args.approaches : [],
        ...args.measure === undefined ? {} : { measure: args.measure },
        ...args.harness === undefined ? {} : { harness: args.harness },
        ...args.verify === undefined ? {} : { verify: args.verify },
        ...args.rounds === undefined ? {} : { rounds: args.rounds },
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

When a decision has more than one plausible answer — a storage strategy, a cache invalidation rule, an auth flow, a query shape — do not choose by reasoning alone: name at least three genuinely different approaches and call \`spike\` with them, the criteria that matter, and the measurement. Each approach is implemented by its own worker in a disposable directory, measured with one benchmark, and ranked; the workers implement your approaches, they never invent their own. Performance and security forks always go through it before implementation. Implementation follows the winner; deviating from it requires one line in the reply saying why, and every timeout is recorded so the budget can be tuned.`
