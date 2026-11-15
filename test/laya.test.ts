import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LayaEngine, decide, feedback, hunksForLocalization, localizationDiff, parseCallLines, rankLocalization, slimCall, splitDiffHunks, type TurnSnapshot } from '../src/laya.ts'
import { callKindLabel, changedPaths, selectTurnCalls } from '../src/client/laya-calls.ts'

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

test('decide fails closed when a configured question is unanswered', () => {
  const questions = {
    requirements_met: { type: 'noul', instructions: 'Requirements' },
    bug_risk: { type: 'score', instructions: 'Bug risk' },
    bug_class: { type: 'choice', instructions: 'Bug class' },
  }
  const outcome = decide({ requirements_met: { noul: 1 }, bug_risk: { score: 0 } }, questions, 0.65)
  expect(outcome.verdict).toBe('needs_review')
  expect(outcome.missing).toEqual(['bug_class'])
})

test('decide maps a near-threshold composite to needs_review', () => {
  const questions = {
    requirements_met: { type: 'noul', instructions: 'Requirements' },
    bug_risk: { type: 'score', instructions: 'Bug risk' },
  }
  // requirements_met 1 and bug_risk 1 pool to 0.872, inside a band around 0.87.
  const outcome = decide(
    { requirements_met: { noul: 1 }, bug_risk: { score: 1 } },
    questions,
    { passThreshold: 0.9, reviewBand: 0.05 },
  )
  expect(outcome.verdict).toBe('needs_review')
  expect(outcome.margin).toBeGreaterThan(-0.05)
  expect(outcome.margin).toBeLessThan(0.05)
})

