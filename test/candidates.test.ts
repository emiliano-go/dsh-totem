import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TotemService, type TotemConfig } from '../src/service.ts'
import { CandidateService } from '../src/candidates.ts'

const CANDIDATES = JSON.stringify([{
  type: 'gotcha',
  title: 'Retry loop swallows the first failure',
  statement: 'The retry wrapper drops the first error when the second attempt succeeds.',
  tags: ['retry', 'error-handling'],
}])

const config: TotemConfig = {
  command: 'totem-mcp', args: [], env: {},
  provider: { get: () => 'test' } as any, model: { get: () => 'test' } as any,
  readRegister: true, autoRegister: true, distill: true, digest: true,
  maxTokens: 128, maxInputBytes: 4096, timeoutMs: 20000, debug: false,
  apiToken: { get: () => '' } as any,
  ntfyUrl: { get: () => '' } as any, ntfyTopic: { get: () => '' } as any, ntfyToken: { get: () => '' } as any,
  telegramBotToken: { get: () => '' } as any, telegramChatId: { get: () => '' } as any,
  distillTurn: { get: () => true } as any, distillTurnMinChars: { get: () => 10 } as any,
  watchAllowPrivate: { get: () => false } as any,
}

function service(project: string, llm: unknown): TotemService {
  const instance = Object.create(TotemService.prototype) as TotemService
  ;(instance as any).ctx = { workingDirectory: { ensure: async () => project }, get: () => undefined, llm }
  ;(instance as any).config = config
  ;(instance as any).initialized = new Set<string>()
  return instance
}

test('turn distillation queues candidates and approval writes memory', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-cand-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = join(project, '.dsh')
  const ctx = { llm: { async *stream() { yield { type: 'text-delta', index: 0, text: CANDIDATES } } } }
  const totem = service(project, ctx.llm)
  const candidates = new CandidateService(ctx as any, totem)
  await candidates.distillTurn({
    project,
    sessionId: 'session-test',
    text: 'A long enough assistant turn that produced a durable gotcha.',
    tools: ['edit', 'bash'],
  })
  const pending = (await candidates.list()).filter(item => item.status === 'pending')
  expect(pending).toHaveLength(1)
  expect(pending[0].title).toContain('Retry loop')
  expect(await candidates.approve(pending[0].id)).toBe(true)
  const memories = await totem.call('memory_list_tool', { project, limit: 20 })
  const text = JSON.stringify(memories)
  expect(text).toContain('Retry loop')
  expect((await candidates.list())[0].status).toBe('approved')
  if (previous === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previous
}, 60000)
