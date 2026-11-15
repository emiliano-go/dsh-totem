import { expect, test } from 'bun:test'

import { resolveConfig } from '../src/index.ts'

function base(overrides: Record<string, unknown> = {}): any {
  return {
    command: 'totem-mcp',
    args: [],
    env: {},
    embeddingBackend: 'auto',
    embeddingModel: 'minishlab/potion-retrieval-32M',
    embeddingLocal: '',
    readRegister: true,
    autoRegister: true,
    preferFileContext: true,
    distill: true,
    digest: true,
    maxTokens: 512,
    maxInputBytes: 24000,
    timeoutMs: 15000,
    debug: false,
    ...overrides,
  }
}

test('maps embedding fields to the Totem child environment', () => {
  const resolved = resolveConfig(base({ embeddingBackend: 'model2vec' }))
  expect(resolved.env.TOTEM_EMBEDDING_BACKEND).toBe('model2vec')
  expect(resolved.env.TOTEM_EMBEDDING_MODEL).toBe('minishlab/potion-retrieval-32M')
  expect(resolved.env.TOTEM_EMBEDDING_LOCAL).toBeUndefined()
})

test('explicit env entries win over embedding fields', () => {
  const resolved = resolveConfig(base({
    embeddingBackend: 'hash',
    env: { TOTEM_EMBEDDING_BACKEND: 'model2vec' },
  }))
  expect(resolved.env.TOTEM_EMBEDDING_BACKEND).toBe('model2vec')
})

test('maps a local model directory', () => {
  const resolved = resolveConfig(base({ embeddingLocal: '/models/potion' }))
  expect(resolved.env.TOTEM_EMBEDDING_LOCAL).toBe('/models/potion')
})

test('preferFileContext can be disabled', () => {
  const resolved = resolveConfig(base({ preferFileContext: false }))
  expect(resolved.preferFileContext).toBe(false)
})
