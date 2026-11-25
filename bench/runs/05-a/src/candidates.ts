/** Turn-end memory candidates and their approval flow. */
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { JsonStore, statePath } from './store.ts'
import type { TotemService } from './service.ts'
import { runOneShot } from './distill.ts'
import { TURN_EXTRACTOR_VERSION, turnCoverageUnit } from './coverage.ts'

/** One memory proposed by the turn-end distiller. */
export interface MemoryCandidate {
  id: string
  project: string
  sessionId: string
  type: string
  title: string
  statement: string
  details?: string
  tags: string[]
  aliases?: string[]
  eventTime?: string
  linkedMemoryIds?: string[]
  relations?: { to: string; kind: string }[]
  unitId?: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

/** One turn's collected evidence for distillation. */
export interface TurnEvidence {
  project: string
  sessionId: string
  text: string
  tools: string[]
  turn?: number
  changes?: { path: string; tool: string }[]
  observedAt?: string
}

const MEMORY_TYPES = new Set([
  'decision', 'invariant', 'gotcha', 'rejected_idea', 'assumption', 'open_question',
  'ambiguity', 'contract', 'constraint', 'hypothesis', 'observation', 'bug',
  'architecture', 'implementation',
])

/** Totem requires type-specific metadata; synthesize the minimal accepted shape. */
export function memoryMetadata(type: string, title: string, statement: string, project: string): Record<string, unknown> {
  switch (type) {
    case 'observation': return { observation: statement }
    case 'constraint': return { constraint: statement }
    case 'hypothesis': return { hypothesis: statement }
    case 'contract': return { subject: title }
    case 'assumption': return { claimCategory: 'fact', basis: statement }
    case 'open_question': return { question: statement, impact: 'medium', blocking: false }
    case 'ambiguity': return { question: statement, interpretations: [], impact: 'medium' }
    case 'rejected_idea': return { proposal: statement, reasonRejected: 'rejected during turn review' }
    case 'invariant': return { verificationMethod: 'manual review', condition: statement }
    case 'bug': return { symptom: statement, severity: 'medium', state: 'open' }
    case 'architecture': return { component: title, responsibility: statement }
    case 'implementation': return { subject: title, kind: 'module', path: project }
    case 'decision': return { rationale: statement }
    default: return {}
  }
}

const SYSTEM = `You extract durable engineering memory from one completed agent turn.
Return a JSON array of 0-3 objects:
{"type","title","statement","details?","tags","aliases?","event_time?","linked_memory_ids?","relations?"}.
- Only non-obvious, reusable facts: decisions and why, gotchas, invariants, architecture, constraints.
- Do not store what the next reader can see at a glance, transient task state, or anything already obvious from the code.
- Do not extract an assistant restatement of a fact already stated by the user. One claim appears once.
- Do not import details from existing memories unless the new messages explicitly mention them.
- Resolve relative dates against Observation Date and return event_time as an ISO timestamp.
- aliases: verbatim alternate phrasings, at most 5.
- linked_memory_ids: existing ids this claim refines, depends on, or contradicts.
- relations: [{"to":"existing-id","kind":"refines|depends_on|contradicts"}], only with linked ids.
- type must be one of: decision, invariant, gotcha, rejected_idea, assumption, open_question, ambiguity, contract, constraint, hypothesis, observation, bug, architecture, implementation.
- title: short noun phrase. statement: one factual sentence. tags: 1-4 lowercase kebab-case tags.
Return [] when the turn produced nothing durable. Return ONLY the JSON array.`

function parseCandidates(text: string): Omit<MemoryCandidate, 'id' | 'project' | 'sessionId' | 'createdAt' | 'status'>[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return []
      const record = item as Record<string, unknown>
      if (typeof record.title !== 'string' || typeof record.statement !== 'string') return []
      const type = typeof record.type === 'string' && MEMORY_TYPES.has(record.type) ? record.type : 'observation'
      const aliases = Array.isArray(record.aliases)
        ? record.aliases.filter((alias): alias is string => typeof alias === 'string')
          .map(alias => alias.trim()).filter(Boolean).slice(0, 5)
        : []
      const linkedMemoryIds = Array.isArray(record.linked_memory_ids)
        ? record.linked_memory_ids.filter((value): value is string => typeof value === 'string')
          .slice(0, 10)
        : []
      const relations = Array.isArray(record.relations)
        ? record.relations.filter((value): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null)
          .flatMap(value => typeof value.to === 'string' && typeof value.kind === 'string'
            ? [{ to: value.to, kind: value.kind }] : [])
          .slice(0, 10)
        : []
      return [{
        type,
        title: record.title.trim().slice(0, 200),
        statement: record.statement.trim().slice(0, 800),
        ...typeof record.details === 'string' && record.details.trim().length > 0
          ? { details: record.details.trim().slice(0, 2000) } : {},
        tags: Array.isArray(record.tags)
          ? record.tags.filter((tag): tag is string => typeof tag === 'string')
            .map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-]+/gu, '-'))
            .filter(Boolean).slice(0, 6)
          : [],
        ...aliases.length > 0 ? { aliases } : {},
        ...typeof record.event_time === 'string' && record.event_time.trim()
          ? { eventTime: record.event_time.trim() } : {},
        ...linkedMemoryIds.length > 0 ? { linkedMemoryIds } : {},
        ...relations.length > 0 ? { relations } : {},
      }]
    }).slice(0, 3)
  } catch {
    return []
  }
}

