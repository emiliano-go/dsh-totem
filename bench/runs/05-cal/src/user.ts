/** Owner identity and standing preferences stored in the global Totem user DB. */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { TotemService } from './service.ts'

interface MemoryItem {
  id?: string
  title?: string
  statement?: string
  tags?: string[]
  type?: string
}

function asItems(value: unknown): MemoryItem[] {
  if (Array.isArray(value)) return value as MemoryItem[]
  if (typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: MemoryItem[] }).items
  }
  return []
}

function hasTag(item: MemoryItem, tag: string): boolean {
  return (item.tags ?? []).includes(tag)
}

async function userMemories(totem: TotemService, signal?: AbortSignal): Promise<MemoryItem[]> {
  const project = await totem.userProject()
  return asItems(await totem.call('memory_list_tool', { project, limit: 500 }, signal))
}

/** Compose the always-on owner context injected at the first step of a session. */
export async function userContext(totem: TotemService, signal?: AbortSignal): Promise<string> {
  try {
    const items = await userMemories(totem, signal)
    const owner = items.find(item => hasTag(item, 'identity'))
    const preferences = items.filter(item => hasTag(item, 'preference'))
    if (owner === undefined && preferences.length === 0) return ''
    return [
      'About the owner (durable, global):',
      ...owner === undefined ? [] : [`- Name: ${owner.statement ?? owner.title ?? ''}`],
      ...preferences.map(item => `- ${item.statement ?? item.title ?? ''}`),
    ].join('\n')
  } catch {
    return ''
  }
}

/** Register the owner-memory tools. */
export function registerUserTools(ctx: Context, totem: TotemService): void {
  const render = (value: unknown): { type: 'text'; text: string }[] => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }]
  const call = async (name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> => {
    const project = await totem.userProject()
    return totem.call(name, { ...args, project }, signal)
  }
  ctx.tools.register(defineTool({
    name: 'set_owner_name',
    description: 'Remember the name the owner wants to be called. Injected into every future prompt.',
    parameters: {
      name: { type: 'string', required: true, description: 'The name to use.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args, exec) {
      const items = await userMemories(totem, exec.signal)
      const existing = items.find(item => hasTag(item, 'identity'))
      const statement = `The owner's name is ${args.name.trim()}.`
      if (existing?.id !== undefined) {
        await call('memory_update_tool', {
          id: existing.id,
          title: 'Owner name',
          statement,
          tags: ['identity', 'always-on'],
          metadata: { observation: 'owner-name' },
          reason: 'owner name updated',
        }, exec.signal)
      } else {
        await call('memory_create_tool', {
          type: 'observation',
          title: 'Owner name',
          statement,
          tags: ['identity', 'always-on'],
          metadata: { observation: 'owner-name' },
          asserted_by: 'user',
        }, exec.signal)
      }
      return { user_name: args.name.trim() }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'remember_preference',
    description: 'Save a durable global preference injected into every future prompt: tone, formatting, rules to always follow.',
    parameters: {
      text: { type: 'string', required: true, description: 'The rule, one sentence.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args, exec) {
      const text = args.text.trim()
      const created = await call('memory_create_tool', {
        type: 'constraint',
        title: text.slice(0, 80),
        statement: text,
        tags: ['preference', 'always-on'],
        metadata: { constraint: text },
        asserted_by: 'user',
      }, exec.signal)
      return created
    },
  }))
  ctx.tools.register(defineTool({
    name: 'list_preferences',
    description: "List the owner's name and durable global preferences.",
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(_args, exec) {
      const items = await userMemories(totem, exec.signal)
      const owner = items.find(item => hasTag(item, 'identity'))
      const preferences = items.filter(item => hasTag(item, 'preference'))
      return {
        user_name: owner?.statement?.replace(/^The owner's name is /u, '').replace(/\.$/u, '') ?? null,
        preferences: preferences.map(item => ({ id: item.id, text: item.statement ?? item.title ?? '' })),
      }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'forget_preference',
    description: 'Remove a global preference by its index (see list_preferences).',
    parameters: {
      index: { type: 'integer', required: true, description: '0-based index from list_preferences.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args, exec) {
      const items = (await userMemories(totem, exec.signal)).filter(item => hasTag(item, 'preference'))
      const item = items[args.index]
      if (item?.id === undefined) return { removed: false }
      await call('memory_delete_tool', { id: item.id, reason: 'forgotten by owner' }, exec.signal)
      return { removed: true }
    },
  }))
}
