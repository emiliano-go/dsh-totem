/**
 * Harness-optimization history, kept separate from task memory.
 *
 * A record captures the recurring harness problem, the edit, its rationale, and
 * the predicted and observed outcomes. It is intentionally append-only and is
 * never returned by `memory_search`; `harness_history` reads it on demand.
 */
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { statePath } from './store.ts'

export type HarnessStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded'

export interface HarnessEdit {
  id: string
  rootCause: string
  edit: string
  rationale: string
  predicted: string
  observed: string
  benchmark: string
  model: string
  commit: string
  round: number
  status: HarnessStatus
  metrics: Record<string, number>
  relatedMemoryIds: string[]
  createdAt: string
}

export interface HarnessEditInput {
  rootCause: string
  edit: string
  rationale?: string
  predicted?: string
  observed?: string
  benchmark?: string
  model?: string
  commit?: string
  round?: number
  status?: HarnessStatus
  metrics?: Record<string, number>
  relatedMemoryIds?: string[]
}

export class HarnessMemory {
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly file: string = statePath('harness-edits.jsonl')) {}

  async record(input: HarnessEditInput): Promise<HarnessEdit> {
    const edit: HarnessEdit = {
      id: randomUUID(),
      rootCause: input.rootCause.trim(),
      edit: input.edit.trim(),
      rationale: input.rationale?.trim() ?? '',
      predicted: input.predicted?.trim() ?? '',
      observed: input.observed?.trim() ?? '',
      benchmark: input.benchmark?.trim() ?? '',
      model: input.model?.trim() ?? '',
      commit: input.commit?.trim() ?? '',
      round: Number.isFinite(input.round) ? Math.max(1, Math.trunc(input.round ?? 1)) : 1,
      status: input.status ?? 'proposed',
      metrics: input.metrics ?? {},
      relatedMemoryIds: input.relatedMemoryIds ?? [],
      createdAt: new Date().toISOString(),
    }
    if (edit.rootCause.length === 0 || edit.edit.length === 0) {
      throw new Error('harness record needs rootCause and edit')
    }
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      await appendFile(this.file, `${JSON.stringify(edit)}\n`, 'utf8')
    })
    await this.queue.catch(() => {})
    return edit
  }

  async history(query = '', limit = 5): Promise<HarnessEdit[]> {
    let text = ''
    try {
      text = await readFile(this.file, 'utf8')
    } catch {
      return []
    }
    const needle = query.trim().toLowerCase()
    const records: HarnessEdit[] = []
    for (const line of text.split(/\r?\n/u)) {
      if (line.trim().length === 0) continue
      try {
        const record = JSON.parse(line) as HarnessEdit
        if (typeof record.rootCause !== 'string' || typeof record.edit !== 'string') continue
        records.push(record)
      } catch {
        // Ignore a truncated tail.
      }
    }
    const matched = needle.length === 0
      ? records
      : records.filter(record =>
        [record.rootCause, record.edit, record.rationale, record.benchmark, record.model]
          .some(value => value.toLowerCase().includes(needle)),
      )
    // Append order is the source of truth; createdAt can tie within one
    // millisecond, which would otherwise hide the newest attempt.
    return matched
      .reverse()
      .slice(0, Math.max(1, Math.min(50, Math.trunc(limit))))
  }
}
