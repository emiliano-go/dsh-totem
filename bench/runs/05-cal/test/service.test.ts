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
  readRegister: true, autoRegister: true, preferFileContext: true,
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
  expect(text).toContain('file_tldr')
  expect(text).toContain('add')
  expect(text).toContain('Sums two numbers')
}, 60000)

test('recordRead stores a file-state TLDR, not a read marker', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-read-'))
  const path = join(project, 'queue.py')
  writeFileSync(path, '"""Queue helpers."""\n\ndef retry(n: int) -> int:\n    """Retry a job."""\n    return n\n')
  const totem = service(project)
  await totem.recordRead({ agent: {}, path, tool: 'read', action: 'read' })
  const listed = await totem.call('memory_list_tool', { project, limit: 20 })
  const text = JSON.stringify(listed)
  expect(text).toContain('file_tldr')
  expect(text).toContain('Queue helpers')
  expect(text).not.toContain('Read queue.py')
}, 60000)

test('cachedRead returns a fresh file TLDR', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-cache-'))
  const path = join(project, 'queue.py')
  writeFileSync(path, '"""Queue helpers."""\n\ndef retry(n: int) -> int:\n    return n\n')
  const totem = service(project)
  expect(await totem.cachedRead({ path, agent: {} })).toBeUndefined()
  await totem.recordRead({ agent: {}, path, tool: 'read', action: 'read' })
  const cached = await totem.cachedRead({ path, agent: {} })
  expect(cached?.fresh).toBe(true)
  expect(cached?.tldr).toContain('Queue helpers')
}, 60000)

test('recordSessionSummary updates one session record', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-session-'))
  const totem = service(project)
  const input = {
    project,
    sessionId: 'session-test',
    text: 'Implemented queue retry behavior and documented the change. '.repeat(6),
    changes: [
      { path: join(project, 'queue.py'), tool: 'write' },
      { path: join(project, 'README.md'), tool: 'edit' },
    ],
  }
  await totem.recordSessionSummary(input)
  await totem.recordSessionSummary(input)
  const listed = await totem.call('memory_list_tool', { project, limit: 20 })
  const items = Array.isArray(listed)
    ? listed as { metadata?: { kind?: string; tools?: string[] } }[]
    : (listed as { items?: { metadata?: { kind?: string; tools?: string[] } }[] }).items ?? []
  const summaries = items.filter(item => item.metadata?.kind === 'session_summary')
  expect(summaries).toHaveLength(1)
  expect(summaries[0].metadata?.tools).toEqual(['write', 'edit'])
}, 60000)
