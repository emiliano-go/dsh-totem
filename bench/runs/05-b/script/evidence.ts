/**
 * Execution evidence runner.
 *
 * The judge is an opinion; a command that ran is evidence. This runs a command
 * with a timeout, records the exit code, duration, output hash, and a tail, and
 * can repeat it to separate a real failure from a flaky one. The record matches
 * the shape Totem stores for `memory_check_record` (command, cwd, exit code,
 * output hash), so a later step can promote it without translation.
 *
 * Usage:
 *   bun run script/evidence.ts --command "bun test"
 *   bun run script/evidence.ts --command "bun test" --repeat 3 --json
 *   bun run script/evidence.ts --command "bun run build" --tail 4000
 *
 * Exit codes: 0 every run passed, 1 a run failed, 2 usage error or timeout.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isAbsolute, resolve } from 'node:path'

/** One completed run. */
export interface EvidenceRun {
  command: string
  cwd: string
  exitCode: number
  durationMs: number
  outputHash: string
  outputTail: string
  timedOut: boolean
  ranAt: string
}

/** The whole evidence record. */
export interface EvidenceReport {
  command: string
  cwd: string
  runs: EvidenceRun[]
  failures: number
  flaky: boolean
  passed: boolean
}

interface Args {
  command?: string
  cwd: string
  timeoutMs: number
  repeat: number
  tail: number
  json: boolean
}

function parse(argv: readonly string[]): Args {
  const args: Args = { cwd: process.cwd(), timeoutMs: 300_000, repeat: 1, tail: 2000, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    switch (flag) {
      case '--command': args.command = value; index += 1; break
      case '--cwd': args.cwd = isAbsolute(value ?? '') ? value : resolve(value ?? '.'); index += 1; break
      case '--timeout-ms': args.timeoutMs = Number(value); index += 1; break
      case '--repeat': args.repeat = Number(value); index += 1; break
      case '--tail': args.tail = Number(value); index += 1; break
      case '--json': args.json = true; break
      case '--help':
        console.log('usage: bun run script/evidence.ts --command "cmd" [--cwd path] [--timeout-ms n] [--repeat n] [--tail chars] [--json]')
        process.exit(0)
        break
      default:
        throw new Error(`unknown argument: ${flag}`)
    }
  }
  return args
}

/** Run one command, capturing output with a hard timeout. */
export function runOnce(command: string, cwd: string, timeoutMs: number, tail: number): Promise<EvidenceRun> {
  return new Promise((resolveRun) => {
    const started = Date.now()
    const child = spawn(command, { cwd, shell: true, env: process.env })
    const chunks: Buffer[] = []
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    const collect = (chunk: Buffer): void => { chunks.push(Buffer.from(chunk)) }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => { chunks.push(Buffer.from(String(error))) })
    child.on('close', (code) => {
      clearTimeout(timer)
      const output = Buffer.concat(chunks).toString('utf8')
      resolveRun({
        command,
        cwd,
        exitCode: timedOut ? 124 : code ?? 1,
        durationMs: Date.now() - started,
        outputHash: createHash('sha256').update(output).digest('hex'),
        outputTail: output.slice(-tail),
        timedOut,
        ranAt: new Date().toISOString(),
      })
    })
  })
}

/**
 * Run the command `repeat` times.
 *
 * One pass is evidence that it ran; several passes are evidence that it is
 * stable. `flaky` means it both passed and failed, which is the only case where
 * a later failure cannot be attributed to the change.
 */
export async function collect(
  command: string,
  cwd: string,
  options: { timeoutMs?: number; repeat?: number; tail?: number } = {},
): Promise<EvidenceReport> {
  const repeat = Math.max(1, Math.min(10, options.repeat ?? 1))
  const runs: EvidenceRun[] = []
  for (let index = 0; index < repeat; index += 1) {
    runs.push(await runOnce(command, cwd, options.timeoutMs ?? 300_000, options.tail ?? 2000))
  }
  const failures = runs.filter(run => run.exitCode !== 0).length
  return {
    command,
    cwd,
    runs,
    failures,
    flaky: failures > 0 && failures < runs.length,
    passed: failures === 0,
  }
}

function main(): number {
  let args: Args
  try {
    args = parse(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  if (args.command === undefined || args.command.trim().length === 0) {
    console.error('usage: --command is required')
    return 2
  }
  if (!Number.isFinite(args.repeat) || args.repeat < 1 || args.repeat > 10) {
    console.error('--repeat must be between 1 and 10')
    return 2
  }
  return collect(args.command, args.cwd, {
    timeoutMs: args.timeoutMs,
    repeat: args.repeat,
    tail: args.tail,
  }).then((report) => {
    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`${report.command}  (${report.cwd})`)
      for (const run of report.runs) {
        console.log(`  exit ${run.exitCode}  ${run.durationMs} ms${run.timedOut ? '  TIMEOUT' : ''}  ${run.outputHash.slice(0, 12)}`)
      }
      if (report.runs.length > 1) console.log(`  failures ${report.failures}/${report.runs.length}${report.flaky ? '  FLAKY' : ''}`)
      console.log(report.passed ? '  PASS' : '  FAIL')
    }
    const timedOut = report.runs.some(run => run.timedOut)
    return timedOut ? 2 : report.passed ? 0 : 1
  })
}

if (import.meta.main) process.exitCode = await main()
