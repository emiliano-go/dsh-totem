/**
 * Coverage delta CLI: did the change's new lines actually run?
 *
 * Usage:
 *   bun run script/coverage.ts --repo . --coverage coverage/lcov.info
 *   bun run script/coverage.ts --diff change.diff --coverage coverage-final.json
 *   bun run script/coverage.ts --repo . --min-ratio 0.8 --json
 *
 * Without `--coverage` it looks for the usual report locations. Exit 1 when the
 * delta breaches the gate (any uncovered added line by default), 2 on usage
 * error, 0 when clean or when nothing was measurable.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  addedLineNumbers,
  addedLineNumbersOf,
  deltaRatio,
  fileDeltas,
  parseCoverage,
  uncoveredAddedLines,
  type AddedLines,
} from '../src/coverage-delta.ts'

const CANDIDATES = [
  'coverage/coverage-final.json',
  'coverage/lcov.info',
  'coverage/cobertura.xml',
  'coverage.xml',
  'lcov.info',
  'coverage-final.json',
]

interface Args {
  repo?: string
  diff?: string
  coverage?: string
  root?: string
  minRatio?: number
  maxUncovered: number
  json: boolean
}

function parse(argv: readonly string[]): Args {
  const args: Args = { maxUncovered: 0, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    switch (flag) {
      case '--repo': args.repo = value; index += 1; break
      case '--diff': args.diff = value; index += 1; break
      case '--coverage': args.coverage = value; index += 1; break
      case '--root': args.root = value; index += 1; break
      case '--min-ratio': args.minRatio = Number(value); index += 1; break
      case '--max-uncovered': args.maxUncovered = Number(value); index += 1; break
      case '--json': args.json = true; break
      case '--help':
        console.log('usage: bun run script/coverage.ts (--repo path | --diff file) [--coverage file] [--root path] [--min-ratio r] [--max-uncovered n] [--json]')
        process.exit(0)
        break
      default:
        throw new Error(`unknown argument: ${flag}`)
    }
  }
  return args
}

/** Find a coverage report near the repository. */
export function findReport(root: string): string | undefined {
  for (const candidate of CANDIDATES) {
    const path = join(root, candidate)
    if (existsSync(path)) return path
  }
  return undefined
}

/** Added lines for a repo diff or a patch file. */
export function loadAdded(args: Args): { added: AddedLines; root?: string } {
  if (args.diff !== undefined) {
    const root = args.root === undefined ? undefined : resolve(args.root)
    return { added: addedLineNumbers(readFileSync(args.diff, 'utf8')), ...root === undefined ? {} : { root } }
  }
  if (args.repo !== undefined) {
    const repo = isAbsolute(args.repo) ? args.repo : resolve(args.repo)
    const patch = execFileSync('git', ['-C', repo, 'diff', '--no-color', '--no-ext-diff'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    return { added: addedLineNumbersOf([{ diff: patch }]), root: args.root === undefined ? repo : resolve(args.root) }
  }
  throw new Error('one of --repo or --diff is required')
}

function main(): number {
  let args: Args
  try {
    args = parse(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  let loaded: ReturnType<typeof loadAdded>
  try {
    loaded = loadAdded(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  const reportPath = args.coverage === undefined
    ? findReport(loaded.root ?? process.cwd())
    : resolve(args.coverage)
  if (reportPath === undefined) {
    console.error('no coverage report found; pass --coverage or generate one first')
    return 2
  }
  if (!existsSync(reportPath)) {
    console.error(`coverage report not found: ${reportPath}`)
    return 2
  }

  const report = parseCoverage(readFileSync(reportPath, 'utf8'), reportPath, loaded.root)
  const uncovered = uncoveredAddedLines(loaded.added, report, loaded.root)
  const deltas = fileDeltas(loaded.added, report, loaded.root)
  const ratio = deltaRatio(loaded.added, report, loaded.root)
  const breached = uncovered.length > args.maxUncovered
    || (args.minRatio !== undefined && ratio !== null && ratio < args.minRatio)

  if (args.json) {
    console.log(JSON.stringify({ report: reportPath, format: report.format, ratio, uncovered, deltas, breached }, null, 2))
  } else {
    console.log(`coverage: ${reportPath} (${report.format})`)
    for (const delta of deltas) {
      if (delta.executable === 0) console.log(`  ${delta.path}: ${delta.added} added, none executable`)
      else console.log(`  ${delta.path}: ${delta.added} added, ${delta.executable} executable, ${delta.uncovered} uncovered`)
    }
    if (uncovered.length > 0) {
      console.log('uncovered added lines:')
      for (const entry of uncovered) console.log(`  ${entry.path}:${entry.line}`)
    }
    console.log(ratio === null ? '  delta ratio: n/a (nothing measurable)' : `  delta ratio: ${(ratio * 100).toFixed(1)}%`)
    console.log(breached ? '  FAIL' : '  PASS')
  }
  return breached ? 1 : 0
}

if (import.meta.main) process.exitCode = main()
