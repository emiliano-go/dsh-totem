import { expect, test } from 'bun:test'
import { TotemService, type TotemConfig } from '../src/service.ts'

const config: TotemConfig = {
  command: 'dsh-totem-missing-binary-for-tests', args: [], env: {},
  provider: { get: () => '' } as never, model: { get: () => '' } as never,
  readRegister: false, autoRegister: false, preferFileContext: false, distill: false, digest: false,
  digestTokens: 0, recoveryTokens: 0,
  maxTokens: 64, maxInputBytes: 1024, timeoutMs: 1000, debug: false,
  apiToken: { get: () => '' } as never,
  ntfyUrl: { get: () => '' } as never, ntfyTopic: { get: () => '' } as never, ntfyToken: { get: () => '' } as never,
  telegramBotToken: { get: () => '' } as never, telegramChatId: { get: () => '' } as never,
  distillTurn: { get: () => false } as never, distillTurnMinChars: { get: () => 0 } as never,
  watchAllowPrivate: { get: () => false } as never,
}

function service(cwd: string): TotemService {
  const instance = Object.create(TotemService.prototype) as TotemService
  ;(instance as any).ctx = { workingDirectory: { ensure: async () => cwd }, get: () => undefined }
  ;(instance as any).config = config
  ;(instance as any).initialized = new Set([cwd, '/parent'])
  ;(instance as any).projects = new Map()
  ;(instance as any).overrides = new Map()
  ;(instance as any).lastProjectPath = ''
  return instance
}

test('a child session inherits the pinned project', async () => {
  const totem = service('/child-worktree')
  expect(await totem.projectFor({ session: { id: 'parent' } })).toBe('/child-worktree')
  totem.overrideProject('child', '/parent')
  const child = { session: { id: 'child' } }
  expect(await totem.projectFor(child)).toBe('/parent')
  expect(totem.projectOf('child')).toBe('/parent')
})

test('clearing a session drops its pin', async () => {
  const totem = service('/child-worktree')
  totem.overrideProject('child', '/parent')
  totem.clearProject('child')
  // Clearing forgets the session entirely; the next resolution records the
  // working directory again, which is the point of dropping the pin.
  expect(totem.projectOf('child')).toBeUndefined()
  expect(await totem.projectFor({ session: { id: 'child' } })).toBe('/child-worktree')
})

test('a session without a pin uses its working directory', async () => {
  const totem = service('/repo')
  expect(await totem.projectFor({ session: { id: 'plain' } })).toBe('/repo')
  expect(totem.projectOf('plain')).toBe('/repo')
})
