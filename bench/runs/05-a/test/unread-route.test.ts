import { describe, expect, test } from 'bun:test'
import { Context } from '@deepseek-ai/cordis'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerAssistantRoutes } from '../src/routes.ts'
import { UnreadStore } from '../src/unread.ts'

interface Routed {
  path: string
  handler: (req: unknown, res: unknown) => void
}

function settle(ms = 20): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function mount() {
  const ctx = new Context()
  const routes: Routed[] = []
  ctx.provide('webServer', {
    register: (route: Routed) => { routes.push(route); return () => {} },
  })
  const unread = new UnreadStore(join(mkdtempSync(join(tmpdir(), 'dsh-totem-unread-route-')), 'unread.json'))
  const deps = {
    totem: { config: { apiToken: { get: () => 'secret' } }, lastProject: '' },
    unread,
  } as never
  registerAssistantRoutes(ctx, deps)
  await settle()
  const handler = routes[0].handler

  async function call(method: string, url: string, bodyValue?: unknown, token = 'secret') {
    let status = 0
    let payload = ''
    const req = {
      method,
      url,
      headers: token.length > 0 ? { authorization: `Bearer ${token}` } : {},
      socket: { localPort: 3080 },
      async *[Symbol.asyncIterator]() {
        if (bodyValue !== undefined) yield Buffer.from(JSON.stringify(bodyValue))
      },
    }
    const res = {
      writeHead: (value: number) => { status = value },
      end: (value: string) => { payload = value },
    }
    handler(req, res)
    await settle()
    return { status, body: payload.length > 0 ? JSON.parse(payload) as Record<string, unknown> : {} }
  }

  return { call }
}

describe('unread routes', () => {
  test('mark, list, and clear round trip over HTTP', async () => {
    const { call } = await mount()
    const marked = await call('POST', '/totem/unread', { sessionId: 's1' })
    expect(marked.status).toBe(200)
    expect((marked.body.items as { sessionId: string }[]).map(item => item.sessionId)).toEqual(['s1'])

    const listed = await call('GET', '/totem/unread')
    expect((listed.body.items as { sessionId: string }[]).map(item => item.sessionId)).toEqual(['s1'])

    const cleared = await call('POST', '/totem/unread/clear', { sessionIds: ['s1'] })
    expect(cleared.body.items).toEqual([])
  })

  test('a bad session id is ignored rather than stored', async () => {
    const { call } = await mount()
    const response = await call('POST', '/totem/unread', { sessionId: 42 })
    expect(response.status).toBe(200)
    expect(response.body.items).toEqual([])
  })

  test('the endpoint stays behind the bearer token', async () => {
    const { call } = await mount()
    expect((await call('GET', '/totem/unread', undefined, '')).status).toBe(401)
    expect((await call('GET', '/totem/unread', undefined, 'wrong')).status).toBe(401)
  })
})
