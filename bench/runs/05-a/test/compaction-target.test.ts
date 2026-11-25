import { describe, expect, test } from 'bun:test'
import { TotemService } from '../src/service.ts'

describe('Totem compaction route', () => {
  test('uses the memory model with the compact budgets', () => {
    const route = TotemService.prototype.compactionTarget.call({
      config: { compactionTokens: 2048, compactionMaxInputBytes: 64000 },
      target: () => ({
        provider: 'beam',
        model: 'beam-free',
        maxTokens: 512,
        maxInputBytes: 24000,
        timeoutMs: 15000,
      }),
    })
    expect(route).toEqual({
      provider: 'beam',
      model: 'beam-free',
      maxTokens: 2048,
      maxInputBytes: 64000,
      timeoutMs: 15000,
    })
  })

  test('has no route when the memory model is disabled', () => {
    const route = TotemService.prototype.compactionTarget.call({
      config: { compactionTokens: 2048, compactionMaxInputBytes: 64000 },
      target: () => undefined,
    })
    expect(route).toBeUndefined()
  })
})
