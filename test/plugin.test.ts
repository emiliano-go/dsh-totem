import { describe, expect, test } from 'bun:test'
import { applyReadTool, READ_LIMIT, STREAM_MIN_SIZE } from '../src/tool-fs/read.ts'
import { applyWriteTool } from '../src/tool-fs/write.ts'
import { applyEditTool } from '../src/tool-fs/edit.ts'
import { applyApplyPatchTool } from '../src/tool-fs/apply-patch.ts'
import { registerMemoryTools } from '../src/tools.ts'

const caps = { limit: READ_LIMIT, maxLineLength: 2000, maxBytes: 51200, streamMinSize: STREAM_MIN_SIZE }

function capture() {
  const tools: any[] = []
  const ctx = {
    systemPrompt: { section: () => {}, getSectionOrder: () => 0 },
    tools: {
      register: (definition: any) => { tools.push(definition); return () => {} },
      get: () => undefined,
    },
    get: () => undefined,
  }
  const sandbox = {
    escalationModes: [] as string[],
    schemaFields: () => ({}),
    resolvePolicy: async () => undefined,
    mapError: (error: unknown) => error,
  }
  return { tools, ctx, sandbox }
}

describe('forked file tools', () => {
  test('read requires a memory marker', () => {
    const { tools, ctx } = capture()
    applyReadTool(ctx as any, caps)
    const read = tools.find(tool => tool.name === 'read')
    expect(read.parameters.required).toContain('memory')
    expect(read.parameters.properties.memory.properties.kind.enum).toEqual(['register'])
  })

  test('write, edit, and apply_patch require a memory marker', () => {
    const { tools, ctx, sandbox } = capture()
    applyWriteTool(ctx as any, sandbox as any)
    applyEditTool(ctx as any, sandbox as any)
    applyApplyPatchTool(ctx as any, sandbox as any)
    for (const name of ['write', 'edit', 'apply_patch']) {
      const tool = tools.find(entry => entry.name === name)
      expect(tool).toBeDefined()
      expect(tool.parameters.required).toContain('memory')
    }
  })
})

describe('native memory tools', () => {
  test('registers the full Totem surface', () => {
    const { tools, ctx } = capture()
    const totem = { projectFor: async () => '/tmp', call: async () => ({}) }
    registerMemoryTools(ctx as any, totem as any)
    const names = tools.map(tool => tool.name)
    for (const name of [
      'memory_search', 'memory_get', 'memory_list', 'memory_create', 'memory_update',
      'memory_delete', 'memory_recent', 'memory_tasks', 'memory_commands', 'memory_relate',
      'memory_relations', 'memory_history', 'memory_verify', 'engineering_context',
      'memory_export', 'memory_import',
    ]) expect(names).toContain(name)
    const create = tools.find(tool => tool.name === 'memory_create')
    expect(create.parameters.required).toContain('type')
    expect(create.parameters.properties.tags.items.type).toBe('string')
  })
})
