/**
 * Durable compact history: one searchable block per native compaction.
 *
 * The Harness keeps the replacement message in the live session, but that
 * message is the only surviving copy of everything the compaction shadowed.
 * This store keeps the same summary beside its source range, parent links, and
 * provider identity so a later turn can ask Totem what an earlier compaction
 * said without inflating the live context.
 *
 * @module dsh-totem/compaction/blocks
 */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { JsonStore, stateDir } from '../store.ts'

/** One durable compact produced by the compaction backend. */
export interface ContextBlock {
  /** Stable identity derived from the session and compaction id. */
  id: string
  /** Session that owns the compact. */
  sessionId: string
  /** Native compaction identity. */
  compactionId: string
  /** Seq of the `compaction/summary` event. */
  summarySeq: number
  /** Seq of the replacement user message, when it has been observed. */
  replacementSeq?: number
  /** First shadowed surface seq. */
  startSeq: number
  /** Last shadowed surface seq. */
  endSeq: number
  /** All shadowed surface seqs, in surface order. */
  shadowedSeqs: number[]
  /** Heuristic token price of the shadowed range. */
  shadowedTokenCount: number
  /** Text of the compact, exactly as the memory agent wrote it. */
  summary: string
  /** Hierarchy depth: 1 for a direct conversation compact. */
  tier: number
  /** Earlier compacts whose summary this compact folded in. */
  parentIds: string[]
  /** Provider that wrote the summary. */
  provider: string
  /** Model that wrote the summary. */
  model: string
  /** Creation time, ISO-8601. */
  createdAt: string
}

/** Fields needed to append one block. */
export interface ContextBlockInput {
  sessionId: string
  compactionId: string
  summarySeq: number
  startSeq: number
  endSeq: number
  shadowedSeqs: readonly number[]
  shadowedTokenCount: number
  summary: string
  provider: string
  model: string
}

function blockId(sessionId: string, compactionId: string): string {
  return createHash('sha256').update(`${sessionId}\0${compactionId}`).digest('hex').slice(0, 24)
}

function sessionFile(sessionId: string): string {
  return `${createHash('sha256').update(sessionId).digest('hex').slice(0, 32)}.json`
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function cleanBlock(value: unknown): ContextBlock | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const block = value as Record<string, unknown>
  if (typeof block.id !== 'string' || typeof block.sessionId !== 'string') return undefined
  if (typeof block.compactionId !== 'string' || typeof block.summary !== 'string') return undefined
  if (typeof block.provider !== 'string' || typeof block.model !== 'string') return undefined
  const tiers = finite(block.tier)
  const parents = Array.isArray(block.parentIds)
    ? block.parentIds.filter((parent): parent is string => typeof parent === 'string')
    : []
  return {
    id: block.id,
    sessionId: block.sessionId,
    compactionId: block.compactionId,
    summarySeq: finite(block.summarySeq),
    ...typeof block.replacementSeq === 'number' ? { replacementSeq: block.replacementSeq } : {},
    startSeq: finite(block.startSeq),
    endSeq: finite(block.endSeq),
    shadowedSeqs: Array.isArray(block.shadowedSeqs)
      ? block.shadowedSeqs.filter((seq): seq is number => typeof seq === 'number')
      : [],
    shadowedTokenCount: finite(block.shadowedTokenCount),
    summary: block.summary,
    tier: tiers > 0 ? tiers : 1,
    parentIds: parents,
    provider: block.provider,
    model: block.model,
    createdAt: typeof block.createdAt === 'string' ? block.createdAt : new Date(0).toISOString(),
  }
}

/**
 * Per-session compact archive.
 *
 * Each session is one JSON document with serialized read-modify-write cycles,
 * so a slow disk cannot let two compactions overwrite each other's block.
 */
export class ContextBlockStore {
  private readonly stores = new Map<string, JsonStore<ContextBlock[]>>()

  /** @param dir - archive directory; defaults under the Totem state directory. */
  constructor(private readonly dir: string = join(stateDir(), 'compaction')) {}

