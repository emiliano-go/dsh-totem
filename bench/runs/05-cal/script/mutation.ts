/**
 * Mutation kill-rate CLI.
 *
 * Generates mutants for one file, runs a test command against each, and reports
 * how many the suite killed. The source is always restored, including on
 * timeout or error, and every mutant gets its own run so a survivor cannot be
 * hidden by a cached failure.
 *
 * Usage:
 *   bun run script/mutation.ts --file src/queue.ts --dry-run
 *   bun run script/mutation.ts --file src/queue.ts --command "bun test" --max 6
 *   bun run script/mutation.ts --file src/queue.ts --min-kill 0.8 --json
 *
 * Exit codes: 0 at or above the gate, 1 below it, 2 usage error.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { isAbsolute, resolve } from 'node:path'
import { applyMutant, generateMutants, isMutablePath, killRate, type MutantResult } from '../src/mutation.ts'

interface Args {
  file?: string
  command: string
  cwd: string
  max: number
  timeoutMs: number
  minKill: number
  dryRun: boolean
  json: boolean
}

function parse(argv: readonly string[]): Args {
  const args: Args = { command: 'bun test', cwd: process.cwd(), max: 12, timeoutMs: 120_000, minKill: 0, dryRun: false, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    switch (flag) {
      case '--file': args.file = value; index += 1; break
      case '--command': args.command = value ?? args.command; index += 1; break
      case '--cwd': args.cwd = isAbsolute(value ?? '') ? value : resolve(value ?? '.'); index += 1; break
      case '--max': args.max = Number(value); index += 1; break
      case '--timeout-ms': args.timeoutMs = Number(value); index += 1; break
      case '--min-kill': args.minKill = Number(value); index += 1; break
      case '--dry-run': args.dryRun = true; break
      case '--json': args.json = true; break
      case '--help':
        console.log('usage: bun run script/mutation.ts --file path [--command "cmd"] [--cwd path] [--max n] [--timeout-ms n] [--min-kill r] [--dry-run] [--json]')
        process.exit(0)
        break
      default:
        throw new Error(`unknown argument: ${flag}`)
    }
  }
  return args
}

/** Run the test command once; non-zero exit means the mutant was killed. */
function runCommand(command: string, cwd: string, timeoutMs: number): Promise<{ exitCode: number; durationMs: number }> {
  return new Promise((resolveRun) => {
    const started = Date.now()
    const child = spawn(command, { cwd, shell: true, env: process.env })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, timeoutMs)
    child.stdout.on('data', () => {})
    child.stderr.on('data', () => {})
    child.on('error', () => {})
    child.on('close', (code) => {
      clearTimeout(timer)
      resolveRun({ exitCode: timedOut ? 124 : code ?? 1, durationMs: Date.now() - started })
    })
  })
}

async function main(): Promise<number> {
  let args: Args
  try {
    args = parse(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  if (args.file === undefined) {
    console.error('usage: --file is required')
    return 2
  }
  const file = isAbsolute(args.file) ? args.file : resolve(args.cwd, args.file)
  if (!isMutablePath(file)) {
    console.error(`refusing to mutate a non-code file: ${file}`)
    return 2
  }
  const original = readFileSync(file, 'utf8')
  const mutants = generateMutants(original, { max: args.max })
  if (args.dryRun) {
    console.log(`${mutants.length} mutant(s) for ${file}`)
    for (const mutant of mutants) {
      console.log(`  line ${mutant.line + 1}: ${mutant.description}`)
      console.log(`    - ${mutant.original.trim()}`)
      console.log(`    + ${mutant.mutated.trim()}`)
    }
    return 0
  }
  if (mutants.length === 0) {
    console.log('no mutants generated')
    return 0
  }

  const results: MutantResult[] = []
  try {
    for (const mutant of mutants) {
      writeFileSync(file, applyMutant(original, mutant))
      const run = await runCommand(args.command, args.cwd, args.timeoutMs)
      results.push({ mutant, killed: run.exitCode !== 0, exitCode: run.exitCode, durationMs: run.durationMs })
    }
  } finally {
    // Restore even when the loop throws or the process is interrupted.
    writeFileSync(file, original)
  }

  const summary = killRate(results)
  const survivors = results.filter(result => !result.killed).map(result => result.mutant)
  if (args.json) {
    console.log(JSON.stringify({ file, command: args.command, ...summary, results: results.map(result => ({ line: result.mutant.line + 1, description: result.mutant.description, killed: result.killed, exitCode: result.exitCode })) }, null, 2))
  } else {
    console.log(`${file}: ${summary.killed}/${summary.total} mutants killed (${(summary.rate * 100).toFixed(0)}%)`)
    for (const result of results) console.log(`  ${result.killed ? 'killed  ' : 'SURVIVED'} line ${result.mutant.line + 1}: ${result.mutant.description}`)
    if (survivors.length > 0) console.log(`  ${survivors.length} survivor(s): the suite does not notice this change`)
    console.log(summary.rate >= args.minKill ? '  PASS' : '  FAIL')
  }
  return summary.rate >= args.minKill ? 0 : 1
}

if (import.meta.main) process.exitCode = await main()
