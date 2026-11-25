/**
 * Read-only lookup over the session's native compaction history.
 *
 * This tool never changes the live context. It returns only blocks for the
 * calling session, so a delegated agent cannot read another session's compact
 * archive by guessing an id.
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
    description: 'Search the compacts already produced in this session. Use when the live context no longer contains earlier decisions, paths, commands, or errors. Read-only; never restores the full old transcript.',
    parameters: {
      query: { type: 'string', required: true, description: 'Text to match against compact summaries, ids, and compaction ids.' },
      limit: { type: 'number', description: 'Maximum compacts to return (default 5, max 50).' },
    } as never,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => text(value),
    },
    async execute(args: Record<string, unknown>, exec: { agent?: unknown }) {
      const sessionId = sessionIdOf(exec.agent)
      if (sessionId.length === 0) {
        return { sessionId: '', total: 0, blocks: [], error: 'no active session' }
      }
      const limit = typeof args.limit === 'number' ? args.limit : 5
      const found = await blocks.search(sessionId, typeof args.query === 'string' ? args.query : '', limit)
      return {
        sessionId,
        total: found.length,
        blocks: found.map(block => ({
          id: block.id,
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
