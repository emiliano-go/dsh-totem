import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LayaEngine, decide, feedback, type TurnSnapshot } from '../src/laya.ts'

test('decide vetoes, scores, and explains failures', () => {
  const bad = decide({
    requirements_met: { noul: 0.2, confidence: 0.8 },
    bug_risk: { score: 3, confidence: 0.7, probabilities: { '0': 0.05, '1': 0.05, '2': 0.1, '3': 0.8 } },
    bug_class: { choice: 'off-by-one', confidence: 0.9 },
  }, { requirements_met: { instructions: 'Requirements' }, bug_risk: { instructions: 'Bug risk' } }, 0.65)
  expect(bad.verdict).toBe('fail')
  expect(bad.vetoes).toEqual(['requirements_met', 'bug_risk'])
  expect(bad.bugClass).toBe('off-by-one')
  expect(feedback(bad, 0.65, ['src/a.ts'])).toContain('src/a.ts')
  const good = decide({ requirements_met: { noul: 1 }, bug_risk: { score: 0 } }, {}, 0.65)
  expect(good.verdict).toBe('pass')
})

const config = {
  enabled: { get: () => true },
  baseUrl: { get: () => 'http://laya.test' },
  serverCommand: { get: () => '' },
  manageServer: { get: () => false },
  passThreshold: { get: () => 0.65 },
  maxRetries: { get: () => 1 },
  timeoutMs: { get: () => 5000 },
  questionsFile: { get: () => '' },
  model: { get: () => 'test' },
  stepChecks: { get: () => 'veto' },
  stepCadence: { get: () => 'turn' },
  stepMaxFeedback: { get: () => 2 },
  verifyCommand: { get: () => '' },
  verifyExternal: { get: () => 'off' },
  verifyDisable: { get: () => [] },
}

function engine(on: boolean): LayaEngine {
  const totem = { call: async () => [], config: {} }
  const instance = new LayaEngine({} as any, totem as any, config as any, join(mkdtempSync(join(tmpdir(), 'laya-')), 'laya.json'))
  ;(instance as any).on = on
  ;(instance as any).loaded = on
  return instance
}

function mockFetch(answers: Record<string, unknown> | null): void {
  ;(globalThis as any).fetch = async (url: string) => {
    if (String(url).endsWith('/health')) return { ok: true, json: async () => ({}) }
    if (answers === null) return { ok: false, json: async () => ({}) }
    return { ok: true, json: async () => ({ answers }) }
  }
}

test('turn-stopping steers with feedback on a failing verdict', async () => {
  mockFetch({
    requirements_met: { noul: 0.1, confidence: 0.9 },
    bug_risk: { score: 3, confidence: 0.9 },
  })
  let steered: any
  const agent = { session: { id: 's1', header: { cwd: '/tmp' } }, steer: (message: unknown) => { steered = message } }
  const snapshot: TurnSnapshot = { task: 'fix it', answer: 'done', toolCalls: [], changes: [], grounding: [] }
  await engine(true).onTurnStopping({ agent: agent as any, turn: 1, signal: new AbortController().signal, snapshot })
  expect(steered.source.kind).toBe('laya-feedback')
  expect(steered.content[0].text).toContain('failed')
})

test('step checks flag deterministic findings once and respect the budget', async () => {
  mockFetch(null)
  const instance = engine(true)
  const snapshot: TurnSnapshot = {
    task: 'add key',
    answer: 'added',
    toolCalls: [],
    changes: [{ tool: 'write', path: 'src/a.ts', input: 'const apiKey = "sk-live-abcdefgh12345678"', output: '' }],
    grounding: [],
  }
  const first = await instance.checkStep({ snapshot, agent: {}, signal: new AbortController().signal, key: 's:1' })
  expect(first).toContain('secret-hardcoded')
  const second = await instance.checkStep({ snapshot, agent: {}, signal: new AbortController().signal, key: 's:1' })
  expect(second).toBeUndefined()
})

test('disabled engine never evaluates or steers', async () => {
  mockFetch({ requirements_met: { noul: 0 }, bug_risk: { score: 3 } })
  let steered = false
  const agent = { session: { id: 's2', header: { cwd: '/tmp' } }, steer: () => { steered = true } }
  const snapshot: TurnSnapshot = { task: 'x', answer: 'y', toolCalls: [], changes: [], grounding: [] }
  await engine(false).onTurnStopping({ agent: agent as any, turn: 1, signal: new AbortController().signal, snapshot })
  expect(steered).toBe(false)
})
