/**
 * Memory ranking evaluation harness.
 *
 * Runs Totem's own evaluator (`totem_eval_tool`) over the project database and
 * gates the result, so "the memory got better" is a measurement rather than an
 * impression. With no case file it derives a smoke set from the stored
 * memories; that is a wiring check, not a quality claim, and the report says so.
 *
 * Usage:
 *   bun run eval                       # auto cases, gate on recall@10 and p95
 *   bun run eval --cases eval/cases.json
 *   bun run eval --min-recall 0.6 --min-mrr 0.4 --p95 1500 --json
 *   bun run eval --baseline eval/baseline.json
 *
 * Exit codes: 0 pass, 1 gate failure, 2 usage or transport error.
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

interface Args {
  cases?: string
  baseline?: string
  minRecall: number
  minMrr: number
  p95: number
  k: number
  project: string
  json: boolean
  command: string
}

function parse(argv: string[]): Args {
  const args: Args = {
    minRecall: 0.5,
    minMrr: 0.3,
    p95: 2000,
    k: 10,
    project: process.cwd(),
    json: false,
    command: process.env.TOTEM_MCP ?? 'totem-mcp',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    switch (flag) {
      case '--cases': args.cases = value; index += 1; break
      case '--baseline': args.baseline = value; index += 1; break
      case '--min-recall': args.minRecall = Number(value); index += 1; break
      case '--min-mrr': args.minMrr = Number(value); index += 1; break
      case '--p95': args.p95 = Number(value); index += 1; break
      case '--k': args.k = Number(value); index += 1; break
      case '--project': args.project = value; index += 1; break
      case '--command': args.command = value; index += 1; break
      case '--json': args.json = true; break
      case '--help':
        console.log('usage: bun run eval [--cases f] [--baseline f] [--min-recall n] [--min-mrr n] [--p95 ms] [--k n] [--project path] [--json]')
        process.exit(0)
        break
      default:
        console.error(`unknown argument: ${flag}`)
        process.exit(2)
    }
  }
  // A relative case file is resolved against the caller's directory; the file
  // itself is read by the Totem server, so it must be absolute.
  for (const key of ['cases', 'baseline'] as const) {
    const value = args[key]
    if (value !== undefined && !isAbsolute(value)) args[key] = resolve(value)
  }
  return args
}

async function main(): Promise<number> {
  const args = parse(process.argv.slice(2))
  for (const value of [args.minRecall, args.minMrr, args.p95, args.k]) {
    if (!Number.isFinite(value) || value < 0) {
      console.error('numeric arguments must be non-negative numbers')
      return 2
    }
  }
  if (args.cases !== undefined) {
    try {
      JSON.parse(readFileSync(args.cases, 'utf8'))
    } catch (error) {
      console.error(`cannot read cases file ${args.cases}: ${error instanceof Error ? error.message : String(error)}`)
      return 2
    }
  }

  const transport = new StdioClientTransport({
    command: args.command,
    args: [],
    env: process.env as Record<string, string>,
    stderr: 'ignore',
  })
  const client = new Client(
    { name: 'dsh-totem-eval', version: '0.1.0' },
    { capabilities: {}, versionNegotiation: { mode: 'auto' } },
  )
  try {
    await client.connect(transport)
    const result = await client.callTool({
      name: 'totem_eval_tool',
      arguments: {
        ...args.cases === undefined ? {} : { cases_file: args.cases },
        ...args.baseline === undefined ? {} : { baseline_file: args.baseline },
        k: args.k,
        tolerance: 0,
        p95_ms: args.p95,
        project: args.project,
      },
    }, { timeout: 120_000 })
    const text = Array.isArray(result.content)
      ? result.content
        .filter((block: { type?: string }) => block.type === 'text')
        .map((block: { text?: string }) => block.text ?? '')
        .join('')
      : ''
    if (result.isError === true) {
      console.error(text || 'totem_eval_tool failed')
      return 2
    }
    // Keys follow the evaluator's own report shape: `n`, `recall_at_<k>`,
    // `mrr`, `ndcg_at_<k>`, `p95_ms`.
    const report = JSON.parse(text) as {
      n?: number
      k?: number
      mrr?: number
      p95_ms?: number
      gate?: { passed?: boolean; reasons?: string[] }
      [key: string]: unknown
    }
    const cases = Number(report.n ?? 0)
    const recall = Number(report[`recall_at_${args.k}`] ?? 0)
    const mrr = Number(report.mrr ?? 0)
    const p95 = Number(report.p95_ms ?? 0)
    // An auto-derived set is a wiring check: it depends on whatever happens to
    // be stored, so gating recall on it would fail for database contents rather
    // than for a ranking regression. Quality gates need an explicit case file.
    const auto = args.cases === undefined
    const failures: string[] = []
    if (cases === 0) failures.push('no cases: seed project memory first, or pass --cases')
    if (!auto && recall < args.minRecall) failures.push(`recall@${args.k} ${recall.toFixed(3)} < ${args.minRecall}`)
    if (!auto && mrr < args.minMrr) failures.push(`mrr ${mrr.toFixed(3)} < ${args.minMrr}`)
    if (p95 > args.p95) failures.push(`p95 ${p95.toFixed(0)}ms > ${args.p95}ms`)
    if (report.gate?.passed === false) failures.push(...report.gate.reasons ?? ['baseline gate failed'])
    if (args.json) console.log(JSON.stringify({ ...report, failures }, null, 2))
    else {
      console.log(`cases   ${cases}`)
      console.log(`recall@${args.k} ${recall.toFixed(3)}  (min ${args.minRecall})`)
      console.log(`mrr     ${mrr.toFixed(3)}  (min ${args.minMrr})`)
      console.log(`p95     ${p95.toFixed(0)}ms  (max ${args.p95}ms)`)
      if (auto) console.log('note    auto-derived smoke set: gates on wiring and latency only; pass --cases for quality gates')
      for (const failure of failures) console.log(`FAIL    ${failure}`)
      if (failures.length === 0) console.log('PASS')
    }
    return failures.length === 0 ? 0 : 1
  } catch (error) {
    console.error(`evaluation failed: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  } finally {
    await client.close().catch(() => {})
  }
}

process.exitCode = await main()
