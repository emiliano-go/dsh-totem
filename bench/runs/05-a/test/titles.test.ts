import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  TITLE_TURNS,
  TldrStore,
  recentTurns,
  titleDecision,
  tldrFromOutput,
  tldrInput,
  titleFromOutput,
} from '../src/titles.ts'

const user = (seq: number, text: string) => ({
  type: 'user/message',
  seq,
  data: { message: { content: [{ type: 'text', text }], source: { kind: 'user' } } },
})
const assistant = (seq: number, text: string) => ({
  type: 'assistant/message',
  seq,
  data: { message: { content: [{ type: 'text', text }] } },
})
const touched = (seq: number, path: string) => ({
  type: 'tool/result',
  seq,
  data: { meta: { path } },
})

const snapshot = (kind: 'user' | 'provider' | 'fallback', title = 'Old title') => ({
  title,
  source: kind === 'provider' ? { kind, provider: 'totem-titles' } : { kind },
  messageSeqs: [],
  eventSeq: 1,
  updatedAt: 1,
} as never)

const messages = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ seq: index + 1, text: `turn ${index + 1}` }))

test('recentTurns keeps the last three completed turns with files', () => {
  const turns = recentTurns([
    user(1, 'first task'),
    assistant(2, 'first answer'),
    touched(3, '/a.ts'),
    user(4, 'second task'),
    assistant(5, 'second answer'),
    user(6, 'third task'),
    assistant(7, 'third answer'),
    touched(8, '/b.ts'),
    user(9, 'fourth task'),
    assistant(10, 'fourth answer'),
  ] as never[], 3)
  expect(turns.map(turn => turn.user)).toEqual(['second task', 'third task', 'fourth task'])
  expect(turns[1].files).toEqual(['/b.ts'])
})

test('recentTurns ignores non-user messages and empty turns', () => {
  const turns = recentTurns([
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'no user' }] } } },
    { type: 'user/message', data: { message: { content: [], source: { kind: 'system' } } } },
    user(1, 'real task'),
  ] as never[])
  expect(turns).toHaveLength(1)
  expect(turns[0].user).toBe('real task')
})

test('tldrInput bounds long turn text', () => {
  const input = tldrInput([{ user: 'u'.repeat(2000), assistant: 'a'.repeat(3000), files: ['/x'] }])
  const parsed = JSON.parse(input) as { turns: { user: string; assistant: string }[] }
  expect(parsed.turns[0].user.length).toBeLessThan(700)
  expect(parsed.turns[0].assistant.length).toBeLessThan(1000)
})

test('titleDecision refuses to overwrite a manual title', () => {
  const decision = titleDecision(messages(2), snapshot('user', 'Mine'))
  expect(decision).toEqual({ mode: 'manual', title: 'Mine' })
})

test('titleDecision settles after the fifth turn', () => {
  const decision = titleDecision(messages(TITLE_TURNS + 1), snapshot('provider', 'Settled'))
  expect(decision).toEqual({ mode: 'settled', title: 'Settled' })
})

test('titleDecision still generates when the title is only the fallback', () => {
  const decision = titleDecision(messages(TITLE_TURNS + 1), snapshot('fallback', 'fallback'))
  expect(decision.mode).toBe('generate')
  if (decision.mode !== 'generate') return
  expect(decision.window).toHaveLength(TITLE_TURNS)
  expect(decision.anchor).toBeUndefined()
})

test('titleDecision anchors a provider title inside the first five turns', () => {
  const decision = titleDecision(messages(2), snapshot('provider', 'Current'))
  expect(decision.mode).toBe('generate')
  if (decision.mode !== 'generate') return
  expect(decision.window).toHaveLength(2)
  expect(decision.anchor).toBe('Current')
})

test('titleFromOutput unwraps whole-line emphasis', () => {
  expect(titleFromOutput('**Hover TLDR**')).toBe('Hover TLDR')
  expect(titleFromOutput('\nTitle line\nsecond line')).toBe('Title line')
})

test('tldrFromOutput removes labels, quotes and caps the length', () => {
  expect(tldrFromOutput('TLDR: "Fixed the parser."')).toBe('Fixed the parser.')
  expect(tldrFromOutput('`Titles and hover summaries`')).toBe('Titles and hover summaries')
  const long = tldrFromOutput('x'.repeat(400))
  expect(long?.length).toBe(240)
  expect(long?.endsWith('…')).toBe(true)
})

test('TldrStore round-trips and prunes expired records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'totem-tldr-'))
  try {
    const store = new TldrStore(join(dir, 'tldr.json'))
    expect(await store.get('s1')).toBeUndefined()
    await store.put('s1', { tldr: 'One', updatedAt: Date.now() })
    await store.put('s2', { tldr: 'Old', updatedAt: Date.now() - 40 * 24 * 60 * 60 * 1000 })
    expect((await store.get('s1'))?.tldr).toBe('One')
    expect(await store.get('s2')).toBeUndefined()
    await store.put('s1', { tldr: '', updatedAt: Date.now() })
    expect((await store.get('s1'))?.tldr).toBe('One')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
