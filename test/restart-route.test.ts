import { describe, expect, test } from 'bun:test'
import { Context } from '@deepseek-ai/cordis'

import { registerAssistantRoutes } from '../src/routes.ts'
import { RestartController } from '../src/restart.ts'

interface Routed {
  path: string
  handler: (req: unknown, res: unknown) => void
}

function ref<T>(value: T): { get: () => T } {
  return { get: () => value }
}

function settle(ms = 20): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Mount the `/totem` prefix with fakes and return a request helper. */
async function mount(options: { busy?: () => boolean; files?: string[] } = {}) {
  const ctx = new Context()
  const routes: Routed[] = []
  ctx.provide('webServer', {
    register: (route: Routed) => { routes.push(route); return () => {} },
  })
  const spawns: string[] = []
  const restart = new RestartController({
    launcher: () => 'dsh-totem',
    busy: options.busy ?? (() => false),
    dirs: () => ['/opt/bin'],
    exists: path => (options.files ?? ['/opt/bin/dsh-totem']).includes(path),
    env: {} as NodeJS.ProcessEnv,
    spawn: (command) => { spawns.push(command); return { unref: () => {} } },
  })
  const deps = {
    totem: { config: { apiToken: ref('secret') }, lastProject: '' },
    restart,
  } as never
  registerAssistantRoutes(ctx, deps)
  await settle()
  expect(routes).toHaveLength(1)
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

  return { ctx, call, spawns }
}

describe('restart routes', () => {
  test('GET /totem/host reports the pid and launcher', async () => {
    const { ctx, call } = await mount()
    const { status, body } = await call('GET', '/totem/host')
    expect(status).toBe(200)
    expect(body.pid).toBe(process.pid)
    expect(body.launcher).toBe('/opt/bin/dsh-totem')
    expect(body.busy).toBe(false)
    await ctx.fiber.dispose()
  })

  test('POST /totem/restart schedules the launcher on the request port', async () => {
    const { ctx, call, spawns } = await mount()
    const { status, body } = await call('POST', '/totem/restart', { delayMs: 0 })
    expect(status).toBe(200)
    expect((body.plan as { mode: string }).mode).toBe('now')
    expect((body.plan as { port: number }).port).toBe(3080)
    await settle(30)
    expect(spawns).toEqual(['/opt/bin/dsh-totem'])
    await ctx.fiber.dispose()
  })

  test('a busy host defers the restart and reports the mode', async () => {
    const { ctx, call, spawns } = await mount({ busy: () => true })
    const { body } = await call('POST', '/totem/restart', { delayMs: 0 })
    expect((body.plan as { mode: string }).mode).toBe('idle')
    await settle(30)
    expect(spawns).toEqual([])
    await ctx.fiber.dispose()
  })

  test('requests without the token are refused', async () => {
    const { ctx, call } = await mount()
    expect((await call('GET', '/totem/host', undefined, '')).status).toBe(401)
    expect((await call('POST', '/totem/restart', {}, 'wrong')).status).toBe(401)
    await ctx.fiber.dispose()
  })

  test('a missing launcher is a conflict, not a crash', async () => {
    const { ctx, call } = await mount({ files: [] })
    const { status, body } = await call('POST', '/totem/restart', { delayMs: 0 })
    expect(status).toBe(409)
    expect(String(body.error)).toContain('restartCommand')
    await ctx.fiber.dispose()
  })
})
