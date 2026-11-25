/**
 * Deterministic research state for the deep-research skill.
 *
 * The skill is a protocol, but a protocol that lives only in prose is easy to
 * skip. This module owns the parts that must not be improvised: the stage
 * order, gate records, budget counters, source/claim/gap ledgers, and the
 * final check that decides whether the report is allowed to ship.
 *
 * State lives in `research/<slug>/state.json` and the report in
 * `research/<slug>/report.md`, so a compacted or restarted session can resume
 * from the last completed stage instead of starting over.
 *
 * @module deep-research/scripts/lib
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** The ordered protocol. */
export const STAGES = [
  'brief',
  'landscape',
  'plan',
  'depth',
  'midpoint',
  'edges',
  'verify',
  'report',
  'redteam',
] as const

export type Stage = (typeof STAGES)[number]
export type GateStatus = 'pending' | 'passed' | 'failed'
export type Confidence = 'high' | 'medium' | 'low'
export type ClaimStatus = 'supported' | 'contradicted' | 'unverified'
export type SourceType = 'primary' | 'secondary'

/** One cited source. */
export interface ResearchSource {
  id: string
  url: string
  title?: string
  type: SourceType
  publisher?: string
  published?: string
  retrieved?: string
  /** Source ids this one derives from; used for the independence check. */
  derivedFrom?: string[]
}

/** One load-bearing claim and its evidence. */
export interface ResearchClaim {
  id: string
  subquestion?: string
  statement: string
  sourceIds: string[]
  quote?: string
  confidence: Confidence
  status: ClaimStatus
}

/** One open or closed gap. */
export interface ResearchGap {
  id: string
  kind: 'missing' | 'contradicted' | 'supported'
  note: string
  next?: string
  status: 'open' | 'closed'
  evidence?: string
}

/** Persisted research state. */
export interface ResearchState {
  version: 1
  slug: string
  question: string
  createdAt: string
  updatedAt: string
  stage: Stage
  gates: Record<Stage, { status: GateStatus; note?: string; at?: string }>
  budget: {
    limits: { searches: number; pages: number; minutes: number }
    used: { searches: number; pages: number; minutes: number }
  }
  subquestions: { id: string; text: string; evidence: string }[]
  sources: ResearchSource[]
  claims: ResearchClaim[]
  gaps: ResearchGap[]
  history: { at: string; event: string }[]
}

/** Result of one validation run. */
export interface CheckResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/** Filesystem-safe slug, bounded. */
export function slugFor(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48) || 'research'
}

/** Directory for one research run. */
export function researchDir(cwd: string, slug: string): string {
  return join(cwd, 'research', slug)
}

export interface InitOptions {
  question: string
  subquestions: { id?: string; text: string; evidence?: string }[]
  slug?: string
  dir?: string
  searches?: number
  pages?: number
  minutes?: number
  now?: string
}

/** Create and persist a new research run. */
export function initResearch(options: InitOptions): { state: ResearchState; dir: string } {
  const slug = options.slug ?? slugFor(options.question)
  const dir = options.dir ?? researchDir(process.cwd(), slug)
  if (existsSync(join(dir, 'state.json'))) {
    throw new Error(`research state already exists at ${dir}; resume it or pass --force`)
  }
  const now = options.now ?? new Date().toISOString()
  const subquestions = options.subquestions.map((item, index) => ({
    id: item.id ?? `Q${index + 1}`,
    text: item.text,
    evidence: item.evidence ?? '',
  }))
  if (subquestions.length < 3) throw new Error('init requires at least 3 subquestions')
  const state: ResearchState = {
    version: 1,
    slug,
    question: options.question,
    createdAt: now,
    updatedAt: now,
    stage: 'brief',
    gates: Object.fromEntries(STAGES.map(stage => [stage, { status: 'pending' as GateStatus }])) as ResearchState['gates'],
    budget: {
      limits: {
        searches: options.searches ?? 25,
        pages: options.pages ?? 15,
        minutes: options.minutes ?? 45,
      },
      used: { searches: 0, pages: 0, minutes: 0 },
    },
    subquestions,
    sources: [],
    claims: [],
    gaps: [],
    history: [{ at: now, event: 'init' }],
  }
  saveState(dir, state)
  return { state, dir }
}

/** Load state from a research directory. */
export function loadState(dir: string): ResearchState {
  const path = join(dir, 'state.json')
  if (!existsSync(path)) throw new Error(`no research state at ${dir}`)
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null) throw new Error('state.json is not an object')
  const state = parsed as ResearchState
  if (state.version !== 1) throw new Error(`unsupported state version ${String(state.version)}`)
  if (!STAGES.includes(state.stage)) throw new Error(`unknown stage "${String(state.stage)}"`)
  return state
}

