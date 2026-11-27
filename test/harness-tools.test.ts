import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HarnessMemory } from '../src/harness-memory.ts'
import { registerHarnessTools } from '../src/harness-tools.ts'

test('harness_plan is registered and returns the decision', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-harness-tools-'))
  const harness = new HarnessMemory(join(dir, 'harness.jsonl'))
  await harness.record({
    rootCause: 'tool output is truncated',
    edit: 'summarize the tail',
    status: 'accepted',
    benchmark: 'coding',
    model: 'model-a',
    metrics: { delta: 1.2 },
  })
  const tools: any[] = []
  const ctx = {
    tools: { register: (tool: unknown) => { tools.push(tool); return () => {} } },
  }
  registerHarnessTools(ctx as any, harness)
  const tool = tools.find(entry => entry.name === 'harness_plan')
  expect(tool).toBeDefined()
  const plan = await tool.execute({
    rootCause: 'tool output is truncated',
    benchmark: 'coding',
    model: 'model-a',
  })
  expect(plan.accepted.edit).toBe('summarize the tail')
  expect(plan.nextExperiment).toContain('summarize the tail')
})
