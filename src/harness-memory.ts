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

export interface HarnessPlanOptions {
  benchmark?: string
  model?: string
  limit?: number
}

export interface HarnessPlan {
  rootCause: string
  context: { benchmark: string; model: string }
  total: number
  accepted: HarnessEdit | null
  rejected: HarnessEdit[]
  proposed: HarnessEdit[]
  nextExperiment: string
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

  /**
   * Turn the history into one bounded decision: reuse the strongest accepted
   * edit, avoid the rejected ones, and name the next experiment.
   */
  async plan(rootCause: string, options: HarnessPlanOptions = {}): Promise<HarnessPlan> {
    const query = rootCause.trim()
    const benchmark = options.benchmark?.trim() ?? ''
    const model = options.model?.trim() ?? ''
    const records = await this.history(query, options.limit ?? 50)
    const matches = (record: HarnessEdit): boolean =>
      (benchmark.length === 0 || record.benchmark.toLowerCase().includes(benchmark.toLowerCase()))
      && (model.length === 0 || record.model.toLowerCase().includes(model.toLowerCase()))
    const contextual = records.filter(matches)
    const pool = contextual.length > 0 ? contextual : records
    const strength = (record: HarnessEdit): number =>
      record.metrics.delta ?? record.metrics.score ?? 0
    const accepted = pool
      .filter(record => record.status === 'accepted')
      .sort((a, b) => strength(b) - strength(a) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
    const rejected = pool.filter(record => record.status === 'rejected').slice(0, 3)
    const proposed = pool.filter(record => record.status === 'proposed').slice(0, 3)
    const target = [benchmark, model].filter(Boolean).join(' / ') || 'the target benchmark'

    let nextExperiment: string
    if (accepted !== null) {
      const mismatch = (benchmark.length > 0 && !accepted.benchmark.toLowerCase().includes(benchmark.toLowerCase()))
        || (model.length > 0 && !accepted.model.toLowerCase().includes(model.toLowerCase()))
      nextExperiment = mismatch
        ? `Validate "${accepted.edit}" on ${target} before reusing it wholesale; the accepted record came from a different context.`
        : `Reuse "${accepted.edit}" on ${target}, measure the same metric, and record the result with harness_record.`
    } else if (rejected.length > 0) {
      nextExperiment = `Do not repeat "${rejected[0].edit}" (${rejected[0].observed || 'rejected'}); change the root-cause mechanism before retrying.`
    } else if (proposed.length > 0) {
      nextExperiment = `Evaluate the proposed "${proposed[0].edit}" on ${target} before changing anything else.`
    } else {
      nextExperiment = `No harness history for this root cause. Record a baseline with harness_record before changing the harness.`
    }

    return {
      rootCause: query,
      context: { benchmark, model },
      total: pool.length,
      accepted,
      rejected,
      proposed,
      nextExperiment,
    }
  }
}
