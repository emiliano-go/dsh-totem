import { expect, test } from 'bun:test'
import { formatDigest, lastUserTask } from '../src/index.ts'

test('digest filters file-state and prioritises durable memory', () => {
  const recent = [
    {
      type: 'implementation',
      title: 'File: src/queue.py',
      statement: 'Queue helpers.',
      importance: 0.4,
      metadata: { fileKind: 'file_tldr' },
    },
    {
      type: 'gotcha',
      title: 'Retry cap',
      statement: 'Retries stop after three attempts.',
      importance: 0.9,
    },
    {
      type: 'decision',
      title: 'Use jitter',
      statement: 'Retry delays include jitter.',
      importance: 0.8,
    },
  ]
  const text = formatDigest(recent, [])
  expect(text).toContain('Retry cap')
  expect(text).toContain('Use jitter')
  expect(text).not.toContain('File: src/queue.py')
})

test('digest keeps the memory-first hint when only file state exists', () => {
  const text = formatDigest([{
    type: 'implementation',
    title: 'File: src/queue.py',
    metadata: { fileKind: 'file_tldr' },
  }], [])
  expect(text).toContain('Memory-first')
  expect(text).not.toContain('File: src/queue.py')
})

test('lastUserTask ignores injected memory and picks the newest human turn', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'old task' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'answer' }] },
    {
      role: 'user',
      source: { kind: 'totem-memory' },
      content: [{ type: 'text', text: 'injected memory' }],
    },
    { role: 'user', content: [{ type: 'text', text: 'current task' }] },
  ]
  expect(lastUserTask(messages)).toBe('current task')
})
