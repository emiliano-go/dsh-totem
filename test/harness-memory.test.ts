import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HarnessMemory } from '../src/harness-memory.ts'

describe('harness memory', () => {
  test('records and searches edits separately from task memory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-harness-'))
    const memory = new HarnessMemory(join(dir, 'harness.jsonl'))
    const first = await memory.record({
      rootCause: 'compaction drops late tool results',
      edit: 'raise the summary input cap',
      rationale: 'the shadowed span was much larger than the cap',
      predicted: '+2 points',
      observed: '+2.4 points',
      benchmark: 'coding',
      model: 'test-model',
      status: 'accepted',
      metrics: { delta: 2.4 },
    })
    const second = await memory.record({
      rootCause: 'compaction drops late tool results',
      edit: 'raise retain ratio',
      status: 'rejected',
      metrics: { delta: -1 },
    })
    expect(first.id).not.toBe(second.id)
    const history = await memory.history('compaction')
    expect(history).toHaveLength(2)
    expect(history[0].edit).toBe('raise retain ratio')
    expect(history[0].status).toBe('rejected')
    expect(await memory.history('unrelated')).toEqual([])
  })

  test('requires a root cause and an edit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-harness-'))
    const memory = new HarnessMemory(join(dir, 'harness.jsonl'))
    expect(memory.record({ rootCause: '', edit: 'x' })).rejects.toThrow()
    expect(memory.record({ rootCause: 'x', edit: '' })).rejects.toThrow()
  })
})
