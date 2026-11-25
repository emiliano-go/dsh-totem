import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionLedger } from '../src/ledger.ts'

function user(text: string) {
  return {
    type: 'user/message',
    data: { message: { source: { kind: 'user' }, content: [{ type: 'text', text }] } },
  }
}

function toolCall(callId: string, name: string, args: Record<string, unknown>) {
  return { type: 'tool/call', data: { callId, name, arguments: JSON.stringify(args) } }
}

function toolResult(
  callId: string,
  text: string,
  options: { exitCode?: number; isError?: boolean; path?: string } = {},
) {
  const meta: Record<string, unknown> = {}
  if (options.exitCode !== undefined) meta.exitCode = options.exitCode
  if (options.path !== undefined) meta.path = options.path
  return {
    type: 'tool/result',
    data: {
      message: {
        toolCallId: callId,
        isError: options.isError ?? false,
        content: [{ type: 'text', text }],
      },
      ...Object.keys(meta).length === 0 ? {} : { meta },
    },
  }
}

function ledger(): { ledger: SessionLedger; dir: string } {
  const dir = join(mkdtempSync(join(tmpdir(), 'dsh-totem-ledger-')), 'ledgers')
  return { ledger: new SessionLedger({ dir }), dir }
}

describe('working-state ledger', () => {
  test('records the goal, verbatim requests, todos, files and failures', () => {
    const { ledger: store } = ledger()
    store.note('s1', user('Fix the login bug'))
    store.note('s1', toolCall('c1', 'todo_write', {
      todos: [
        { content: 'Reproduce the failure', status: 'completed' },
        { content: 'Patch the validator', status: 'in_progress' },
      ],
    }))
    store.note('s1', toolCall('c2', 'edit', { file_path: '/repo/src/login.ts' }))
    store.note('s1', toolResult('c2', 'updated'))
    store.note('s1', toolCall('c3', 'bash', { command: 'bun test test/login.test.ts' }))
    store.note('s1', toolResult('c3', '1 fail: expected 401, got 200', { exitCode: 1 }))
    store.note('s1', user('Also keep the old token format'))

    const text = store.render('s1', 500)
    expect(text).toContain('Goal: Fix the login bug')
    expect(text).toContain('Also keep the old token format')
    expect(text).toContain('[ ] Patch the validator')
    expect(text).not.toContain('[ ] Reproduce the failure')
    expect(text).toContain('/repo/src/login.ts (edit)')
    expect(text).toContain('Last failure: `bun test test/login.test.ts`')
    expect(text).toContain('expected 401')
    expect(text).toContain('Next: Patch the validator')
  })

  test('keeps only the latest user messages and dedupes consecutive repeats', () => {
    const { ledger: store } = ledger()
    for (let index = 0; index < 8; index += 1) store.note('s1', user(`request ${index}`))
    store.note('s1', user('request 7'))
    const text = store.render('s1', 1000)
    expect(text).toContain('Goal: request 0')
    expect(text).toContain('request 7')
    expect(text).not.toContain('request 2')
    expect((text.match(/request 7/g) ?? []).length).toBe(1)
  })

  test('persists across instances and reloads from disk', () => {
    const { ledger: store, dir } = ledger()
    store.note('s1', user('Ship the resume feature'))
    store.note('s1', { type: 'turn/end', data: {} })

    const reloaded = new SessionLedger({ dir })
    const text = reloaded.render('s1', 300)
    expect(text).toContain('Ship the resume feature')
  })

  test('a successful retry clears the recorded failure', () => {
    const { ledger: store } = ledger()
    store.note('s1', user('Run tests'))
    store.note('s1', toolCall('c1', 'bash', { command: 'bun test' }))
    store.note('s1', toolResult('c1', 'boom', { exitCode: 1 }))
    expect(store.render('s1', 300)).toContain('Last failure')

    store.note('s1', toolCall('c2', 'bash', { command: 'bun test' }))
    store.note('s1', toolResult('c2', 'ok', { exitCode: 0 }))
    expect(store.render('s1', 300)).not.toContain('Last failure')
  })

  test('clips the rendered block to the requested budget', () => {
    const { ledger: store } = ledger()
    for (let index = 0; index < 5; index += 1) store.note('s1', user(`long request ${index} `.repeat(20)))
    const text = store.render('s1', 40)
    expect(text.length).toBeLessThanOrEqual(40 * 4 + 20)
  })

  test('ignores synthetic user messages and malformed calls', () => {
    const { ledger: store } = ledger()
    store.note('s1', {
      type: 'user/message',
      data: { message: { source: { kind: 'compact-checkpoint' }, content: [{ type: 'text', text: 'summary' }] } },
    })
    store.note('s1', { type: 'tool/call', data: { callId: 'c1', name: 'write', arguments: '{not json' } })
    store.note('s1', toolResult('missing', 'x'))
    expect(store.has('s1')).toBe(false)
    expect(store.render('s1', 100)).toBe('')
  })

  test('reads the current event shape and falls back to the result path', () => {
    const { ledger: store } = ledger()
    store.note('s1', user('Patch the file'))
    store.note('s1', toolCall('c1', 'apply_patch', {}))
    store.note('s1', toolResult('c1', 'Error: rejected', { isError: true, path: '/repo/src/a.ts' }))
    const text = store.render('s1', 300)
    expect(text).toContain('/repo/src/a.ts (apply_patch)')
    expect(text).toContain('Last failure: `apply_patch`')
    expect(text).toContain('rejected')
  })
})
