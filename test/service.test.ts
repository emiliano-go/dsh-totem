import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TotemService, type TotemConfig } from '../src/service.ts'

const DISTILLED = JSON.stringify({
  title: 'add helper',
  statement: 'add returns the sum of a and b.',
  reason: 'Introduce a small numeric helper.',
  tags: ['math'],
  signatures: [{
    name: 'add',
    kind: 'function',
    signature: 'export function add(a: number, b: number): number',
    statement: 'Sums two numbers.',
  }],
})

const config: TotemConfig = {
  command: 'totem-mcp', args: [], env: {},
  provider: { get: () => 'test' } as any, model: { get: () => 'test' } as any,
  readRegister: true, autoRegister: true,
  distill: true, digest: true, maxTokens: 128, maxInputBytes: 4096, timeoutMs: 20000, debug: false,
}

function service(project: string): TotemService {
  const ctx = {
    workingDirectory: { ensure: async () => project },
    get: () => undefined,
    llm: {
      // One text delta is enough for BlockAssembler.
      async *stream() {
        yield { type: 'text-delta', index: 0, text: DISTILLED }
      },
    },
  }
  const instance = Object.create(TotemService.prototype) as TotemService
  ;(instance as any).ctx = ctx
  ;(instance as any).config = config
  ;(instance as any).initialized = new Set<string>()
  return instance
}

test('recordWrite distills and registers file + symbol memories', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-svc-'))
  const path = join(project, 'math.ts')
  writeFileSync(path, 'export function add(a: number, b: number): number { return a + b }\n')
  const totem = service(project)
  await totem.recordWrite({
    agent: {},
    path,
    tool: 'write',
    action: 'write',
    before: null,
    after: 'export function add(a: number, b: number): number { return a + b }\n',
  })
  const listed = await totem.call('memory_list_tool', { project, limit: 20 })
  const text = JSON.stringify(listed)
  expect(text).toContain('add helper')
  expect(text).toContain('Sums two numbers')
}, 60000)
