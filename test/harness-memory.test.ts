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

  test('plan returns the strongest accepted edit and the next experiment', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-harness-'))
    const memory = new HarnessMemory(join(dir, 'harness.jsonl'))
    await memory.record({
      rootCause: 'compaction drops late tool results',
      edit: 'raise the summary input cap',
      status: 'accepted',
      benchmark: 'coding',
      model: 'model-a',
      metrics: { delta: 2.4 },
    })
    await memory.record({
      rootCause: 'compaction drops late tool results',
      edit: 'raise the retain ratio',
      status: 'rejected',
      benchmark: 'coding',
      model: 'model-a',
      metrics: { delta: -1 },
    })
    await memory.record({
      rootCause: 'compaction drops late tool results',
      edit: 'trim the system prompt',
      status: 'accepted',
      benchmark: 'coding',
      model: 'model-a',
      metrics: { delta: 0.5 },
    })

    const plan = await memory.plan('compaction drops late tool results', {
      benchmark: 'coding',
      model: 'model-a',
    })
    expect(plan.accepted?.edit).toBe('raise the summary input cap')
    expect(plan.rejected).toHaveLength(1)
    expect(plan.nextExperiment).toContain('raise the summary input cap')
    expect(plan.nextExperiment).not.toContain('trim the system prompt')
  })

  test('plan names a baseline when there is no history', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-harness-'))
    const memory = new HarnessMemory(join(dir, 'harness.jsonl'))
    const plan = await memory.plan('new harness problem')
    expect(plan.accepted).toBeNull()
    expect(plan.nextExperiment).toContain('Record a baseline')
  })
})