/** Persist state atomically. */
export function saveState(dir: string, state: ResearchState): void {
  state.updatedAt = new Date().toISOString()
  mkdirSync(dirname(join(dir, 'state.json')), { recursive: true })
  const path = join(dir, 'state.json')
  const temp = `${path}.tmp`
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

/** Move to the next stage, requiring the current gate unless forced. */
export function advanceStage(state: ResearchState, options: { force?: boolean; now?: string } = {}): Stage {
  const index = STAGES.indexOf(state.stage)
  if (index === STAGES.length - 1) throw new Error('already at the final stage (redteam)')
  const gate = state.gates[state.stage]
  if (gate.status !== 'passed' && options.force !== true) {
    throw new Error(`gate "${state.stage}" is ${gate.status}; pass it before advancing (or use --force)`)
  }
  state.stage = STAGES[index + 1]
  state.history.push({ at: options.now ?? new Date().toISOString(), event: `advance -> ${state.stage}` })
  return state.stage
}

/** Record the current stage's gate. */
export function setGate(
  state: ResearchState,
  status: GateStatus,
  note?: string,
  now = new Date().toISOString(),
): void {
  state.gates[state.stage] = {
    status,
    ...note === undefined ? {} : { note },
    at: now,
  }
  state.history.push({ at: now, event: `gate ${state.stage}: ${status}` })
}

/** Add usage to one budget counter. */
export function addBudget(state: ResearchState, kind: 'searches' | 'pages' | 'minutes', amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('budget amount must be a non-negative integer')
  state.budget.used[kind] += amount
}

/** Add a source, rejecting duplicate ids and invalid URLs. */
export function addSource(state: ResearchState, source: Omit<ResearchSource, 'retrieved'> & { retrieved?: string }): void {
  if (state.sources.some(item => item.id === source.id)) throw new Error(`source ${source.id} already exists`)
  const url = new URL(source.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('source URL must be http(s)')
  state.sources.push({ ...source, retrieved: source.retrieved ?? new Date().toISOString().slice(0, 10) })
}

/** Add a claim, validating that every cited source exists. */
export function addClaim(state: ResearchState, claim: ResearchClaim): void {
  if (state.claims.some(item => item.id === claim.id)) throw new Error(`claim ${claim.id} already exists`)
  if (claim.sourceIds.length === 0) throw new Error('claim needs at least one source')
  for (const id of claim.sourceIds) {
    if (!state.sources.some(source => source.id === id)) throw new Error(`claim ${claim.id} cites unknown source ${id}`)
  }
  state.claims.push(claim)
}

/** Add a gap. */
export function addGap(state: ResearchState, gap: ResearchGap): void {
  if (state.gaps.some(item => item.id === gap.id)) throw new Error(`gap ${gap.id} already exists`)
  state.gaps.push(gap)
}

/** Close a gap with optional evidence. */
export function closeGap(state: ResearchState, id: string, evidence?: string): void {
  const gap = state.gaps.find(item => item.id === id)
  if (gap === undefined) throw new Error(`unknown gap ${id}`)
  gap.status = 'closed'
  if (evidence !== undefined) gap.evidence = evidence
}

/** Two secondary sources are independent when they have different domains and neither derives from the other. */
export function independentSecondary(state: ResearchState, left: ResearchSource, right: ResearchSource): boolean {
  if (left.type !== 'secondary' || right.type !== 'secondary') return false
  if (left.id === right.id) return false
  if (left.derivedFrom?.includes(right.id) === true || right.derivedFrom?.includes(left.id) === true) return false
  try {
    return new URL(left.url).hostname !== new URL(right.url).hostname
  } catch {
    return false
  }
}

/** Whether one claim meets the evidence rule. */
export function claimVerified(state: ResearchState, claim: ResearchClaim): boolean {
  const sources = claim.sourceIds
    .map(id => state.sources.find(source => source.id === id))
    .filter((source): source is ResearchSource => source !== undefined)
  if (sources.some(source => source.type === 'primary')) return true
  const secondary = sources.filter(source => source.type === 'secondary')
  for (let left = 0; left < secondary.length; left += 1) {
    for (let right = left + 1; right < secondary.length; right += 1) {
      if (independentSecondary(state, secondary[left], secondary[right])) return true
    }
  }
  return false
}

/** Validate the state and, when present, the report. */
export function checkState(state: ResearchState, options: { report?: string; strict?: boolean } = {}): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const stageIndex = STAGES.indexOf(state.stage)
  if (state.question.trim().length === 0) errors.push('question is empty')
  if (state.subquestions.length < 3) errors.push('fewer than 3 subquestions')
  for (const stage of STAGES.slice(0, stageIndex)) {
    if (state.gates[stage].status !== 'passed') errors.push(`earlier gate "${stage}" is ${state.gates[stage].status}`)
  }
  for (const [kind, used] of Object.entries(state.budget.used) as ['searches' | 'pages' | 'minutes', number][]) {
    const limit = state.budget.limits[kind]
    if (used > limit) warnings.push(`budget exceeded: ${kind} ${used}/${limit}`)
  }
  const sourceIds = new Set(state.sources.map(source => source.id))
  for (const claim of state.claims) {
    if (claim.statement.trim().length === 0) errors.push(`claim ${claim.id} has no statement`)
    if (claim.sourceIds.length === 0) errors.push(`claim ${claim.id} has no source`)
    for (const id of claim.sourceIds) {
      if (!sourceIds.has(id)) errors.push(`claim ${claim.id} cites unknown source ${id}`)
    }
    if (claim.status === 'supported' && claim.confidence === 'high') {
      if (!claimVerified(state, claim)) {
        errors.push(`load-bearing claim ${claim.id} is not verified (needs a primary source or two independent secondaries)`)
      }
      if ((claim.quote ?? '').trim().length === 0) errors.push(`load-bearing claim ${claim.id} has no supporting quote`)
    }
  }
  const openGaps = state.gaps.filter(gap => gap.status === 'open')
  if (stageIndex >= STAGES.indexOf('verify')) {
    for (const gap of openGaps) errors.push(`open gap ${gap.id} (${gap.kind}): ${gap.note}`)
  } else if (openGaps.length > 0) {
    warnings.push(`${openGaps.length} open gap(s)`)
  }
  if (stageIndex >= STAGES.indexOf('report')) {
    const report = options.report ?? ''
    for (const section of ['## Answer', '## Evidence', '## Sources']) {
      if (!report.includes(section)) errors.push(`report is missing ${section}`)
    }
    const cited = new Set([...report.matchAll(/\[(S[0-9A-Za-z_-]+)\]/gu)].map(match => match[1]))
    for (const id of cited) {
      if (!sourceIds.has(id)) errors.push(`report cites unknown source ${id}`)
    }
    for (const claim of state.claims) {
      if (!report.includes(claim.id)) warnings.push(`report does not cite claim ${claim.id}`)
    }
    if (options.strict === true) {
      for (const warning of warnings.filter(item => item.includes('does not cite claim'))) errors.push(warning)
      for (const source of state.sources) {
        if (!cited.has(source.id)) errors.push(`source ${source.id} is listed but never cited in the report`)
      }
    }
  }
  if (state.sources.length === 0) warnings.push('no sources recorded')
  if (state.claims.length === 0) warnings.push('no claims recorded')
  return { ok: errors.length === 0, errors, warnings }
}

/** Human-readable status. */
export function renderStatus(state: ResearchState): string {
  const stage = STAGES.indexOf(state.stage) + 1
  const lines = [
    `${state.question}`,
    `stage ${stage}/${STAGES.length}: ${state.stage} · gate ${state.gates[state.stage].status}`,
    `budget: searches ${state.budget.used.searches}/${state.budget.limits.searches}, pages ${state.budget.used.pages}/${state.budget.limits.pages}, minutes ${state.budget.used.minutes}/${state.budget.limits.minutes}`,
    `subquestions ${state.subquestions.length} · sources ${state.sources.length} · claims ${state.claims.length} · open gaps ${state.gaps.filter(gap => gap.status === 'open').length}`,
  ]
  for (const item of state.subquestions) lines.push(`  ${item.id}: ${item.text}`)
  return lines.join('\n')
}

/** Markdown report skeleton built from the ledger. */
export function renderReportSkeleton(state: ResearchState): string {
  const rows = state.claims.map(claim => {
    const sources = claim.sourceIds.map(id => `[${id}]`).join(', ')
    return `| ${claim.id} | ${claim.statement.replaceAll('|', '\\|')} | ${sources} | ${claim.confidence} |`
  })
  const sources = state.sources.map(source => {
    const published = source.published ?? '—'
    return `| ${source.id} | ${source.title ?? source.url} — ${source.url} | ${source.type} | ${published} / ${source.retrieved ?? '—'} |`
  })
  const gaps = state.gaps.map(gap => `- **${gap.id}** (${gap.kind}/${gap.status}): ${gap.note}`)
  return [
    `# ${state.question}`,
    '',
    '## Answer',
    '',
    '_TODO: 2–5 sentences that directly answer the question._',
    '',
    '## Evidence',
    '',
    '| # | Claim | Sources | Confidence |',
    '|---|-------|---------|------------|',
    ...rows.length === 0 ? ['| — | — | — | — |'] : rows,
    '',
    '## Details',
    '',
    '_TODO: organize by subquestion; inline [S#] citations on every factual sentence._',
    '',
    '## Contradictions and gaps',
    '',
    ...gaps.length === 0 ? ['_None recorded._'] : gaps,
    '',
    '## Sources',
    '',
    '| # | Source | Type | Published / retrieved |',
    '|---|--------|------|-----------------------|',
    ...sources.length === 0 ? ['| — | — | — | — |'] : sources,
    '',
    '## Method',
    '',
    `Queries: ${state.budget.used.searches} · Pages: ${state.budget.used.pages} · Minutes: ${state.budget.used.minutes} · Stage: ${state.stage}`,
    '',
  ].join('\n')
}
