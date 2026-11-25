import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { MAX_RESTART_DELAY, RestartController, launcherDirs, resolveLauncher } from '../src/restart.ts'

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 15))
}

interface SpawnCall {
  command: string
  args: readonly string[]
  options: { detached: boolean; stdio: 'ignore'; cwd: string; env: NodeJS.ProcessEnv }
  unrefs: number
}

function harness(options: {
  busy?: () => boolean
  launcher?: string
  files?: string[]
  dirs?: string[]
  supervised?: boolean
  service?: string
} = {}) {
  const files = new Set(options.files ?? ['/opt/bin/dsh-totem'])
  const spawns: SpawnCall[] = []
  const controller = new RestartController({
    launcher: () => options.launcher ?? 'dsh-totem',
    busy: options.busy ?? (() => false),
    service: () => options.service ?? 'dsh-totem.service',
    supervised: () => options.supervised ?? false,
    dirs: () => options.dirs ?? ['/opt/bin'],
    exists: path => files.has(path),
    env: { PATH: '/opt/bin', HOME: '/home/test' } as NodeJS.ProcessEnv,
    cwd: () => '/srv/app',
    spawn: (command, args, spawnOptions) => {
      const call: SpawnCall = { command, args, options: spawnOptions, unrefs: 0 }
      spawns.push(call)
      return { unref: () => { call.unrefs += 1 } }
    },
  })
  return { controller, spawns }
}

test('a bare launcher resolves against the search directories', () => {
  expect(resolveLauncher('dsh-totem', ['/opt/bin', '/usr/bin'], path => path === '/usr/bin/dsh-totem'))
    .toBe('/usr/bin/dsh-totem')
  expect(resolveLauncher('/custom/launch', [], () => true)).toBe('/custom/launch')
  expect(resolveLauncher('missing', ['/opt/bin'], () => false)).toBeUndefined()
})

test('the search path includes the local installs a desktop entry needs', () => {
  const dirs = launcherDirs({ PATH: '/usr/bin:/bin' } as NodeJS.ProcessEnv, '/home/test')
  expect(dirs).toContain('/usr/bin')
  expect(dirs).toContain(join('/home/test', '.local/bin'))
  expect(dirs).toContain(join('/home/test', '.npm-global/bin'))
})

test('an idle host is relaunched after the delay, targeting the request port', async () => {
  const { controller, spawns } = harness()
  const plan = controller.schedule({ delayMs: 0, port: 3080 })
  expect(plan.mode).toBe('now')
  expect(plan.launcher).toBe('/opt/bin/dsh-totem')
  await settle()
  expect(spawns).toHaveLength(1)
  expect(spawns[0].command).toBe('/opt/bin/dsh-totem')
  expect(spawns[0].args).toEqual([])
  expect(spawns[0].options.detached).toBe(true)
  expect(spawns[0].options.stdio).toBe('ignore')
  expect(spawns[0].options.cwd).toBe('/srv/app')
  expect(spawns[0].options.env.DSH_TOTEM_PORT).toBe('3080')
  expect(spawns[0].unrefs).toBe(1)
})

test('a supervised host asks systemd for the restart instead of spawning in its cgroup', async () => {
  const { controller, spawns } = harness({ supervised: true, service: 'dsh-totem.service' })
  controller.schedule({ delayMs: 0, port: 3080 })
  await settle()
  expect(spawns).toHaveLength(1)
  expect(spawns[0].command).toBe('systemctl')
  expect(spawns[0].args).toEqual(['--user', '--no-block', 'restart', 'dsh-totem.service'])
  expect(spawns[0].unrefs).toBe(1)
})

test('a busy host defers the restart until the turn boundary', async () => {  let busy = true
  const { controller, spawns } = harness({ busy: () => busy })
  const plan = controller.schedule({ delayMs: 0 })
  expect(plan.mode).toBe('idle')
  await settle()
  expect(spawns).toHaveLength(0)

  controller.tick()
  await settle()
  expect(spawns).toHaveLength(0)

  busy = false
  controller.tick()
  await settle()
  expect(spawns).toHaveLength(1)
})

test('idle: false restarts even during a turn', async () => {
  const { controller, spawns } = harness({ busy: () => true })
  expect(controller.schedule({ idle: false, delayMs: 0 }).mode).toBe('now')
  await settle()
  expect(spawns).toHaveLength(1)
})

test('a missing launcher is reported instead of silently doing nothing', () => {
  const { controller } = harness({ files: [] })
  expect(controller.launcher()).toBeUndefined()
  expect(() => controller.schedule()).toThrow(/restartCommand/u)
  try {
    controller.schedule()
  } catch (error) {
    expect((error as { status?: number }).status).toBe(409)
  }
})

test('a second restart is refused while one is queued', async () => {
  const { controller } = harness({ busy: () => true })
  controller.schedule({ delayMs: 0 })
  expect(() => controller.schedule({ delayMs: 0 })).toThrow(/already scheduled/u)
})

test('the delay is clamped to the maximum', () => {
  const { controller } = harness()
  expect(controller.schedule({ idle: false, delayMs: 10 * MAX_RESTART_DELAY }).delayMs).toBe(MAX_RESTART_DELAY)
})

test('status reports the resolved launcher and the busy flag', () => {
  const { controller } = harness({ busy: () => true })
  const status = controller.status()
  expect(status.pid).toBe(process.pid)
  expect(status.busy).toBe(true)
  expect(status.launcher).toBe('/opt/bin/dsh-totem')
})
