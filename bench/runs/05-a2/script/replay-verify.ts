/**
 * Replay recorded judge calls through the deterministic lanes.
 *
 * The point is not to grade the judge in the abstract: it is to find turns the
 * judge let through that a deterministic rule can prove. Run it against the
 * persisted call store (`~/.dsh/totem/laya-calls.jsonl`) written before the
 * model judge was removed
 * sessions and it reports exactly which verdicts a veto would have changed.
 *
 * Usage:
 *   bun run script/replay-verify.ts
 *   bun run script/replay-verify.ts --file ~/.dsh/totem/laya-calls.jsonl --json
 *   bun run script/replay-verify.ts --root /path/to/project
 *
 * No Host, no model, no GPU.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { verifyChanges, type VerifyChange, type VerifyFinding } from '../src/verify.ts'
import { verifyExtraChanges } from '../src/rules.ts'

interface RecordedCall {
  id: number
  ts: string
  kind: string
  verdict: string
  composite: number | null
  reviewOnly?: boolean
  authoritative?: boolean
  session?: string
  turn?: number
  state?: { changes?: { tool?: string; path?: string; input?: string; output?: string; diff?: string }[] }
  findings?: VerifyFinding[]
}

interface Row {
  id: number
  kind: string
  verdict: string
  composite: number | null
  reviewOnly: boolean
  changes: number
  findings: VerifyFinding[]
  blocking: boolean
  judgeBlocking: boolean
}

/** Convert a recorded canonical state into verify changes. */
export function changesOf(state: RecordedCall['state']): VerifyChange[] {
  return (state?.changes ?? []).flatMap((change) => {
    const paths = typeof change.path === 'string' && change.path.length > 0 ? [change.path] : []
    return [{
      tool: typeof change.tool === 'string' ? change.tool : 'edit',
      input: typeof change.input === 'string' ? change.input : '',
      output: typeof change.output === 'string' ? change.output : '',
      ...typeof change.diff === 'string' ? { diff: change.diff } : {},
      ...paths.length === 0 ? {} : { paths },
    }]
  })
}

/** Run both deterministic lanes over one recorded call. */
export function evaluate(call: RecordedCall, root?: string): Row {
  const changes = changesOf(call.state)
  const builtIn = verifyChanges(changes)
  const extra = verifyExtraChanges(changes, { ...root === undefined ? {} : { root } })
  const findings = [...builtIn.findings, ...extra]
  return {
    id: call.id,
    kind: call.kind,
    verdict: call.verdict,
    composite: call.composite,
    reviewOnly: call.reviewOnly === true,
    changes: changes.length,
    findings,
    blocking: builtIn.veto || findings.some(finding => finding.severity === 'high'),
    judgeBlocking: call.verdict === 'fail' || (call.findings ?? []).some(finding => finding.severity === 'high'),
  }
}

function parseArgs(argv: readonly string[]): { file: string; json: boolean; root?: string } {
  let file = join(homedir(), '.dsh/totem/laya-calls.jsonl')
  let json = false
  let root: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === '--file') { file = value ?? file; index += 1 }
    else if (flag === '--root') { root = resolve(value ?? '.'); index += 1 }
    else if (flag === '--json') json = true
    else if (flag === '--help') {
      console.log('usage: bun run script/replay-verify.ts [--file calls.jsonl] [--root path] [--json]')
      process.exit(0)
    } else {
      throw new Error(`unknown argument: ${flag}`)
    }
  }
  return { file, json, ...root === undefined ? {} : { root } }
}

function main(): number {
  let args: ReturnType<typeof parseArgs>
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  const calls = readFileSync(args.file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      if (line.trim().length === 0) return []
      try {
        const value = JSON.parse(line) as RecordedCall
        return typeof value?.id === 'number' ? [value] : []
      } catch {
        return []
      }
    })
  if (calls.length === 0) {
    console.error(`no recorded calls in ${args.file}`)
    return 2
  }

  const rows = calls.map(call => evaluate(call, args.root))
  const caughtByRules = rows.filter(row => row.blocking)
  const missedByJudge = rows.filter(row => row.blocking && !row.judgeBlocking)
  const judgeOnly = rows.filter(row => row.judgeBlocking && !row.blocking)
  const byRule = new Map<string, number>()
  for (const row of rows) {
    for (const finding of row.findings) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1)
  }

  if (args.json) {
    console.log(JSON.stringify({
      file: args.file,
      calls: rows.length,
      caughtByRules: caughtByRules.length,
      missedByJudge: missedByJudge.map(row => row.id),
      judgeOnly: judgeOnly.map(row => row.id),
      rules: Object.fromEntries([...byRule].sort((left, right) => right[1] - left[1])),
      rows,
    }, null, 2))
  } else {
    console.log(`${rows.length} recorded call(s) from ${args.file}`)
    for (const row of rows) {
      const mark = row.blocking ? 'BLOCK' : row.judgeBlocking ? 'judge' : '     '
      const rules = row.findings.length === 0 ? '' : `  ${[...new Set(row.findings.map(finding => finding.rule))].join(',')}`
      console.log(`  ${mark}  #${row.id} ${row.kind.padEnd(8)} ${row.verdict.padEnd(12)} ${row.composite === null ? '  n/a' : row.composite.toFixed(3)}${row.reviewOnly ? ' reviewOnly' : ''}${rules}`)
    }
    console.log('')
    console.log(`deterministic veto: ${caughtByRules.length}/${rows.length}`)
    console.log(`caught by rules but not by the judge: ${missedByJudge.length}${missedByJudge.length === 0 ? '' : ` (#${missedByJudge.map(row => row.id).join(', #')})`}`)
    console.log(`judge-only failures (need review): ${judgeOnly.length}${judgeOnly.length === 0 ? '' : ` (#${judgeOnly.map(row => row.id).join(', #')})`}`)
    if (byRule.size > 0) console.log(`rules: ${[...byRule].sort((left, right) => right[1] - left[1]).map(([rule, count]) => `${rule}×${count}`).join(', ')}`)
  }
  // Exit 0 by design: the replay reports, it does not gate a build.
  return 0
}

if (import.meta.main) process.exitCode = main()
