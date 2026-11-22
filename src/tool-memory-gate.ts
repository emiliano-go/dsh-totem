/**
 * Tool-associated memories and the pre-tool memory gate.
 *
 * A memory can name the tools it governs (`tools: ["write", "edit"]`); the
 * names are stored as `tool:<name>` tags. Before such a tool runs, the gate
 * checks whether its associated memories were read in this session. If not,
 * the call is denied with an instruction to call `memory_for_tool` first.
 *
 * The gate is deliberately fail-open: a Totem outage or a malformed response
 * must never brick every tool. It also skips memory tools so the agent can
 * always comply with the block.
 *
 * @module dsh-totem/tool-memory-gate
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemService } from './service.ts'

/** One associated memory, reduced to what the block message needs. */
export interface ToolMemory {
  id: string
  title?: string
  statement?: string
  type?: string
  tags?: string[]
}

export interface ToolMemoryGateOptions {
  /** Live enable flag; read on every call. */
  enabled?: () => boolean
  /** Association cache lifetime in milliseconds. */
  ttlMs?: number
  /** Number of turns a read stays fresh before the tool is blocked again. */
  turns?: number
  /** Injectable clock for tests. */
  now?: () => number
}

interface CacheEntry {
  expires: number
  memories: ToolMemory[]
}

const DEFAULT_TTL_MS = 30_000
const DEFAULT_FRESH_TURNS = 3
const MEMORY_TOOL = /^memory_/u
const MEMORY_LIMIT = 50

function itemsOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  if (typeof value === 'object' && value !== null) {
    for (const key of ['items', 'memories', 'results']) {
      const candidate = (value as Record<string, unknown>)[key]
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      }
    }
  }
  return []
}

function asMemory(item: Record<string, unknown>): ToolMemory | undefined {
  if (typeof item.id !== 'string' || item.id.length === 0) return undefined
  return {
    id: item.id,
    ...typeof item.title === 'string' ? { title: item.title } : {},
    ...typeof item.statement === 'string' ? { statement: item.statement } : {},
    ...typeof item.type === 'string' ? { type: item.type } : {},
    ...Array.isArray(item.tags) ? { tags: item.tags.filter((tag): tag is string => typeof tag === 'string') } : {},
  }
}

function sessionKey(agent: unknown): string | undefined {
  const record = agent as { id?: unknown; session?: { id?: unknown } } | undefined
  if (typeof record?.session?.id === 'string') return record.session.id
  if (typeof record?.id === 'string') return record.id
  return undefined
}

/** Tool names whose calls are exempt from the gate. */
export function exemptTool(name: string): boolean {
  return MEMORY_TOOL.test(name) || name === 'recall' || name === 'engineering_context'
}

/** The rejection text shown to the model when a guarded tool is blocked. */
export function blockReason(tool: string, memories: ToolMemory[]): string {
  const lines = memories.slice(0, 4).map(memory => {
    const label = memory.title ?? memory.statement ?? memory.id
    const type = memory.type === undefined ? '' : `${memory.type}: `
    return `- ${type}${label} [${memory.id}]`
  })
  const more = memories.length > 4 ? `\n- …and ${memories.length - 4} more` : ''
  return [
    `Blocked: ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} associated with \`${tool}\` must be read before this tool runs.`,
    '',
    'Call:',
    `  memory_for_tool {"tool":"${tool}"}`,
    '',
    'then retry the tool call.',
    '',
    ...lines,
    ...(more.length > 0 ? [more] : []),
  ].join('\n')
}

/** Per-session association cache and read ledger. */
export class ToolMemoryGate {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly read = new Map<string, Map<string, number>>()
  private readonly turns = new Map<string, number>()
  private readonly enabled: () => boolean
  private readonly ttlMs: number
  private readonly freshTurns: number
  private readonly now: () => number

  constructor(private readonly totem: TotemService, options: ToolMemoryGateOptions = {}) {
    this.enabled = options.enabled ?? (() => true)
    this.ttlMs = Math.max(1, options.ttlMs ?? DEFAULT_TTL_MS)
    this.freshTurns = Math.max(1, Math.trunc(options.turns ?? DEFAULT_FRESH_TURNS))
    this.now = options.now ?? Date.now
  }

