import { describe, expect, test } from 'bun:test'
import type { Context } from '@deepseek-ai/cordis'
import type { TotemService } from '../src/service.ts'
import { tagsWithTools } from '../src/service.ts'
import {
  ToolMemoryGate,
  blockReason,
  exemptTool,
  registerToolMemoryGate,
} from '../src/tool-memory-gate.ts'

interface Memory {
  id: string
  title: string
  statement: string
  type: string
  tags: string[]
}

const MEMORIES: Memory[] = [
  { id: 'm-write', title: 'Write needs a marker', statement: 'Call write with memory', type: 'gotcha', tags: ['tool:write'] },
  { id: 'm-all', title: 'Global rule', statement: 'Read before any tool', type: 'decision', tags: ['tool:*'] },
]

function fakeTotem(options: { fail?: boolean } = {}): TotemService {
  return {
    projectFor: async () => '/project',
    call: async (_name: string, args: Record<string, unknown>) => {
      if (options.fail === true) throw new Error('totem down')
      const tags = Array.isArray(args.tags) ? args.tags.filter((tag): tag is string => typeof tag === 'string') : []
      return MEMORIES.filter(memory => tags.some(tag => memory.tags.includes(tag)))
    },
  } as unknown as TotemService
}

function harness(): {
  ctx: Context
  tools: { name: string; execute: (args: unknown, exec: unknown) => Promise<unknown> }[]
  pre: (exec: unknown, next: () => Promise<{ kind: 'allow' }>) => Promise<unknown>
} {
  const handlers = new Map<string, (exec: unknown, next: () => Promise<{ kind: 'allow' }>) => Promise<unknown>>()
  const tools: { name: string; execute: (args: unknown, exec: unknown) => Promise<unknown> }[] = []
  const ctx = {
    on: (event: string, handler: never) => {
      handlers.set(event, handler)
      return () => {}
    },
    tools: {
      register: (definition: { name: string; execute: (args: unknown, exec: unknown) => Promise<unknown> }) => {
        tools.push(definition)
        return () => {}
      },
    },
  } as unknown as Context
  return {
    ctx,
    tools,
    pre: (exec, next) => handlers.get('tools/pre-execute')!(exec, next),
  }
}

const exec = (name: string, session = 's1') => ({
  name,
  agent: { session: { id: session } },
  signal: new AbortController().signal,
})

describe('tool memory gate', () => {
  test('tool names are stored as de-duplicated tool:<name> tags', () => {
    expect(tagsWithTools(['gotcha', 'tool:write'], ['write', 'edit'])).toEqual(['gotcha', 'tool:write', 'tool:edit'])
    expect(tagsWithTools([], ['mcp__context7__query-docs'])).toEqual(['tool:mcp__context7__query-docs'])
  })

  test('blocks a tool with unread associated memories and names the reader', async () => {
    const { ctx, pre } = harness()
    registerToolMemoryGate(ctx, fakeTotem())
    const decision = await pre(exec('write'), async () => ({ kind: 'allow' }))
    expect(decision).toMatchObject({ kind: 'deny' })
    expect((decision as { reason: string }).reason).toContain('memory_for_tool {"tool":"write"}')
    expect((decision as { reason: string }).reason).toContain('Write needs a marker')
  })

  test('memory_for_tool reads and acknowledges the association', async () => {
    const { ctx, tools, pre } = harness()
    registerToolMemoryGate(ctx, fakeTotem())
    const reader = tools.find(tool => tool.name === 'memory_for_tool')
    expect(reader).toBeDefined()
    const result = await reader!.execute({ tool: 'write' }, { agent: { session: { id: 's1' } }, signal: new AbortController().signal }) as { count: number }
    expect(result.count).toBe(2)
    expect(await pre(exec('write'), async () => ({ kind: 'allow' }))).toEqual({ kind: 'allow' })
  })

  test('memory tools and the reader are exempt even when memories exist', async () => {
    const { ctx, pre } = harness()
    registerToolMemoryGate(ctx, fakeTotem())
    expect(await pre(exec('memory_search'), async () => ({ kind: 'allow' }))).toEqual({ kind: 'allow' })
    expect(await pre(exec('memory_for_tool'), async () => ({ kind: 'allow' }))).toEqual({ kind: 'allow' })
    expect(exemptTool('memory_get')).toBe(true)
    expect(exemptTool('write')).toBe(false)
  })

  test('wildcard tool:* associations guard any tool', async () => {
    const { ctx, pre } = harness()
    registerToolMemoryGate(ctx, fakeTotem())
    const decision = await pre(exec('bash'), async () => ({ kind: 'allow' }))
    expect(decision).toMatchObject({ kind: 'deny' })
    expect((decision as { reason: string }).reason).toContain('Global rule')
  })

  test('unassociated tools run and a Totem failure fails open', async () => {
    const gate = new ToolMemoryGate(fakeTotem({ fail: true }))
    expect(await gate.blocked('write', { session: { id: 's1' } }, new AbortController().signal)).toEqual([])
    const disabled = new ToolMemoryGate(fakeTotem(), { enabled: () => false })
    expect(await disabled.blocked('write', { session: { id: 's1' } }, new AbortController().signal)).toEqual([])
  })

  test('block text is bounded and pluralizes correctly', () => {
    expect(blockReason('write', [{
      id: 'a', title: 'One', statement: '', type: 'gotcha', tags: [],
    }])).toContain('1 memory associated')
    expect(blockReason('write', [
      { id: 'a', title: 'One', statement: '', type: 'gotcha', tags: [] },
      { id: 'b', title: 'Two', statement: '', type: 'decision', tags: [] },
    ])).toContain('2 memories associated')
  })
})
