#!/usr/bin/env bun
/**
 * CLI for the deep-research protocol.
 *
 * Everything that can be deterministic is: stage order, gate records, budget
 * counters, source/claim/gap validation, report skeleton, and the final check.
 * The agent still does the reading and writing; this tool keeps it honest.
 *
 * Usage:
 *   bun research.ts init --question "..." --subquestion "..." --subquestion "..."
 *   bun research.ts status
 *   bun research.ts gate pass --note "landscape mapped"
 *   bun research.ts advance
 *   bun research.ts budget searches 4
 *   bun research.ts source add --id S1 --url https://... --type primary --title "..."
 *   bun research.ts claim add --id C1 --statement "..." --source S1 --quote "..." --confidence high
 *   bun research.ts gap add --id G1 --kind missing --note "..." --next "..."
 *   bun research.ts gap close --id G1 --evidence "..."
 *   bun research.ts report
 *   bun research.ts check --strict
 *
 * @module deep-research/scripts/research
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  STAGES,
  addBudget,
  addClaim,
  addGap,
  addSource,
  advanceStage,
  checkState,
  closeGap,
  initResearch,
  loadState,
  renderReportSkeleton,
  renderStatus,
  researchDir,
  saveState,
  setGate,
  slugFor,
  type ClaimStatus,
  type Confidence,
  type ResearchClaim,
  type ResearchSource,
  type SourceType,
} from './lib.ts'

interface Parsed {
  positionals: string[]
  flags: Record<string, string | true | string[]>
}

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = []
  const flags: Record<string, string | true | string[]> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const equals = token.indexOf('=')
    const name = (equals === -1 ? token.slice(2) : token.slice(2, equals)).trim()
    if (name.length === 0) continue
    let value: string | true = true
    if (equals !== -1) value = token.slice(equals + 1)
    else if (argv[index + 1] !== undefined && !argv[index + 1].startsWith('--')) {
      value = argv[index + 1]
      index += 1
    }
    const existing = flags[name]
    if (existing === undefined) flags[name] = value
    else if (Array.isArray(existing)) existing.push(String(value))
    else flags[name] = [String(existing), String(value)]
  }
  return { positionals, flags }
}

function str(flags: Parsed['flags'], name: string): string | undefined {
  const value = flags[name]
  if (value === undefined || value === true) return undefined
  return Array.isArray(value) ? value.at(-1) : value
}

function list(flags: Parsed['flags'], name: string): string[] {
  const value = flags[name]
  if (value === undefined || value === true) return []
  return Array.isArray(value) ? value : [value]
}

function integer(flags: Parsed['flags'], name: string, fallback: number): number {
  const value = str(flags, name)
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer`)
  return parsed
}

function resolveDir(flags: Parsed['flags']): string {
  const explicit = str(flags, 'dir')
  if (explicit !== undefined) return explicit
  const root = join(process.cwd(), 'research')
  if (existsSync(root)) {
    const candidates = readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, 'state.json')))
      .map(entry => join(root, entry.name))
    if (candidates.length === 1) return candidates[0]
    if (candidates.length > 1) throw new Error(`multiple research runs under ${root}; pass --dir`)
  }
  throw new Error('no research state found; run init first or pass --dir')
}

function bool(flags: Parsed['flags'], name: string): boolean {
  return flags[name] === true || flags[name] === 'true'
}

function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`research: ${message}\n`)
  process.exit(1)
}

function printState(state: ReturnType<typeof loadState>, json: boolean): void {
  if (json) process.stdout.write(`${JSON.stringify(state, null, 2)}\n`)
  else process.stdout.write(`${renderStatus(state)}\n`)
}

function runInit(parsed: Parsed): void {
  const question = str(parsed.flags, 'question')
  if (question === undefined || question.trim().length === 0) throw new Error('init needs --question')
  const raw = list(parsed.flags, 'subquestion')
  if (raw.length === 0) throw new Error('init needs at least 3 --subquestion values')
  const subquestions = raw.map((item) => {
    const [text, evidence = ''] = item.split('::').map(part => part.trim())
    return { text, evidence }
  })
  const dir = str(parsed.flags, 'dir') ?? researchDir(process.cwd(), str(parsed.flags, 'slug') ?? slugFor(question))
  if (existsSync(join(dir, 'state.json')) && !bool(parsed.flags, 'force')) {
    throw new Error(`state already exists at ${dir}; use --force to replace`)
  }
  if (existsSync(join(dir, 'state.json')) && bool(parsed.flags, 'force')) {
    rmSync(join(dir, 'state.json'))
  }
  const { state } = initResearch({
    question,
    subquestions,
    dir,
    searches: integer(parsed.flags, 'searches', 25),
    pages: integer(parsed.flags, 'pages', 15),
    minutes: integer(parsed.flags, 'minutes', 45),
  })
  process.stdout.write(`initialized ${dir}\n${renderStatus(state)}\n`)
}

function runSource(parsed: Parsed): void {
  const dir = resolveDir(parsed.flags)
  const state = loadState(dir)
  const action = parsed.positionals[0]
  if (action === 'list') {
    for (const source of state.sources) process.stdout.write(`${source.id}\t${source.type}\t${source.url}\n`)
    return
  }
  if (action !== 'add') throw new Error('source needs "add" or "list"')
  const id = str(parsed.flags, 'id')
  const url = str(parsed.flags, 'url')
  const type = (str(parsed.flags, 'type') ?? 'secondary') as SourceType
  if (id === undefined || url === undefined) throw new Error('source add needs --id and --url')
  if (type !== 'primary' && type !== 'secondary') throw new Error('--type must be primary or secondary')
  const source: ResearchSource = {
    id,
    url,
    type,
    ...str(parsed.flags, 'title') === undefined ? {} : { title: str(parsed.flags, 'title') },
    ...str(parsed.flags, 'publisher') === undefined ? {} : { publisher: str(parsed.flags, 'publisher') },
    ...str(parsed.flags, 'published') === undefined ? {} : { published: str(parsed.flags, 'published') },
    ...list(parsed.flags, 'derived-from').length === 0 ? {} : { derivedFrom: list(parsed.flags, 'derived-from') },
  }
  addSource(state, source)
  saveState(dir, state)
  process.stdout.write(`source ${id} added (${state.sources.length} total)\n`)
}

function runClaim(parsed: Parsed): void {
  const dir = resolveDir(parsed.flags)
  const state = loadState(dir)
  const action = parsed.positionals[0]
  if (action === 'list') {
    const only = str(parsed.flags, 'status')
    for (const claim of state.claims.filter(item => only === undefined || item.status === only)) {
      process.stdout.write(`${claim.id}\t${claim.status}\t${claim.confidence}\t${claim.statement}\n`)
    }
    return
  }
  if (action !== 'add') throw new Error('claim needs "add" or "list"')
  const id = str(parsed.flags, 'id')
  const statement = str(parsed.flags, 'statement')
  if (id === undefined || statement === undefined) throw new Error('claim add needs --id and --statement')
  const confidence = (str(parsed.flags, 'confidence') ?? 'medium') as Confidence
  if (!['high', 'medium', 'low'].includes(confidence)) throw new Error('--confidence must be high, medium or low')
  const status = (str(parsed.flags, 'status') ?? 'supported') as ClaimStatus
  if (!['supported', 'contradicted', 'unverified'].includes(status)) throw new Error('--status must be supported, contradicted or unverified')
  const claim: ResearchClaim = {
    id,
    statement,
    sourceIds: list(parsed.flags, 'source'),
    confidence,
    status,
    ...str(parsed.flags, 'quote') === undefined ? {} : { quote: str(parsed.flags, 'quote') },
    ...str(parsed.flags, 'subquestion') === undefined ? {} : { subquestion: str(parsed.flags, 'subquestion') },
  }
  addClaim(state, claim)
  saveState(dir, state)
  process.stdout.write(`claim ${id} added (${state.claims.length} total)\n`)
}

function runGap(parsed: Parsed): void {
  const dir = resolveDir(parsed.flags)
  const state = loadState(dir)
  const action = parsed.positionals[0]
  if (action === 'add') {
    const id = str(parsed.flags, 'id')
    const kind = (str(parsed.flags, 'kind') ?? 'missing') as 'missing' | 'contradicted' | 'supported'
    const note = str(parsed.flags, 'note')
    if (id === undefined || note === undefined) throw new Error('gap add needs --id and --note')
    addGap(state, {
      id,
      kind,
      note,
      status: 'open',
      ...str(parsed.flags, 'next') === undefined ? {} : { next: str(parsed.flags, 'next') },
    })
    saveState(dir, state)
    process.stdout.write(`gap ${id} opened\n`)
    return
  }
  if (action === 'close') {
    const id = str(parsed.flags, 'id')
    if (id === undefined) throw new Error('gap close needs --id')
    closeGap(state, id, str(parsed.flags, 'evidence'))
    saveState(dir, state)
    process.stdout.write(`gap ${id} closed\n`)
    return
  }
  if (action === 'list') {
    for (const gap of state.gaps) process.stdout.write(`${gap.id}\t${gap.status}\t${gap.kind}\t${gap.note}\n`)
    return
  }
  throw new Error('gap needs "add", "close" or "list"')
}

function runReport(parsed: Parsed): void {
  const dir = resolveDir(parsed.flags)
  const state = loadState(dir)
  const path = join(dir, 'report.md')
  if (existsSync(path) && !bool(parsed.flags, 'force')) throw new Error(`${path} exists; use --force to replace`)
  writeFileSync(path, renderReportSkeleton(state), 'utf8')
  process.stdout.write(`wrote ${path}\n`)
}

function runCheck(parsed: Parsed): void {
  const dir = resolveDir(parsed.flags)
  const state = loadState(dir)
  const reportPath = str(parsed.flags, 'report') ?? join(dir, 'report.md')
  const report = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : ''
  const result = checkState(state, { report, strict: bool(parsed.flags, 'strict') })
  for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`)
  for (const error of result.errors) process.stderr.write(`error: ${error}\n`)
  if (!result.ok) {
    process.stderr.write(`check failed (${result.errors.length} error(s))\n`)
    process.exit(1)
  }
  process.stdout.write(`check passed (stage ${state.stage})\n`)
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2))
  const command = parsed.positionals.shift()
  switch (command) {
    case 'init':
      runInit(parsed)
      return
    case 'status':
      printState(loadState(resolveDir(parsed.flags)), bool(parsed.flags, 'json'))
      return
    case 'gate': {
      const dir = resolveDir(parsed.flags)
      const state = loadState(dir)
      const status = parsed.positionals[0]
      if (status !== 'pass' && status !== 'fail') throw new Error('gate needs "pass" or "fail"')
      setGate(state, status === 'pass' ? 'passed' : 'failed', str(parsed.flags, 'note'))
      saveState(dir, state)
      process.stdout.write(`gate ${state.stage}: ${state.gates[state.stage].status}\n`)
      return
    }
    case 'advance': {
      const dir = resolveDir(parsed.flags)
      const state = loadState(dir)
      const stage = advanceStage(state, { force: bool(parsed.flags, 'force') })
      saveState(dir, state)
      process.stdout.write(`advanced to ${stage}\n`)
      return
    }
    case 'budget': {
      const dir = resolveDir(parsed.flags)
      const state = loadState(dir)
      const kind = parsed.positionals[0] as 'searches' | 'pages' | 'minutes'
      const amount = Number.parseInt(parsed.positionals[1] ?? '', 10)
      if (!['searches', 'pages', 'minutes'].includes(kind)) throw new Error('budget needs searches, pages or minutes')
      addBudget(state, kind, amount)
      saveState(dir, state)
      process.stdout.write(`budget ${kind}: ${state.budget.used[kind]}/${state.budget.limits[kind]}\n`)
      return
    }
    case 'source':
      runSource(parsed)
      return
    case 'claim':
      runClaim(parsed)
      return
    case 'gap':
      runGap(parsed)
      return
    case 'report':
      runReport(parsed)
      return
    case 'check':
      runCheck(parsed)
      return
    case 'stages':
      process.stdout.write(`${STAGES.join('\n')}\n`)
      return
    default:
      throw new Error('commands: init, status, gate, advance, budget, source, claim, gap, report, check, stages')
  }
}

try {
  main()
} catch (error) {
  fail(error)
}