  private store(sessionId: string): JsonStore<ContextBlock[]> {
    let store = this.stores.get(sessionId)
    if (store === undefined) {
      store = new JsonStore<ContextBlock[]>(join(this.dir, sessionFile(sessionId)), [])
      this.stores.set(sessionId, store)
    }
    return store
  }

  /** Read every block for one session, oldest first. */
  async read(sessionId: string): Promise<ContextBlock[]> {
    const raw = await this.store(sessionId).read()
    return Array.isArray(raw)
      ? raw.flatMap((block) => {
        const cleaned = cleanBlock(block)
        return cleaned === undefined ? [] : [cleaned]
      })
      : []
  }

  /**
   * Append one block, or return the existing block for the same compaction.
   *
   * Parents are the earlier compacts whose summary or replacement was part of
   * the newly shadowed range. That is what makes the archive hierarchical
   * without trusting a model to produce the links.
   */
  async append(input: ContextBlockInput): Promise<ContextBlock> {
    const id = blockId(input.sessionId, input.compactionId)
    let result: ContextBlock | undefined
    await this.store(input.sessionId).update((blocks) => {
      const existing = blocks.find(block => block.id === id)
      if (existing !== undefined) {
        result = existing
        return blocks
      }
      const shadowed = new Set(input.shadowedSeqs.map(Number))
      const parents = blocks.filter(block =>
        shadowed.has(block.summarySeq)
        || (block.replacementSeq !== undefined && shadowed.has(block.replacementSeq)),
      )
      const block: ContextBlock = {
        id,
        sessionId: input.sessionId,
        compactionId: input.compactionId,
        summarySeq: input.summarySeq,
        startSeq: input.startSeq,
        endSeq: input.endSeq,
        shadowedSeqs: [...shadowed].sort((a, b) => a - b),
        shadowedTokenCount: input.shadowedTokenCount,
        summary: input.summary,
        tier: parents.length === 0 ? 1 : Math.max(...parents.map(parent => parent.tier)) + 1,
        parentIds: parents.map(parent => parent.id),
        provider: input.provider,
        model: input.model,
        createdAt: new Date().toISOString(),
      }
      result = block
      return [...blocks, block]
    })
    if (result === undefined) throw new Error('totem: compact block was not persisted')
    return result
  }

  /** Record the replacement message seq for a compact when it lands. */
  async setReplacement(sessionId: string, compactionId: string, replacementSeq: number): Promise<void> {
    await this.store(sessionId).update((blocks) => {
      let changed = false
      const next = blocks.map((block) => {
        if (block.compactionId !== compactionId || block.replacementSeq !== undefined) return block
        changed = true
        return { ...block, replacementSeq }
      })
      return changed ? next : blocks
    })
  }

  /** Search one session's compact history. */
  async search(sessionId: string, query: string, limit = 5): Promise<ContextBlock[]> {
    const blocks = await this.read(sessionId)
    return this.match(blocks, query, limit)
  }

  /** Search every session's archive, for cross-session recovery. */
  async searchAll(query: string, limit = 5): Promise<ContextBlock[]> {
    const names = await readdir(this.dir).catch(() => [])
    const found: ContextBlock[] = []
    const seen = new Set<string>()
    for (const name of names.slice(0, 1000)) {
      if (!name.endsWith('.json')) continue
      try {
        const raw = JSON.parse(await readFile(join(this.dir, name), 'utf8')) as unknown
        if (!Array.isArray(raw)) continue
        for (const item of raw) {
          const block = cleanBlock(item)
          if (block !== undefined && !seen.has(block.id)) {
            seen.add(block.id)
            found.push(block)
          }
        }
      } catch {
        // A corrupt or concurrently-written archive file is skipped.
      }
    }
    return this.match(found, query, limit)
  }

  private match(blocks: ContextBlock[], query: string, limit: number): ContextBlock[] {
    const needle = query.trim().toLowerCase()
    const matches = needle.length === 0
      ? blocks
      : blocks.filter(block =>
        block.summary.toLowerCase().includes(needle)
        || block.compactionId.toLowerCase().includes(needle)
        || block.id.toLowerCase().includes(needle),
      )
    const bounded = Math.max(1, Math.min(50, Math.floor(limit)))
    return matches
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.summarySeq - a.summarySeq)
      .slice(0, bounded)
  }
}
