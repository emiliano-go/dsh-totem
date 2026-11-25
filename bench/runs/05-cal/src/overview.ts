/**
 * Token-usage overview: records per-step usage from live sessions, backfills it
 * from the durable dsh session logs, and imports opencode/encoder history from
 * their SQLite message tables (on demand).
 *
 * The live aggregate is `~/.dsh/totem/usage.jsonl` (one row per usage/prompt
 * event, deduped by `(session, seq, kind)`). Imported history is cached as daily
 * buckets in `~/.dsh/totem/overview-import.json`, keyed by the source DB
 * signature, so a re-import is only needed when a DB changed.
 */
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { zstdDecompressSync } from 'node:zlib'

export type OverviewSource = 'dsh' | 'opencode' | 'encoder'
export type OverviewFilter = 'all' | OverviewSource

export interface UsageRow {
  kind: 'usage' | 'prompt'
  session: string
  seq: number
  time: number
  date: string
  input?: number
  output?: number
  cacheRead?: number
  total?: number
  provider?: string
  model?: string
}

export interface DayBucket {
  date: string
  tokens: number
  input: number
  output: number
  cacheRead: number
  prompts: number
  sessions: number
}

export interface Overview {
  generatedAt: string
  source: OverviewFilter
  totals: {
    tokens: number
    input: number
    output: number
    cacheRead: number
    prompts: number
    sessions: number
    activeDays: number
  }
  stats: {
    peak: { date: string; tokens: number }
    longestStreak: number
    currentStreak: number
    avgTokensPerDay: number
    avgPromptsPerDay: number
    avgTokensPerPrompt: number
    avgSessionTokens: number
  }
  models: { provider: string; model: string; tokens: number }[]
  days: DayBucket[]
  import: {
    importedAt: string | null
    sources: { source: OverviewSource; path: string; days: number; sessions: number }[]
  }
}

export interface ImportInput {
  source: Exclude<OverviewSource, 'dsh'>
  path: string
}

interface ImportDay {
  tokens: number
  input: number
  output: number
  cacheRead: number
  prompts: number
  sessions: number
}

interface ImportSource {
  source: OverviewSource
  path: string
  signature: string
  importedAt: string
  days: Record<string, ImportDay>
  models: Record<string, { provider: string; model: string; tokens: number }>
  sessions: number
}

interface ImportCache {
  version: 1
  importedAt: string
  sources: ImportSource[]
}

interface SessionEventLike {
  type?: string
  seq?: number
  time?: number
  data?: unknown
}

export const DEFAULT_IMPORTS: ImportInput[] = [
  { source: 'opencode', path: join(homedir(), '.local/share/opencode/opencode.db') },
  { source: 'encoder', path: join(homedir(), '.local/share/encoder/encoder-local.db') },
  { source: 'encoder', path: join(homedir(), '.local/share/encoder/encoder-main.db') },
]

