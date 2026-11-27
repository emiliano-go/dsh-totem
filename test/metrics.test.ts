import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MetricsLog } from '../src/metrics.ts'

test('metrics append and summarize by type', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-metrics-'))
  const file = join(dir, 'metrics.jsonl')
  const metrics = new MetricsLog(file)
  metrics.record('memory.query', { ms: 12, results: 3 })
  metrics.record('memory.file_touch', { action: 'ignored', path: '.spike/x' })
  metrics.record('memory.query', { ms: 20, results: 1 })

  const summary = await metrics.summary(10)
  expect(summary.total).toBe(3)
  expect(summary.counts['memory.query']).toBe(2)
  expect(summary.counts['memory.file_touch']).toBe(1)
  expect(summary.recent.at(-1)?.type).toBe('memory.query')
  expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(3)
})

test('disabled metrics writes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-metrics-'))
  const file = join(dir, 'metrics.jsonl')
  const metrics = new MetricsLog(file, () => false)
  metrics.record('memory.query', { ms: 1 })
  const summary = await metrics.summary()
  expect(summary.total).toBe(0)
})