const config = {
  enabled: { get: () => true },
  baseUrl: { get: () => 'http://laya.test' },
  serverCommand: { get: () => '' },
  manageServer: { get: () => false },
  passThreshold: { get: () => 0.65 },
  reviewBand: { get: () => 0 },
  vetoThreshold: { get: () => 0.5 },
  confidenceFloor: { get: () => 0 },
  calibrationFile: { get: () => '' },
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
    bug_class: { choice: 'off-by-one', confidence: 0.9 },
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

test('advisory calls never become the turn decision', async () => {
  mockFetch({
    requirements_met: { noul: 1, confidence: 0.9 },
    bug_risk: { score: 0, confidence: 0.9 },
    bug_class: { choice: 'none', confidence: 0.9 },
  })
  const instance = engine(true)
  const snapshot: TurnSnapshot = {
    task: 'fix it', answer: 'done', toolCalls: [], changes: [], grounding: [], messageId: 'm1',
  }
  const outcome = await instance.advisory(snapshot, {}, new AbortController().signal)
  expect(outcome?.verdict).toBe('pass')
  expect(instance.decisionFor('m1')).toBeUndefined()
  const calls = instance.recentCalls()
  expect(calls.length).toBe(1)
  expect(calls[0].authoritative).toBe(false)
  expect(calls[0].kind).toBe('advisory')
})

test('disabled engine never evaluates or steers', async () => {
  mockFetch({ requirements_met: { noul: 0 }, bug_risk: { score: 3 } })
  let steered = false
  const agent = { session: { id: 's2', header: { cwd: '/tmp' } }, steer: () => { steered = true } }
  const snapshot: TurnSnapshot = { task: 'x', answer: 'y', toolCalls: [], changes: [], grounding: [] }
  await engine(false).onTurnStopping({ agent: agent as any, turn: 1, signal: new AbortController().signal, snapshot })
  expect(steered).toBe(false)
})

test('marginal judge results are review-only', () => {
  const settings = { passThreshold: 0.65, reviewBand: 0.05, vetoThreshold: 0.5 }
  const questions = { requirements_met: { type: 'noul' }, bug_risk: { type: 'score' } }
  const marginal = { requirements_met: { noul: 0.9 }, bug_risk: { score: 1.59 } }
  const reviewed = decide(marginal, questions, settings)
  expect(reviewed.verdict).toBe('needs_review')
  expect(reviewed.reviewOnly).toBe(true)

  const near = { requirements_met: { noul: 0.68 }, bug_risk: { score: 1.5 } }
  const nearReview = decide(near, questions, settings)
  expect(nearReview.verdict).toBe('needs_review')
  expect(nearReview.reviewOnly).toBe(true)
})

test('a clear pass is not downgraded by low confidence', () => {
  const settings = { passThreshold: 0.65, reviewBand: 0.05, vetoThreshold: 0.5, confidenceFloor: 0.7 }
  const questions = { requirements_met: { type: 'noul' }, bug_risk: { type: 'score' } }
  const outcome = decide(
    { requirements_met: { noul: 0.9, confidence: 0.1 }, bug_risk: { score: 0, confidence: 0.1 } },
    questions,
    settings,
  )
  expect(outcome.verdict).toBe('pass')
  expect(outcome.reviewOnly).toBeUndefined()
})

test('splitDiffHunks and rankLocalization narrow a diff', () => {
  const diff = [
    'diff --git a/a.py b/a.py',
    '@@ -1,2 +1,3 @@',
    ' def f():',
    '+    return 1',
    'diff --git a/b.py b/b.py',
    '@@ -4,2 +4,3 @@',
    ' def g():',
    '+    return 2',
  ].join('\n')
  const hunks = splitDiffHunks(diff)
  expect(hunks.map(hunk => hunk.added)).toEqual([['    return 1'], ['    return 2']])
  const ranked = rankLocalization(hunks, { 'hunk-0': 0.2, 'hunk-1': 0.8 })
  expect(ranked.top).toBe(1)
  expect(ranked.hunks.map(hunk => hunk.index)).toEqual([1, 0])
})

test('hard fails stay fail even at low confidence', () => {
  const settings = { passThreshold: 0.65, reviewBand: 0.05, vetoThreshold: 0.5, confidenceFloor: 0.7 }
  const questions = { requirements_met: { type: 'noul' }, bug_risk: { type: 'score' } }
  const outcome = decide(
    { requirements_met: { noul: 0.1, confidence: 0.1 }, bug_risk: { score: 3, confidence: 0.1 } },
    questions,
    settings,
  )
  expect(outcome.verdict).toBe('fail')
  expect(outcome.reviewOnly).toBeUndefined()
})

test('recorded calls are addressable by turn and pinned to the newest session', () => {
  const engine = Object.create(LayaEngine.prototype) as LayaEngine
  const record = (id: number, session: string, turn: number, kind: string, authoritative: boolean) => ({
    id, ts: '2026-01-01T00:00:00.000Z', kind, authoritative, session, turn,
    task: '', state: {}, questions: {}, answers: {}, verdict: 'pass',
    composite: null, margin: null, threshold: 0.65, missing: [], vetoes: [],
    findings: [], ms: 0,
  })
  ;(engine as unknown as { calls: unknown[] }).calls = [
    record(1, 's1', 3, 'step', false),
    record(2, 's1', 3, 'answer', true),
    record(3, 's2', 3, 'step', false),
    record(4, 's2', 4, 'answer', true),
  ]
  expect(engine.recentCalls({ turn: 3 }).map(call => call.id)).toEqual([1, 2, 3])
  expect(engine.recentCalls({ turn: 3, session: 's1' }).map(call => call.id)).toEqual([1, 2])
  expect(engine.sessionForTurn(3)).toBe('s2')
  expect(engine.sessionForTurn(99)).toBeUndefined()
  expect(engine.recentCalls({ limit: 1 }).map(call => call.id)).toEqual([4])
})

test('changed paths are read from the recorded judge state', () => {
  expect(changedPaths({ changes: [{ path: 'src/a.ts' }, { path: 'src/a.ts' }, { tool: 'edit' }, { path: 'src/b.ts' }] }))
    .toEqual(['src/a.ts', 'src/b.ts'])
  expect(changedPaths({ changes: [] })).toEqual([])
  expect(changedPaths(undefined)).toEqual([])
  expect(changedPaths({ changes: 'nope' })).toEqual([])
})

test('call kinds are labelled for humans, not as wire vocabulary', () => {
  expect(callKindLabel('answer')).toBe('Turn judgement')
  expect(callKindLabel('mutation')).toBe('Turn judgement')
  expect(callKindLabel('step')).toBe('Step check')
  expect(callKindLabel('advisory')).toBe('Advisory judgement')
  expect(callKindLabel('custom')).toBe('custom')
})

test('list responses drop the request state that only an expanded row needs', () => {
  const call = {
    id: 7, ts: '2026-01-01T00:00:00.000Z', kind: 'answer', authoritative: true,
    task: 'do it', state: { task: 'do it', changes: [] }, questions: { q: 1 },
    answers: {}, verdict: 'pass', composite: 0.9, margin: 0.2, threshold: 0.65,
    missing: [], vetoes: [], findings: [], ms: 10,
  }
  const slim = slimCall(call)
  expect(slim.state).toBeUndefined()
  expect(slim.questions).toBeUndefined()
  expect(slim.answers).toEqual({})
  expect(slim.verdict).toBe('pass')
  expect(slim.id).toBe(7)
  // The input is not mutated: the same record stays usable in memory.
  expect(call.state).toEqual({ task: 'do it', changes: [] })
})

test('a persisted call store survives bad lines and keeps the newest records', () => {
  const good = (id: number) => JSON.stringify({ id, ts: 't', kind: 'answer', authoritative: true, task: '', answers: {}, verdict: 'pass', composite: null, margin: null, threshold: 0.65, missing: [], vetoes: [], findings: [], ms: 1 })
  const text = [good(1), 'not json', '', good(2), '{"id":"x"}', good(3)].join('\n')
  expect(parseCallLines(text).map(call => call.id)).toEqual([1, 2, 3])
  expect(parseCallLines('')).toEqual([])
})

test('turn calls are pinned to the newest session that recorded that turn', () => {
  const call = (id: number, session: string, turn: number) => ({ id, session, turn, kind: 'answer', authoritative: true, ts: 't', task: '', answers: {}, verdict: 'pass', composite: null, margin: null, threshold: 0.65, missing: [], vetoes: [], findings: [], ms: 0 })
  const calls = [call(1, 's1', 4), call(2, 's1', 4), call(3, 's2', 4), call(4, 's2', 5)]
  expect(selectTurnCalls(calls, 4).map(entry => entry.id)).toEqual([3])
  expect(selectTurnCalls(calls, 5).map(entry => entry.id)).toEqual([4])
  expect(selectTurnCalls(calls, 9)).toEqual([])
})

test('an answer under the confidence floor is review-only only when marginal', () => {
  const settings = { passThreshold: 0.65, reviewBand: 0.05, vetoThreshold: 0.5, confidenceFloor: 0.5 }
  const clearTurn = decide(
    {
      requirements_met: { noul: 0.9, confidence: 0.9 },
      bug_risk: { score: 0.4, confidence: 0.05 },
      bug_class: { choice: 'none', confidence: 0.19 },
    },
    {},
    settings,
  )
  expect(clearTurn.verdict).toBe('pass')
  expect(clearTurn.reviewOnly).toBeUndefined()

  const nearTurn = decide(
    {
      requirements_met: { noul: 0.68, confidence: 0.9 },
      bug_risk: { score: 1.5, confidence: 0.05 },
      bug_class: { choice: 'none', confidence: 0.19 },
    },
    {},
    settings,
  )
  expect(nearTurn.verdict).toBe('needs_review')
  expect(nearTurn.reviewOnly).toBe(true)

  const confidentTurn = decide(
    {
      requirements_met: { noul: 0.9, confidence: 0.9 },
      bug_risk: { score: 0.4, confidence: 0.9 },
      bug_class: { choice: 'none', confidence: 0.9 },
    },
    {},
    settings,
  )
  expect(confidentTurn.verdict).toBe('pass')
  expect(confidentTurn.reviewOnly).toBeUndefined()
})

test('a clear failure is never review-only, so it still steers', () => {
  const outcome = decide(
    {
      requirements_met: { noul: 0.2, confidence: 0.9 },
      bug_risk: { score: 3, confidence: 0.9 },
      bug_class: { choice: 'off-by-one', confidence: 0.9 },
    },
    {},
    { passThreshold: 0.65, reviewBand: 0.05, vetoThreshold: 0.5, confidenceFloor: 0.5 },
  )
  expect(outcome.verdict).toBe('fail')
  expect(outcome.reviewOnly).toBeUndefined()
})

test('a multi-file diff names the file each hunk belongs to', () => {
  const diff = [
    '--- a/src/http.py',
    '+++ b/src/http.py',
    '@@ -1 +1 @@',
    '-x',
    '+retry cap 3',
    '--- a/docs/README.md',
    '+++ b/docs/README.md',
    '@@ -10 +10 @@',
    '-typo',
    '+typo fix',
  ].join('\n')
  const hunks = splitDiffHunks(diff)
  expect(hunks).toHaveLength(2)
  expect(hunks[0].header).toBe('src/http.py @@ -1 +1 @@')
  expect(hunks[1].added).toEqual(['typo fix'])
})

test('an absent diff falls through to the change payloads', () => {
  const changes = [
    { tool: 'edit', path: 'src/a.ts', input: '+alpha', output: '' },
    { tool: 'edit', path: 'src/b.ts', input: '+beta', output: '' },
  ]
  expect(localizationDiff({ diff: '', changes })).toBe('+alpha\n+beta')
  expect(localizationDiff({ diff: '@@ -1 +1 @@\n-a\n+b', changes })).toContain('@@ -1 +1 @@')
})

test('plain change payloads still produce one candidate per file', () => {
  const changes = [
    { tool: 'edit', path: 'src/a.ts', input: '+alpha', output: '' },
    { tool: 'edit', path: 'src/b.ts', input: '+\n+beta', output: '' },
  ]
  const hunks = hunksForLocalization('', changes)
  expect(hunks.map(hunk => hunk.header)).toEqual(['src/a.ts', 'src/b.ts'])
  expect(hunks[0].added).toEqual(['alpha'])
  // A real unified diff wins over the fallback.
  expect(hunksForLocalization('@@ -1 +1 @@\n-a\n+b', changes)).toHaveLength(1)
})
