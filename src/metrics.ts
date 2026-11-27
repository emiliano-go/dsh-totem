/**
 * Append-only metrics for the memory system and harness-edit history.
 *
 * Metrics are deliberately separate from memory: they are small JSON lines
 * under `~/.dsh/totem/metrics.jsonl`, cheap to append, and safe to inspect or
 * rotate. A metrics failure never blocks a memory or harness operation.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { statePath } from './store.ts'

export type MetricValue = string | number | boolean | null

export interface MetricEvent {
  type: string
  at: string
  [key: string]: MetricValue
}

export interface MetricsSummary {
  total: number
  since: string | null
  counts: Record<string, number>
  recent: MetricEvent[]
}

export class MetricsLog {
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly file: string = statePath('metrics.jsonl'),
    private readonly enabled: () => boolean = () => true,
  ) {}

  /** Append one event; serialized so concurrent tool calls do not interleave. */
  record(type: string, fields: Record<string, MetricValue> = {}): void {
    if (!this.enabled()) return
    const event: MetricEvent = { type, at: new Date().toISOString(), ...fields }
    this.queue = this.queue.then(async () => {
      try {
        await mkdir(dirname(this.file), { recursive: true })
        await appendFile(this.file, `${JSON.stringify(event)}\n`, 'utf8')
      } catch {
        // Metrics must remain best-effort.
      }
    })
  }

  /** Read the newest events and aggregate their types. */
  async summary(limit = 200): Promise<MetricsSummary> {
    await this.queue.catch(() => {})
    let text = ''
    try {
      text = await readFile(this.file, 'utf8')
    } catch {
      return { total: 0, since: null, counts: {}, recent: [] }
    }
    const events: MetricEvent[] = []
    const counts: Record<string, number> = {}
    let total = 0
    let since: string | null = null
    for (const line of text.split(/\r?\n/u)) {
      if (line.trim().length === 0) continue
      try {
        const event = JSON.parse(line) as MetricEvent
        if (typeof event.type !== 'string' || typeof event.at !== 'string') continue
        total += 1
        counts[event.type] = (counts[event.type] ?? 0) + 1
        if (since === null || event.at < since) since = event.at
        events.push(event)
      } catch {
        // Ignore a truncated line from a crash.
      }
    }
    return { total, since, counts, recent: events.slice(-Math.max(1, Math.min(1000, limit))) }
  }
}