/** Persistent candidate queue plus the turn-end distiller. */
export class CandidateService {
  private readonly store = new JsonStore<{ items: MemoryCandidate[] }>(
    statePath('candidates.json'),
    { items: [] },
  )

  constructor(
    private readonly ctx: Context,
    private readonly totem: TotemService,
  ) {}

  /** Read the queue, newest first. */
  async list(): Promise<MemoryCandidate[]> {
    const { items } = await this.store.read()
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** Distill one completed turn into pending candidates; never throws. */
  async distillTurn(evidence: TurnEvidence, signal?: AbortSignal): Promise<void> {
    if (!this.totem.config.distillTurn.get()) return
    if (evidence.text.trim().length < this.totem.config.distillTurnMinChars.get()) return
    const target = this.totem.target()
    if (target === undefined) return
    const unit = turnCoverageUnit(evidence)
    if (this.totem.config.coverage?.get()) {
      const coverage = await this.totem.call('memory_coverage_tool', {
        action: 'status',
        source_kind: 'session',
        source_id: evidence.sessionId,
        units: [unit],
        extractor_version: TURN_EXTRACTOR_VERSION,
        project: evidence.project,
      }, signal).catch(() => undefined) as { covered?: string[] } | undefined
      if (coverage?.covered?.includes(unit.unit_id)) return
    }
    const input = JSON.stringify({
      project: evidence.project,
      assistantText: evidence.text.slice(0, 12000),
      tools: evidence.tools.slice(0, 40),
      observationDate: evidence.observedAt ?? new Date().toISOString(),
      turn: evidence.turn,
    })
    const output = await runOneShot(this.ctx, target, SYSTEM, input, signal, evidence.sessionId)
    if (output === undefined) return
    const parsed = parseCandidates(output)
    const createdAt = new Date().toISOString()
    const added = parsed.map(item => ({
      ...item,
      id: randomUUID(),
      project: evidence.project,
      sessionId: evidence.sessionId,
      unitId: unit.unit_id,
      createdAt,
      status: 'pending' as const,
    }))
    if (added.length > 0) {
      await this.store.update((current) => ({
        items: [...current.items, ...added].slice(-200),
      }))
    }
    if (this.totem.config.coverage?.get()) {
      await this.totem.call('memory_coverage_tool', {
        action: 'mark',
        source_kind: 'session',
        source_id: evidence.sessionId,
        unit_id: unit.unit_id,
        fingerprint: unit.fingerprint,
        extractor_version: TURN_EXTRACTOR_VERSION,
        metadata: {
          extractor: 'turn-distill',
          candidates: added.map(item => item.id),
          result: added.length === 0 ? 'empty' : 'candidates',
        },
        project: evidence.project,
      }, signal).catch(() => undefined)
    }
  }

  /** Approve one candidate into its project's Totem store. */
  async approve(id: string, signal?: AbortSignal): Promise<boolean> {
    const { items } = await this.store.read()
    const candidate = items.find(item => item.id === id)
    if (candidate === undefined || candidate.status !== 'pending') return false
    const identity = await this.totem.call('memory_identity_tool', {
      action: 'check',
      statement: candidate.statement,
      title: candidate.title,
      aliases: candidate.aliases ?? [],
      project: candidate.project,
    }, signal).catch(() => undefined) as { candidates?: { id?: string; score?: number }[] } | undefined
    const exact = identity?.candidates?.find(entry =>
      typeof entry.id === 'string' && Number(entry.score ?? 0) >= 0.98)
    const created = await this.totem.call('memory_create_tool', {
      type: candidate.type,
      title: candidate.title,
      statement: candidate.statement,
      tags: candidate.tags.length > 0 ? candidate.tags : ['turn-distilled'],
      details: candidate.details,
      ...candidate.aliases === undefined ? {} : { aliases: candidate.aliases },
      ...candidate.eventTime === undefined ? {} : { event_time: candidate.eventTime },
      provenance: [{
        source_kind: 'session',
        source_id: candidate.sessionId,
        unit_id: candidate.unitId ?? '',
        method: 'inference',
      }],
      metadata: {
        ...memoryMetadata(candidate.type, candidate.title, candidate.statement, candidate.project),
        source: 'turn-distill',
        session: candidate.sessionId,
      },
      asserted_by: 'agent',
      ...exact?.id === undefined ? {} : { link_to: exact.id },
      project: candidate.project,
    }, signal) as { id?: string } | null
    const createdId = typeof created?.id === 'string' ? created.id : undefined
    if (createdId !== undefined) {
      for (const relation of candidate.relations ?? []) {
        await this.totem.call('memory_relate_tool', {
          from_id: createdId,
          to_id: relation.to,
          kind: relation.kind,
          project: candidate.project,
        }, signal).catch(() => undefined)
      }
    }
    await this.store.update(current => ({
      items: current.items.map(item => item.id === id ? { ...item, status: 'approved' } : item),
    }))
    return true
  }

  /** Reject one candidate. */
  async reject(id: string): Promise<boolean> {
    const { items } = await this.store.read()
    if (!items.some(item => item.id === id && item.status === 'pending')) return false
    await this.store.update(current => ({
      items: current.items.map(item => item.id === id ? { ...item, status: 'rejected' } : item),
    }))
    return true
  }
}
