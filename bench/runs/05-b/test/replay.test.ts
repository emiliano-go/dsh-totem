import { describe, expect, test } from 'bun:test'
import { changesOf, evaluate } from '../script/replay-verify.ts'

const call = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  ts: '2026-11-15T00:00:00.000Z',
  kind: 'answer',
  verdict: 'pass',
  composite: 0.8,
  ...overrides,
})

describe('replay evaluation', () => {
  test('state changes become verify changes with their paths', () => {
    const changes = changesOf({
      changes: [
        { tool: 'edit', path: 'src/a.py', input: 'x', output: 'ok', diff: '@@ -1 +1 @@\n-a\n+b' },
        { tool: 'bash', input: 'rm -rf /', output: 'ok' },
      ],
    })
    expect(changes).toHaveLength(2)
    expect(changes[0].paths).toEqual(['src/a.py'])
    expect(changes[1].paths).toBeUndefined()
  })

  test('a judge pass that swallowed an exception is blocked deterministically', () => {
    const row = evaluate(call({
      verdict: 'pass',
      composite: 0.81,
      state: {
        changes: [{
          tool: 'edit',
          path: 'src/parser.py',
          input: 'filePath=src/parser.py',
          output: 'ok',
          diff: '@@ -1,2 +1,4 @@\n-    raise ParseError(row)\n+    try:\n+        parse(row)\n+    except Exception:\n+        pass',
        }],
      },
    }))
    expect(row.judgeBlocking).toBe(false)
    expect(row.blocking).toBe(true)
    expect(row.findings.map(finding => finding.rule)).toContain('silent-swallow')
  })

  test('a judge fail with nothing provable stays a judge-only finding', () => {
    const row = evaluate(call({
      verdict: 'fail',
      composite: 0.2,
      state: { changes: [{ tool: 'edit', path: 'src/a.ts', input: '', output: 'ok', diff: '@@ -1 +1 @@\n-a\n+b' }] },
    }))
    expect(row.blocking).toBe(false)
    expect(row.judgeBlocking).toBe(true)
  })

  test('a call recorded without state is evaluated as empty, not as failure', () => {
    const row = evaluate(call({ state: undefined }))
    expect(row.changes).toBe(0)
    expect(row.blocking).toBe(false)
  })
})
