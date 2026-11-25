import { afterEach, expect, test } from 'bun:test'

import { registerNotificationHooks } from '../src/notify.ts'

type Handler = (first: unknown, second?: unknown) => unknown

function ref<T>(value: T): { get: () => T } {
  return { get: () => value }
}

/** Every channel empty, so a hook returns before it reaches fetch. */
function silent(): Record<string, unknown> {
  return {
    ntfyTopic: ref(''),
    ntfyUrl: ref(''),
    ntfyToken: ref(''),
    telegramBotToken: ref(''),
    telegramChatId: ref(''),
  }
}

function hooks(config: Record<string, unknown>, services: Record<string, unknown> = {}) {
  const handlers = new Map<string, Handler[]>()
  const ctx = {
    on: (name: string, handler: Handler) => {
      handlers.set(name, [...handlers.get(name) ?? [], handler])
    },
    get: (name: string) => services[name],
  }
  registerNotificationHooks(ctx as never, { config } as never)
  return {
    turnEnd: (payload: unknown) => handlers.get('agent/turn-stopping')?.[0]?.(payload),
    sessionEvent: (session: unknown, event: unknown) => handlers.get('session/event')?.[0]?.(session, event),
  }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

/** Replace fetch with a recorder; returns the requested URLs. */
function countingFetch(): string[] {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return new Response('ok', { status: 200 })
  }) as typeof fetch
  return calls
}

test('a config written before the notification flags existed cannot fail a turn', () => {
  const hook = hooks({ ...silent(), notifyTurnEnd: undefined, notifyApproval: undefined })
  expect(() => hook.turnEnd({ agent: {}, turn: 3 })).not.toThrow()
  expect(() => hook.sessionEvent({}, { type: 'approval/asked', data: { toolName: 'bash' } })).not.toThrow()
})

test('a disabled turn-end flag sends nothing', () => {
  const calls = countingFetch()
  const hook = hooks({ ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(false) })
  hook.turnEnd({ agent: {}, turn: 4 })
  expect(calls).toEqual([])
})

test('an enabled turn-end flag delivers once, to the configured topic', async () => {
  const calls = countingFetch()
  const hook = hooks({ ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(true) })
  hook.turnEnd({ agent: { session: { id: 's1', header: { cwd: '/tmp/project' } } }, turn: 7 })
  await Promise.resolve()
  expect(calls).toHaveLength(1)
  expect(calls[0]).toContain('/dsh-test')
})

test('subagent turns stay silent', () => {
  const calls = countingFetch()
  const hook = hooks({ ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(true) })
  hook.turnEnd({ agent: { parentAgent: {} }, turn: 9 })
  expect(calls).toEqual([])
})

test('a child Session stays silent even when the agent carries no parent link', () => {
  const calls = countingFetch()
  const hook = hooks({ ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(true) })
  hook.turnEnd({
    agent: { session: { id: 'child-1', header: { cwd: '/tmp/project', origin: 'subagent' } } },
    turn: 2,
  })
  expect(calls).toEqual([])
})

test('delegation depth marks a resumed child as a subagent', () => {
  const calls = countingFetch()
  const hook = hooks({ ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(true) })
  hook.turnEnd({
    agent: { session: { id: 'child-2', header: { cwd: '/tmp/project', delegationDepth: 1 } } },
    turn: 3,
  })
  expect(calls).toEqual([])
})

test('an agent outside the registry roots is a subagent', () => {
  const calls = countingFetch()
  const hook = hooks(
    { ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(true) },
    { agents: { roots: () => [] } },
  )
  hook.turnEnd({ agent: { session: { id: 'child-3', header: { cwd: '/tmp/project' } } }, turn: 5 })
  expect(calls).toEqual([])
})

test('a registry root still notifies once', async () => {
  const calls = countingFetch()
  const agent = { session: { id: 'root-1', header: { cwd: '/tmp/project' } } }
  const hook = hooks(
    { ...silent(), ntfyTopic: ref('dsh-test'), notifyTurnEnd: ref(true) },
    { agents: { roots: () => [agent] } },
  )
  hook.turnEnd({ agent, turn: 6 })
  await Promise.resolve()
  expect(calls).toHaveLength(1)
})

test('approval notifications follow approval/asked only', async () => {
  const calls = countingFetch()
  const hook = hooks({ ...silent(), ntfyTopic: ref('dsh-test'), notifyApproval: ref(true) })
  hook.sessionEvent({}, { type: 'approval/resolved' })
  expect(calls).toEqual([])
  hook.sessionEvent({ header: { cwd: '/tmp/project' } }, { type: 'approval/asked', data: { toolName: 'bash' } })
  await Promise.resolve()
  expect(calls).toHaveLength(1)
})