function localDate(time: number): string {
  // en-CA yields YYYY-MM-DD in the local timezone.
  return new Date(time).toLocaleDateString('en-CA')
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function usageOf(event: SessionEventLike): {
  input?: number
  output?: number
  cacheRead?: number
  total?: number
  provider?: string
  model?: string
} | undefined {
  if (event.type !== 'assistant/message') return undefined
  const data = event.data as { usage?: { inputTokens?: unknown; outputTokens?: unknown; cacheReadTokens?: unknown; totalTokens?: unknown }; message?: { source?: { provider?: unknown; model?: unknown } } } | undefined
  const usage = data?.usage
  if (usage === undefined) return undefined
  const input = numberField(usage.inputTokens)
  const output = numberField(usage.outputTokens)
  const cacheRead = numberField(usage.cacheReadTokens)
  const total = numberField(usage.totalTokens)
  if (input === undefined && output === undefined && total === undefined) return undefined
  const source = data?.message?.source
  return {
    ...input === undefined ? {} : { input },
    ...output === undefined ? {} : { output },
    ...cacheRead === undefined ? {} : { cacheRead },
    total: total ?? (input ?? 0) + (cacheRead ?? 0) + (output ?? 0),
    ...typeof source?.provider === 'string' ? { provider: source.provider } : {},
    ...typeof source?.model === 'string' ? { model: source.model } : {},
  }
}

function promptOf(event: SessionEventLike): boolean {
  if (event.type !== 'user/message') return false
  const data = event.data as { source?: { kind?: unknown }; message?: { source?: { kind?: unknown } } } | undefined
  const source = data?.source ?? data?.message?.source
  return source?.kind === 'user'
}

export class OverviewService {
  private readonly rows: UsageRow[] = []
  private readonly seen = new Set<string>()
  private readonly queue: Promise<void>[] = []
  private backfill: Promise<void> | undefined
  private imported: ImportCache | undefined
  private readonly importCacheFile: string
  private readonly imports: ImportInput[]

  constructor(
    private readonly file: string,
    private readonly sessionsRoot = join(homedir(), '.dsh', 'sessions'),
    imports: ImportInput[] = DEFAULT_IMPORTS,
  ) {
    this.imports = imports
    this.importCacheFile = join(dirname(file), 'overview-import.json')
  }

  /** Load the durable log, backfill dsh sessions, and read the import cache. */
  async ensure(): Promise<void> {
    if (this.backfill !== undefined) return this.backfill
    this.backfill = this.run()
    return this.backfill
  }

  private async run(): Promise<void> {
    await this.load()
    await this.scanSessions()
    await this.loadImportCache()
  }

  /** Record one live session event; safe to call for every event. */
  record(session: string, event: SessionEventLike): void {
    if (session.length === 0) return
    const usage = usageOf(event)
    const prompt = promptOf(event)
    if (usage === undefined && !prompt) return
    const seq = numberField(event.seq) ?? numberField(event.time) ?? 0
    const time = numberField(event.time) ?? Date.now()
    if (usage !== undefined) {
      const row: UsageRow = {
        kind: 'usage', session, seq, time, date: localDate(time),
        ...usage.input === undefined ? {} : { input: usage.input },
        ...usage.output === undefined ? {} : { output: usage.output },
        ...usage.cacheRead === undefined ? {} : { cacheRead: usage.cacheRead },
        total: usage.total ?? 0,
        ...usage.provider === undefined ? {} : { provider: usage.provider },
        ...usage.model === undefined ? {} : { model: usage.model },
      }
      this.add(row)
    }
    if (prompt) this.add({ kind: 'prompt', session, seq, time, date: localDate(time) })
  }

  /** Aggregated daily buckets and lifetime stats for one source filter. */
  snapshot(filter: OverviewFilter = 'all'): Overview {
    const byDay = new Map<string, DayBucket>()
    const models = new Map<string, { provider: string; model: string; tokens: number }>()
    const sessions = new Set<string>()
    let tokens = 0
    let input = 0
    let output = 0
    let cacheRead = 0
    let prompts = 0

    const day = (date: string): DayBucket => {
      const existing = byDay.get(date)
      if (existing !== undefined) return existing
      const bucket: DayBucket = { date, tokens: 0, input: 0, output: 0, cacheRead: 0, prompts: 0, sessions: 0 }
      byDay.set(date, bucket)
      return bucket
    }
    const model = (provider: string, name: string, amount: number): void => {
      const key = `${provider}\0${name}`
      const entry = models.get(key) ?? { provider, model: name, tokens: 0 }
      entry.tokens += amount
      models.set(key, entry)
    }

    if (filter === 'all' || filter === 'dsh') {
      const sessionsByDay = new Map<string, Set<string>>()
      for (const row of this.rows) {
        if (row.kind === 'prompt') {
          prompts += 1
          day(row.date).prompts += 1
          continue
        }
        const total = row.total ?? 0
        tokens += total
        input += row.input ?? 0
        output += row.output ?? 0
        cacheRead += row.cacheRead ?? 0
        sessions.add(row.session)
        const bucket = day(row.date)
        bucket.tokens += total
        bucket.input += row.input ?? 0
        bucket.output += row.output ?? 0
        bucket.cacheRead += row.cacheRead ?? 0
        model(row.provider ?? '', row.model ?? '', total)
        const set = sessionsByDay.get(row.date) ?? new Set<string>()
        set.add(row.session)
        sessionsByDay.set(row.date, set)
      }
      for (const [date, set] of sessionsByDay) day(date).sessions = set.size
    }

    let importedSessions = 0
    for (const source of this.imported?.sources ?? []) {
      if (filter !== 'all' && filter !== source.source) continue
      importedSessions += source.sessions
      for (const [date, value] of Object.entries(source.days)) {
        const bucket = day(date)
        bucket.tokens += value.tokens
        bucket.input += value.input
        bucket.output += value.output
        bucket.cacheRead += value.cacheRead
        bucket.prompts += value.prompts
        bucket.sessions += value.sessions
        tokens += value.tokens
        input += value.input
        output += value.output
        cacheRead += value.cacheRead
        prompts += value.prompts
      }
      for (const entry of Object.values(source.models)) {
        model(entry.provider, entry.model, entry.tokens)
      }
    }

    const days = [...byDay.values()].sort((left, right) => left.date.localeCompare(right.date))
    const active = days.filter(entry => entry.tokens > 0)
    const peak = active.reduce<{ date: string; tokens: number }>(
      (best, entry) => entry.tokens > best.tokens ? { date: entry.date, tokens: entry.tokens } : best,
      { date: '', tokens: 0 },
    )
    const activeDays = active.length
    const uniqueSessions = sessions.size + importedSessions

    return {
      generatedAt: new Date().toISOString(),
      source: filter,
      totals: { tokens, input, output, cacheRead, prompts, sessions: uniqueSessions, activeDays },
      stats: {
        peak,
        longestStreak: longestStreak(days),
        currentStreak: currentStreak(days),
        avgTokensPerDay: activeDays === 0 ? 0 : Math.round(tokens / activeDays),
        avgPromptsPerDay: activeDays === 0 ? 0 : Math.round((prompts / activeDays) * 10) / 10,
        avgTokensPerPrompt: prompts === 0 ? 0 : Math.round(tokens / prompts),
        avgSessionTokens: uniqueSessions === 0 ? 0 : Math.round(tokens / uniqueSessions),
      },
      models: [...models.values()].sort((left, right) => right.tokens - left.tokens).slice(0, 8),
      days,
      import: {
        importedAt: this.imported?.importedAt ?? null,
        sources: (this.imported?.sources ?? []).map(source => ({
          source: source.source,
          path: source.path,
          days: Object.keys(source.days).length,
          sessions: source.sessions,
        })),
      },
    }
  }

  /**
   * Import (or re-import) every configured SQLite history DB. Read-only and
   * manual: the page's "Import history" action calls this.
   */
  async importHistory(): Promise<Overview> {
    const sources: ImportSource[] = []
    const importedAt = new Date().toISOString()
    for (const input of this.imports) {
      try {
        const signature = await sourceSignature(input.path)
        if (signature === undefined) continue
        sources.push(importDatabase(input, signature, importedAt))
      } catch {}
    }
    this.imported = { version: 1, importedAt, sources }
    try {
      await mkdir(dirname(this.importCacheFile), { recursive: true })
      await writeFile(this.importCacheFile, JSON.stringify(this.imported))
    } catch {}
    return this.snapshot('all')
  }

  private add(row: UsageRow): void {
    const key = `${row.session}\0${row.seq}\0${row.kind}`
    if (this.seen.has(key)) return
    this.seen.add(key)
    this.rows.push(row)
    const line = JSON.stringify(row) + '\n'
    this.queue.push(this.append(line))
  }

  private async append(line: string): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true })
      await appendFile(this.file, line)
    } catch {}
  }

  private async load(): Promise<void> {
    try {
      const text = await readFile(this.file, 'utf8')
      for (const line of text.split('\n')) {
        if (line.trim().length === 0) continue
        try {
          const row = JSON.parse(line) as UsageRow
          if (typeof row.session !== 'string' || typeof row.date !== 'string' || typeof row.seq !== 'number') continue
          const key = `${row.session}\0${row.seq}\0${row.kind}`
          if (this.seen.has(key)) continue
          this.seen.add(key)
          this.rows.push(row)
        } catch {}
      }
    } catch {}
  }

  private async loadImportCache(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.importCacheFile, 'utf8')) as ImportCache
      if (parsed.version === 1 && Array.isArray(parsed.sources)) this.imported = parsed
    } catch {}
  }

  /** Backfill usages and prompts from `~/.dsh/sessions/**\/session*.jsonl.zstd`. */
  private async scanSessions(): Promise<void> {
    let files: string[] = []
    try {
      files = await sessionFiles(this.sessionsRoot)
    } catch {
      return
    }
    for (const file of files) {
      try {
        const text = zstdDecompressSync(await readFile(file)).toString('utf8')
        let session = ''
        for (const line of text.split('\n')) {
          if (line.length === 0) continue
          let event: SessionEventLike & { id?: string }
          try {
            event = JSON.parse(line) as SessionEventLike & { id?: string }
          } catch {
            continue
          }
          if (event.type === 'session' && typeof event.id === 'string') {
            session = event.id
            continue
          }
          if (session.length === 0) continue
          this.record(session, event)
        }
      } catch {}
    }
    await Promise.all(this.queue)
  }
}

