import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { OverviewService } from '../src/overview.ts'

function sessionEvent(type: string, seq: number, time: number, data: unknown): string {
  return JSON.stringify({ type, seq, time, data })
}

test('overview backfills session usage and aggregates days', async () => {
  const home = mkdtempSync(join(tmpdir(), 'overview-'))
  const sessions = join(home, 'sessions')
  const dir = join(sessions, '--proj--', 'session-test')
  mkdirSync(dir, { recursive: true })
  const time = Date.UTC(2026, 10, 14, 15, 0, 0)
  const lines = [
    JSON.stringify({ type: 'session', version: 4, id: 'session-test' }),
    sessionEvent('user/message', 1, time, { source: { kind: 'user' }, role: 'user' }),
    sessionEvent('user/message', 2, time, { source: { kind: 'agent' }, role: 'user' }),
    sessionEvent('assistant/message', 3, time, {
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      message: { source: { provider: 'p', model: 'm' } },
    }),
    sessionEvent('assistant/message', 4, time + 1000, {
      usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
      message: { source: { provider: 'p', model: 'm' } },
    }),
  ]
  writeFileSync(join(dir, 'session.v4.jsonl.zstd'), zstdCompressSync(Buffer.from(lines.join('\n'))))

  const service = new OverviewService(join(home, 'usage.jsonl'), sessions)
  await service.ensure()
  const overview = service.snapshot()
  expect(overview.totals.tokens).toBe(180)
  expect(overview.totals.input).toBe(150)
  expect(overview.totals.output).toBe(30)
  expect(overview.totals.prompts).toBe(1)
  expect(overview.totals.sessions).toBe(1)
  expect(overview.days).toHaveLength(1)
  expect(overview.days[0].tokens).toBe(180)
  expect(overview.days[0].prompts).toBe(1)
  expect(overview.models[0]).toEqual({ provider: 'p', model: 'm', tokens: 180 })

  // Live rows dedupe by session/seq.
  service.record('session-test', {
    type: 'assistant/message', seq: 4, time: time + 1000,
    data: { usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 } },
  })
  service.record('session-test', {
    type: 'assistant/message', seq: 5, time: time + 2000,
    data: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  })
  expect(service.snapshot().totals.tokens).toBe(182)

  // A restart loads the durable log without double counting.
  await Bun.sleep(20)
  const again = new OverviewService(join(home, 'usage.jsonl'), sessions)
  await again.ensure()
  expect(again.snapshot().totals.tokens).toBe(182)
})

test('overview imports opencode-style message tables', async () => {
  const home = mkdtempSync(join(tmpdir(), 'overview-import-'))
  const sessions = join(home, 'sessions')
  mkdirSync(sessions, { recursive: true })
  const dbPath = join(home, 'opencode.db')
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(dbPath)
  db.exec('CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT)')
  const insert = db.prepare('INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)')
  const assistant = (input: number, output: number, reasoning: number, cacheRead: number) => JSON.stringify({
    role: 'assistant',
    tokens: { input, output, reasoning, cache: { read: cacheRead, write: 0 } },
    providerID: 'p',
    modelID: 'm',
  })
  const day1 = Date.UTC(2026, 10, 13, 15)
  const day2 = Date.UTC(2026, 10, 14, 15)
  insert.run('a1', 's1', day1, assistant(100, 20, 5, 30))
  insert.run('a2', 's1', day1, assistant(50, 10, 0, 0))
  insert.run('a3', 's2', day2, assistant(10, 1, 0, 2))
  insert.run('u1', 's1', day1, JSON.stringify({ role: 'user' }))
  insert.run('u2', 's2', day2, JSON.stringify({ role: 'user' }))
  db.close()

  const service = new OverviewService(join(home, 'usage.jsonl'), sessions, [{ source: 'opencode', path: dbPath }])
  await service.ensure()
  expect(service.snapshot('opencode').totals.tokens).toBe(0)
  const imported = await service.importHistory()
  expect(imported.totals.tokens).toBe(228)
  expect(imported.totals.input).toBe(160)
  expect(imported.totals.output).toBe(31)
  expect(imported.totals.cacheRead).toBe(32)
  expect(imported.totals.prompts).toBe(2)
  expect(imported.totals.sessions).toBe(2)
  expect(imported.days).toHaveLength(2)
  expect(imported.days[0].tokens).toBe(215)
  expect(imported.days[1].tokens).toBe(13)
  expect(imported.models[0]).toEqual({ provider: 'p', model: 'm', tokens: 228 })

  const again = new OverviewService(join(home, 'usage.jsonl'), sessions, [{ source: 'opencode', path: dbPath }])
  await again.ensure()
  expect(again.snapshot('all').totals.tokens).toBe(228)
  expect(again.snapshot('dsh').totals.tokens).toBe(0)
})
