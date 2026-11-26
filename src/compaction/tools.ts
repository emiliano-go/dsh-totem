/**
 * Read-only lookup over the session's native compaction history.
 *
 * This tool never changes the live context. It reads the calling session by
 * default; `session: "all"` or another session id is an explicit cross-session
 * lookup.
 *
 * @module dsh-totem/compaction/tools
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContextBlockStore } from './blocks.ts'

function text(value: unknown): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function sessionIdOf(agent: unknown): string {
  const id = (agent as { session?: { id?: unknown } } | undefined)?.session?.id
  return typeof id === 'string' ? id : ''
}

/** Register `compaction_search` against one compact archive. */
export function registerCompactionTools(ctx: Context, blocks: ContextBlockStore): void {
  ctx.tools.register(defineTool({
    name: 'compaction_search',
    description: 'Search compacted history. Defaults to this session; pass session="all" or another session id to read that archive. Use when the live context no longer contains earlier decisions, paths, commands, or errors. Read-only; never restores the full old transcript.',
    parameters: {
      query: { type: 'string', required: true, description: 'Text to match against compact summaries, ids, and compaction ids.' },
      limit: { type: 'number', description: 'Maximum compacts to return (default 5, max 50).' },
      session: { type: 'string', description: 'Session id to search, or "all" for every archive. Defaults to the calling session.' },
    } as never,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => text(value),
    },
    async execute(args: Record<string, unknown>, exec: { agent?: unknown }) {
      const sessionId = sessionIdOf(exec.agent)
      const requested = typeof args.session === 'string' ? args.session.trim() : ''
      const scope = requested.length === 0 ? sessionId : requested
      if (scope.length === 0) {
        return { sessionId: '', total: 0, blocks: [], error: 'no active session' }
      }
      const limit = typeof args.limit === 'number' ? args.limit : 5
      const query = typeof args.query === 'string' ? args.query : ''
      const found = scope === 'all'
        ? await blocks.searchAll(query, limit)
        : await blocks.search(scope, query, limit)
      return {
        sessionId: scope === 'all' ? 'all' : scope,
        total: found.length,
        blocks: found.map(block => ({
          id: block.id,
          sessionId: block.sessionId,
          compactionId: block.compactionId,
          tier: block.tier,
          parentIds: block.parentIds,
          summarySeq: block.summarySeq,
          replacementSeq: block.replacementSeq,
          startSeq: block.startSeq,
          endSeq: block.endSeq,
          shadowedTokenCount: block.shadowedTokenCount,
          provider: block.provider,
          model: block.model,
          createdAt: block.createdAt,
          summary: block.summary,
        })),
      }
    },
  }))
}
