import { expect, test } from 'bun:test'
import { parseRepoUrl, summarize } from '../src/ci.ts'

test('parses GitHub remote URLs', () => {
  expect(parseRepoUrl('git@github.com:emiliano-go/trustsight.git')).toBe('emiliano-go/trustsight')
  expect(parseRepoUrl('https://github.com/emiliano-go/trustsight')).toBe('emiliano-go/trustsight')
  expect(parseRepoUrl('https://gitlab.com/a/b.git')).toBeUndefined()
})

test('summarizes running and failing checks', () => {
  const running = summarize('o/r', 'abc', [
    { name: 'build', status: 'in_progress', conclusion: null, html_url: 'u1' },
    { name: 'test', status: 'completed', conclusion: 'success', html_url: 'u2' },
  ], [])
  expect(running.done).toBe(false)
  expect(running.pending).toBe(1)

  const failed = summarize('o/r', 'abc', [
    { name: 'build', status: 'completed', conclusion: 'failure', html_url: 'u1' },
    { name: 'test', status: 'completed', conclusion: 'success', html_url: 'u2' },
  ], [])
  expect(failed.done).toBe(true)
  expect(failed.failing).toBe(1)
  expect(failed.summary).toContain('1 failing')

  const none = summarize('o/r', 'abc', [], [])
  expect(none.done).toBe(true)
  expect(none.noChecks).toBe(true)
})
