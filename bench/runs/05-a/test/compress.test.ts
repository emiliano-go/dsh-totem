import { expect, test } from 'bun:test'
import { compressProse } from '../src/compress.ts'

test('compression preserves protected lines and ids', () => {
  const text = [
    '[DECISION] Retry cap: retries stop after three attempts.',
    'Evidence: src/retry.py:10-20',
    'This sentence is long and should be a candidate for removal when the budget is tight.',
    'Another long explanatory sentence that adds little beyond the first claim.',
  ].join('\n')
  const compressed = compressProse(text, 20)
  expect(compressed).toContain('src/retry.py:10-20')
  expect(compressed).toContain('Retry cap')
})

test('compression never exceeds a positive budget when ordinary prose only', () => {
  const text = 'one two three. four five six. seven eight nine.'
  const compressed = compressProse(text, 4)
  expect(compressed.length).toBeLessThanOrEqual(4 * 4)
})