  /** Drop cached associations, optionally for one session. */
  invalidate(session?: string): void {
    if (session === undefined) this.cache.clear()
    else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${session}:`)) this.cache.delete(key)
      }
    }
  }

  /** Record the session's current turn from a `turn/start` event. */
  beginTurn(agent: unknown, turn: number): void {
    const session = sessionKey(agent)
    if (session === undefined || !Number.isFinite(turn)) return
    this.turns.set(session, Math.trunc(turn))
  }

  /** Forget all state for a disposed session. */
  forget(agent: unknown): void {
    const session = sessionKey(agent)
    if (session === undefined) return
    this.turns.delete(session)
    this.read.delete(session)
    this.invalidate(session)
  }

  /** Mark memories as read for one session. */
  acknowledge(agent: unknown, ids: readonly string[]): void {
    const session = sessionKey(agent)
    if (session === undefined || ids.length === 0) return
    let seen = this.read.get(session)
    if (seen === undefined) {
      seen = new Map()
      this.read.set(session, seen)
    }
    const turn = this.turns.get(session) ?? 0
    for (const id of ids) seen.set(id, turn)
  }

  /** Memories associated with a tool via `tool:<name>` or `tool:*`. */
  async associated(tool: string, agent: unknown, signal: AbortSignal): Promise<ToolMemory[]> {
    if (!this.enabled() || exemptTool(tool)) return []
    const session = sessionKey(agent)
    const key = `${session ?? 'anonymous'}:${tool}`
    const hit = this.cache.get(key)
    if (hit !== undefined && hit.expires > this.now()) return hit.memories
    try {
      const project = await this.totem.projectFor(agent, signal)
      const [specific, universal] = await Promise.all([
        this.totem.call('memory_list_tool', { tags: [`tool:${tool}`], status: 'active', limit: MEMORY_LIMIT, project }, signal),
        this.totem.call('memory_list_tool', { tags: ['tool:*'], status: 'active', limit: MEMORY_LIMIT, project }, signal),
      ])
      const memories = new Map<string, ToolMemory>()
      for (const item of [...itemsOf(specific), ...itemsOf(universal)]) {
        const memory = asMemory(item)
        if (memory !== undefined) memories.set(memory.id, memory)
      }
      const value = [...memories.values()]
      this.cache.set(key, { expires: this.now() + this.ttlMs, memories: value })
      return value
    } catch {
      // Fail open: a memory outage must not disable the tool surface.
      return []
    }
  }

  /** Whether the tool is currently blocked for this call. */
  async blocked(tool: string, agent: unknown, signal: AbortSignal): Promise<ToolMemory[]> {
    const memories = await this.associated(tool, agent, signal)
    if (memories.length === 0) return []
    const session = sessionKey(agent)
    if (session === undefined) return []
    const seen = this.read.get(session)
    if (seen === undefined) return memories
    const turn = this.turns.get(session) ?? 0
    return memories.filter(memory => {
      const readAt = seen.get(memory.id)
      return readAt === undefined || turn - readAt >= this.freshTurns
    })
  }
}

/** Register the pre-tool gate and the `memory_for_tool` reader. */
export function registerToolMemoryGate(
  ctx: Context,
  totem: TotemService,
  options: ToolMemoryGateOptions = {},
): ToolMemoryGate {
  const gate = new ToolMemoryGate(totem, options)

  ctx.on('tools/pre-execute', async (exec, next) => {
    const agent = (exec as { agent?: unknown }).agent
    const unread = await gate.blocked((exec as { name: string }).name, agent, (exec as { signal: AbortSignal }).signal)
    if (unread.length > 0) {
      return { kind: 'deny', reason: blockReason((exec as { name: string }).name, unread) }
    }
    return next()
  })

  // A memory write can change the associations; drop the cache for that
  // session so the next tool call sees the new tags immediately.
  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/start') {
      const turn = (event.data as { turn?: unknown }).turn
      if (typeof turn === 'number') gate.beginTurn(session, turn)
      return
    }
    if (event.type === 'session/disposed') {
      gate.forget(session)
      return
    }
    if (event.type !== 'tool/call') return
    const data = event.data as { name?: unknown }
    if (typeof data.name !== 'string') return
    if (data.name === 'memory_create' || data.name === 'memory_update' || data.name === 'memory_delete' || data.name === 'memory_relate') {
      const id = (session as { id?: unknown }).id
      gate.invalidate(typeof id === 'string' ? id : undefined)
    }
  })

  registerMemoryForTool(ctx, totem, gate)
  return gate
}

/** Register the tool the block message tells the model to call. */
export function registerMemoryForTool(ctx: Context, totem: TotemService, gate: ToolMemoryGate): void {
  ctx.tools.register(defineTool({
    name: 'memory_for_tool',
    description: 'Read memories explicitly associated with a tool before calling it; marks them read for this session.',
    parameters: {
      tool: { type: 'string', required: true, description: 'Exact tool name, e.g. write, edit, bash, mcp__context7__query-docs.' },
      limit: { type: 'number', description: 'Maximum memories to return (default 50).' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const params = args as { tool?: unknown; limit?: unknown }
      const tool = typeof params.tool === 'string' ? params.tool.trim() : ''
      if (tool.length === 0) return { tool, count: 0, memories: [], note: 'Pass the exact tool name.' }
      const limit = typeof params.limit === 'number' && Number.isFinite(params.limit) ? Math.max(1, Math.min(200, Math.trunc(params.limit))) : MEMORY_LIMIT
      const project = await totem.projectFor(exec.agent, exec.signal)
      const [specific, universal] = await Promise.all([
        totem.call('memory_list_tool', { tags: [`tool:${tool}`], status: 'active', limit, project }, exec.signal),
        totem.call('memory_list_tool', { tags: ['tool:*'], status: 'active', limit, project }, exec.signal),
      ])
      const memories = new Map<string, ToolMemory>()
      for (const item of [...itemsOf(specific), ...itemsOf(universal)]) {
        const memory = asMemory(item)
        if (memory !== undefined) memories.set(memory.id, memory)
      }
      const value = [...memories.values()].slice(0, limit)
      gate.acknowledge(exec.agent, value.map(memory => memory.id))
      return {
        tool,
        count: value.length,
        memories: value,
        ...value.length === 0 ? { note: `No memories are associated with \`${tool}\`.` } : {},
      }
    },
  }))
}
