/**
 * Session recall: search what earlier sessions actually did.
 *
 * Totem already writes one summary per session (`memoryClass: episodic`,
 * `kind: session_summary`) with the changed files and commit, but nothing
 * exposes those records as a first-class recall surface: `memory_search`
 * returns them buried among every other memory kind. "What did we decide three
 * sessions ago?" is a different question from "which memory mentions X", so it
 * gets its own tool and its own ranking.
 *
 * @module dsh-totem/recall
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemService } from './service.ts'

/** One recalled session summary. */
export interface RecalledSession {
  id: string
  title: string
  summary: string
  files: string[]
  sessionId?: string
  commit?: string
  updatedAt?: string
}

/** Whether one stored memory is a session summary. */
export function isSessionSummary(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false
  const metadata = (item as { metadata?: unknown }).metadata
  if (typeof metadata !== 'object' || metadata === null) {
    return (item as { type?: unknown }).type === 'session_summary'
  }
  const record = metadata as { kind?: unknown; memoryClass?: unknown }
  return record.kind === 'session_summary' || record.memoryClass === 'episodic'
}

function strings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').slice(0, limit)
}

/** Reduce one stored memory to a recalled session, or undefined when it is not one. */
export function toRecalled(item: unknown): RecalledSession | undefined {
  if (!isSessionSummary(item)) return undefined
  const record = item as {
    id?: unknown
    title?: unknown
    statement?: unknown
    updated_at?: unknown
    updatedAt?: unknown
    metadata?: Record<string, unknown>
  }
  const id = typeof record.id === 'string' ? record.id : ''
  if (id.length === 0) return undefined
  const metadata = record.metadata ?? {}
  return {
    id,
    title: typeof record.title === 'string' ? record.title : 'Session',
    summary: typeof record.statement === 'string' ? record.statement : '',
    files: strings(metadata.files, 20),
    ...typeof metadata.sessionId === 'string' ? { sessionId: metadata.sessionId } : {},
    ...typeof metadata.commit === 'string' ? { commit: metadata.commit } : {},
    ...typeof record.updated_at === 'string' ? { updatedAt: record.updated_at }
      : typeof record.updatedAt === 'string' ? { updatedAt: record.updatedAt } : {},
  }
}

/** Filter and rank a memory result page down to sessions. */
export function recallSessions(items: unknown, limit = 10): RecalledSession[] {
  if (!Array.isArray(items)) return []
  return items
    .map(toRecalled)
    .filter((item): item is RecalledSession => item !== undefined)
    .slice(0, Math.max(1, limit))
}

/** Register `memory_recall_sessions`. */
export function registerRecallTool(ctx: Context, totem: TotemService): void {
  ctx.tools.register(defineTool({
    name: 'memory_recall_sessions',
    description: 'Search summaries of earlier sessions: what was done, which files changed, and at which commit. Use before re-deriving prior work.',
    parameters: {
      query: { type: 'string', description: 'What earlier work you are looking for; empty lists the most recently updated sessions.' },
      limit: { type: 'number', description: 'Maximum sessions to return (default 10).' },
    } as never,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const input = args as { query?: unknown; limit?: unknown }
      const query = typeof input.query === 'string' ? input.query.trim() : ''
      const limit = typeof input.limit === 'number' && Number.isFinite(input.limit) ? input.limit : 10
      const project = await totem.projectFor(exec.agent, exec.signal)
      // Ask for a wide page: session summaries are a minority of stored
      // memories, so a narrow search would return none of them for a good query.
      const raw = query.length > 0
        ? await totem.call('memory_search_tool', { query, limit: 60, include_stale: true, project }, exec.signal)
        : await totem.call('memory_list_tool', { limit: 60, sort: 'updated_at', project }, exec.signal)
      return { project, sessions: recallSessions(raw, limit) }
    },
  }))
}