async function sourceSignature(path: string): Promise<string | undefined> {
  try {
    const info = await stat(path)
    let newest = info.mtimeMs
    for (const suffix of ['-wal', '-shm']) {
      try {
        newest = Math.max(newest, (await stat(path + suffix)).mtimeMs)
      } catch {}
    }
    return `${Math.round(newest)}:${info.size}`
  } catch {
    return undefined
  }
}

function importDatabase(input: ImportInput, signature: string, importedAt: string): ImportSource {
  const days = new Map<string, ImportDay>()
  const models = new Map<string, { provider: string; model: string; tokens: number }>()
  const day = (date: string): ImportDay => {
    const existing = days.get(date)
    if (existing !== undefined) return existing
    const created: ImportDay = { tokens: 0, input: 0, output: 0, cacheRead: 0, prompts: 0, sessions: 0 }
    days.set(date, created)
    return created
  }

  const sessions = new Set<string>()
  const db = new DatabaseSync(input.path, { readOnly: true })
  try {
    const usage = db.prepare(`
      SELECT
        time_created AS time,
        session_id AS session,
        json_extract(data, '$.tokens.input') AS input,
        json_extract(data, '$.tokens.output') AS output,
        json_extract(data, '$.tokens.reasoning') AS reasoning,
        json_extract(data, '$.tokens.cache.read') AS cache_read,
        json_extract(data, '$.tokens.cache.write') AS cache_write,
        json_extract(data, '$.providerID') AS provider,
        json_extract(data, '$.modelID') AS model
      FROM message
      WHERE json_extract(data, '$.role') = 'assistant'
        AND json_extract(data, '$.tokens') IS NOT NULL
    `).all() as Record<string, unknown>[]

    const sessionsByDay = new Map<string, Set<string>>()
    for (const row of usage) {
      const time = numberField(row.time)
      if (time === undefined) continue
      const date = localDate(time)
      const input = numberField(row.input) ?? 0
      const output = numberField(row.output) ?? 0
      const reasoning = numberField(row.reasoning) ?? 0
      const cacheRead = numberField(row.cache_read) ?? 0
      const cacheWrite = numberField(row.cache_write) ?? 0
      const total = input + output + reasoning + cacheRead + cacheWrite
      const bucket = day(date)
      bucket.tokens += total
      bucket.input += input
      bucket.output += output
      bucket.cacheRead += cacheRead
      const session = typeof row.session === 'string' ? row.session : ''
      if (session.length > 0) {
        sessions.add(session)
        const set = sessionsByDay.get(date) ?? new Set<string>()
        set.add(session)
        sessionsByDay.set(date, set)
      }
      const provider = typeof row.provider === 'string' ? row.provider : ''
      const name = typeof row.model === 'string' ? row.model : ''
      const key = `${provider}\0${name}`
      const entry = models.get(key) ?? { provider, model: name, tokens: 0 }
      entry.tokens += total
      models.set(key, entry)
    }

    const prompts = db.prepare(`
      SELECT time_created AS time FROM message
      WHERE json_extract(data, '$.role') = 'user'
    `).all() as Record<string, unknown>[]
    for (const row of prompts) {
      const time = numberField(row.time)
      if (time === undefined) continue
      day(localDate(time)).prompts += 1
    }

    for (const [date, set] of sessionsByDay) day(date).sessions = set.size
  } finally {
    db.close()
  }

  return {
    source: input.source,
    path: input.path,
    signature,
    importedAt,
    days: Object.fromEntries([...days.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
    models: Object.fromEntries(models),
    sessions: sessions.size,
  }
}

async function sessionFiles(root: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile() && /^session.*\.jsonl\.zstd$/u.test(entry.name)) {
        out.push(path)
      }
    }
  }
  await walk(root)
  return out
}

function longestStreak(days: DayBucket[]): number {
  let best = 0
  let run = 0
  let previous = ''
  for (const day of days) {
    if (day.tokens <= 0) continue
    run = previous.length > 0 && dayAfter(previous) === day.date ? run + 1 : 1
    best = Math.max(best, run)
    previous = day.date
  }
  return best
}

function currentStreak(days: DayBucket[]): number {
  const active = new Set(days.filter(day => day.tokens > 0).map(day => day.date))
  let cursor = localDate(Date.now())
  if (!active.has(cursor)) cursor = dayBefore(cursor)
  let streak = 0
  while (active.has(cursor)) {
    streak += 1
    cursor = dayBefore(cursor)
  }
  return streak
}

function dayAfter(date: string): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + 1)
  return value.toLocaleDateString('en-CA')
}

function dayBefore(date: string): string {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - 1)
  return value.toLocaleDateString('en-CA')
}
