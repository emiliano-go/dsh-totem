/**
 * Conflict inbox: surfacing contradictory memories instead of silently keeping
 * both.
 *
 * Totem already detects conflicts when a memory is created — the create result
 * carries `conflicts` with both item ids and both claims — but a result that
 * only lands in a tool response is easy to miss, and the item can be written
 * anyway. This module keeps a bounded, persisted inbox of detected conflicts,
 * exposes it to the model and the Web UI, and records a resolution.
 *
 * Resolution is deliberately local. Totem's `resolve_conflict` tool needs the
 * `conflicts` table row id, and neither the create result nor the export
 * exposes it, so this inbox resolves the *knowledge*: it records a
 * `contradicts` relation and optionally supersedes the losing item. That is the
 * durable outcome a human cares about, and it never pretends to mutate a row it
 * cannot address.
 *
 * @module dsh-totem/conflicts
 */
import { randomUUID } from 'node:crypto'
import { JsonStore, statePath } from './store.ts'
import type { TotemService } from './service.ts'

/** One conflict as the create result reports it. */
export interface DetectedConflict {
  itemA?: unknown
  itemB?: unknown
  claimA?: unknown
  claimB?: unknown
  condition?: unknown
  resolutionOptions?: unknown
  recommended?: unknown
}

/** One conflict retained for review. */
export interface ConflictRecord {
  id: string
  project: string
  memoryId: string
  itemA: string
  itemB: string
  claimA: string
  claimB: string
  condition: string
  options: string[]
  recommended?: string
  createdAt: string
  resolvedAt?: string
  resolution?: string
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** Normalise one detected conflict into an inbox record. */
export function toRecord(
  project: string,
  memoryId: string,
  conflict: DetectedConflict,
  createdAt = new Date().toISOString(),
): ConflictRecord | undefined {
  const itemA = text(conflict.itemA)
  const itemB = text(conflict.itemB)
  if (itemA.length === 0 || itemB.length === 0) return undefined
  return {
    id: randomUUID(),
    project,
    memoryId,
    itemA,
    itemB,
    claimA: text(conflict.claimA),
    claimB: text(conflict.claimB),
    condition: text(conflict.condition),
    options: Array.isArray(conflict.resolutionOptions)
      ? conflict.resolutionOptions.filter((option): option is string => typeof option === 'string').slice(0, 8)
      : [],
    ...text(conflict.recommended).length === 0 ? {} : { recommended: text(conflict.recommended) },
    createdAt,
  }
}

/** Stable identity for deduplication: the same pair and condition is one conflict. */
export function conflictKey(record: ConflictRecord): string {
  return [record.itemA, record.itemB, record.condition].sort().join('|')
}

/** Which side a resolution keeps. */
export type Resolution = 'keep-a' | 'keep-b' | 'both' | string

/**
 * Persistent conflict inbox with bounded growth.
 *
 * The cap keeps the state file small; the oldest *resolved* entries are dropped
 * first so an unresolved conflict is never silently forgotten.
 */
export class ConflictInbox {
  private readonly store: JsonStore<{ items: ConflictRecord[] }>

  constructor(private readonly limit = 200) {
    this.store = new JsonStore<{ items: ConflictRecord[] }>(statePath('conflicts.json'), { items: [] })
  }

  /** Persist conflicts reported by one create/update; returns how many were new. */
  async record(project: string, memoryId: string, conflicts: unknown): Promise<number> {
    if (!Array.isArray(conflicts) || conflicts.length === 0) return 0
    const createdAt = new Date().toISOString()
    let added = 0
    await this.store.update((current) => {
      const seen = new Set(current.items.filter(item => item.resolvedAt === undefined).map(conflictKey))
      const fresh: ConflictRecord[] = []
      for (const value of conflicts) {
        if (typeof value !== 'object' || value === null) continue
        const record = toRecord(project, memoryId, value as DetectedConflict, createdAt)
        if (record === undefined) continue
        const key = conflictKey(record)
        if (seen.has(key)) continue
        seen.add(key)
        fresh.push(record)
      }
      added = fresh.length
      const items = [...current.items, ...fresh]
      const open = items.filter(item => item.resolvedAt === undefined)
      const resolved = items.filter(item => item.resolvedAt !== undefined)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      return { items: [...open, ...resolved].slice(-this.limit) }
    })
    return added
  }

  /** Read the inbox newest first, optionally filtered to one project. */
  async list(project?: string, includeResolved = false): Promise<ConflictRecord[]> {
    const { items } = await this.store.read()
    return items
      .filter(item => includeResolved || item.resolvedAt === undefined)
      .filter(item => project === undefined || project.length === 0 || item.project === project)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** Record a resolution: relate the pair as contradictory and supersede the losing side. */
  async resolve(
    id: string,
    resolution: Resolution,
    totem: TotemService,
    signal?: AbortSignal,
  ): Promise<ConflictRecord | undefined> {
    const { items } = await this.store.read()
    const record = items.find(item => item.id === id)
    if (record === undefined || record.resolvedAt !== undefined) return undefined
    const project = record.project
    try {
      // A `contradicts` relation is the durable record that both claims were
      // considered and one was chosen; it survives a later status change.
      await totem.call('memory_relate_tool', {
        from_id: record.itemA,
        to_id: record.itemB,
        kind: 'contradicts',
        project,
      }, signal)
      const loser = resolution === 'keep-a' ? record.itemB : resolution === 'keep-b' ? record.itemA : undefined
      if (loser !== undefined) {
        await totem.call('memory_update_tool', {
          id: loser,
          status: 'superseded',
          reason: `conflict resolved: ${resolution}`,
          project,
        }, signal)
      }
    } catch {
      // Keep the conflict open when the write path fails; a resolution the
      // store could not record must not look settled in the UI.
      return undefined
    }
    const resolvedAt = new Date().toISOString()
    await this.store.update(current => ({
      items: current.items.map(item => item.id === id
        ? { ...item, resolvedAt, resolution }
        : item),
    }))
    return { ...record, resolvedAt, resolution }
  }
}
