import { describe, expect, test } from 'bun:test'
import { applyReadTool, READ_LIMIT, STREAM_MIN_SIZE } from '../src/tool-fs/read.ts'
import { applyWriteTool } from '../src/tool-fs/write.ts'
import { applyEditTool } from '../src/tool-fs/edit.ts'
import { applyApplyPatchTool } from '../src/tool-fs/apply-patch.ts'
import { registerMemoryTools } from '../src/tools.ts'

const caps = { limit: READ_LIMIT, maxLineLength: 2000, maxBytes: 51200, streamMinSize: STREAM_MIN_SIZE }

function capture(totem?: unknown) {
  const tools: any[] = []
  const ctx = {
    systemPrompt: { section: () => {}, getSectionOrder: () => 0 },
    tools: {
      register: (definition: any) => { tools.push(definition); return () => {} },
      get: () => undefined,
    },
    get: (name: string) => name === 'totem' ? totem : undefined,
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

  test('read returns a fresh file TLDR without touching the filesystem', async () => {
    const { tools, ctx } = capture({
      cachedRead: async () => ({
        id: 'item-1', path: 'src/queue.py', tldr: 'Queue helpers.',
        lineCount: 4, symbols: [{ name: 'retry', kind: 'function' }],
      }),
    })
    applyReadTool(ctx as any, caps)
    const read = tools.find(tool => tool.name === 'read')
    const result = await read.execute(
      { file_path: 'src/queue.py', memory: { kind: 'register' } },
      { agent: {}, signal: new AbortController().signal },
    )
    expect(result.cached).toBe(true)
    expect(result.totalLines).toBe(4)
    expect(result.tldr).toBe('Queue helpers.')
    expect(result.symbols[0].name).toBe('retry')
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
      'memory_check_record', 'memory_audit', 'memory_quality', 'memory_export', 'memory_import',
      'memory_feedback', 'memory_feedback_list', 'memory_train_models',
      'memory_consolidate', 'memory_file_context', 'memory_session_summary',
      'memory_workflow', 'memory_profile', 'memory_graph', 'memory_rollup',
      'memory_heat', 'memory_decay', 'memory_induce_workflow', 'memory_maintenance',
      'memory_touch',
      'memory_prune', 'memory_metrics',
      'memory_export_markdown', 'memory_import_markdown',
    ]) expect(names).toContain(name)
    const create = tools.find(tool => tool.name === 'memory_create')
    expect(create.parameters.required).toContain('type')
    expect(create.parameters.properties.tags.items.type).toBe('string')
    expect(create.parameters.properties.valid_from.type).toBe('string')
    const context = tools.find(tool => tool.name === 'engineering_context')
    expect(context.parameters.properties.as_of.type).toBe('string')
    expect(context.parameters.properties.include_expired.type).toBe('boolean')
  })
})
