/**
 * Native Totem tool surface. Each tool proxies one Totem MCP tool, injects the
 * session's project root, and keeps the model-facing names short.
 *
 * @module dsh-totem/tools
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemService } from './service.ts'

const MEMORY_TYPES = [
  'decision', 'invariant', 'gotcha', 'rejected_idea', 'assumption', 'open_question',
  'ambiguity', 'contract', 'constraint', 'hypothesis', 'observation', 'bug',
  'architecture', 'implementation',
] as const

const ASSERTED_BY = ['user', 'test', 'source', 'git', 'doc', 'runtime', 'agent'] as const

const TEXT = (value: unknown): { type: 'text'; text: string }[] => [{
  type: 'text',
  text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
}]

/** Register the native memory tools. */
export function registerMemoryTools(ctx: Context, totem: TotemService): void {
  const register = (
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    tool: string,
    map?: (args: Record<string, unknown>, exec: { signal: AbortSignal; agent?: unknown }) => Promise<unknown>,
  ): void => {
    ctx.tools.register(defineTool({
      name,
      description,
      // The DSL types are structural; the values below are validated by defineTool.
      parameters: parameters as never,
      output: {
        schema: { type: 'json' },
        render: (_args, value) => TEXT(value),
      },
      async execute(args, exec) {
        if (map !== undefined) return map(args as Record<string, unknown>, exec)
        const project = await totem.projectFor(exec.agent, exec.signal)
        return totem.call(tool, { ...args as Record<string, unknown>, project }, exec.signal)
      },
    }))
  }

  register('memory_search', 'Search project memory (Totem) by tags and full text.', {
    query: { type: 'string', required: true, description: 'Search query.' },
    types: { type: 'array', items: { type: 'string' }, description: 'Filter by memory types.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags.' },
    include_stale: { type: 'boolean', description: 'Include potentially stale items.' },
    limit: { type: 'number', description: 'Maximum results (default 20).' },
  }, 'memory_search_tool')

  register('memory_get', 'Fetch one memory by id, including evidence and staleness.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    include_evidence: { type: 'boolean', description: 'Include evidence (default true).' },
  }, 'memory_get_tool')

  register('memory_list', 'List memories with optional type, tag, and status filters.', {
    type: { type: 'string', enum: MEMORY_TYPES, description: 'Filter by memory type.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags.' },
    status: { type: 'string', description: 'Filter by status.' },
    sort: { type: 'string', description: "Sort by 'created_at', 'updated_at', or 'importance'." },
    limit: { type: 'number', description: 'Maximum items (default 50).' },
  }, 'memory_list_tool')

  register('memory_create', 'Write a durable memory (decision, gotcha, invariant, observation, …). A secondary model rewrites the prose.', {
    type: { type: 'string', required: true, enum: MEMORY_TYPES, description: 'Memory type.' },
    title: { type: 'string', required: true, description: 'Short title.' },
    statement: { type: 'string', required: true, description: 'The factual claim being stored.' },
    tags: { type: 'array', required: true, items: { type: 'string' }, description: 'At least one tag.' },
    details: { type: 'string', description: 'Optional additional details.' },
    confidence: { type: 'number', description: '0-1; derived from asserted_by when omitted.' },
    importance: { type: 'number', description: '0-1 (default 0.5).' },
    asserted_by: { type: 'string', enum: ASSERTED_BY, description: 'Who established the claim.' },
    metadata: { type: 'json', description: 'Extra metadata (decisions need rationale; invariants need verificationMethod and condition).' },
    evidence: { type: 'array', items: { type: 'json' }, description: 'Evidence objects with path/startLine/endLine/contentHash.' },
    related_memory_ids: { type: 'array', items: { type: 'string' }, description: 'Related memory ids.' },
  }, 'memory_create_tool', async (args, exec) => totem.createMemory(args, exec.signal, exec.agent))

  register('memory_update', 'Update an existing memory; a secondary model rewrites changed prose.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    reason: { type: 'string', description: 'Why this update was made.' },
    title: { type: 'string', description: 'New title.' },
    statement: { type: 'string', description: 'New statement.' },
    details: { type: 'string', description: 'New details.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'New tags.' },
    status: { type: 'string', description: 'New status.' },
    confidence: { type: 'number', description: 'New confidence 0-1.' },
    importance: { type: 'number', description: 'New importance 0-1.' },
    metadata: { type: 'json', description: 'New metadata.' },
  }, 'memory_update_tool', async (args, exec) => totem.updateMemory(args, exec.signal, exec.agent))

  register('memory_delete', 'Delete a memory, recording the reason.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    reason: { type: 'string', required: true, description: 'Why it is deleted.' },
  }, 'memory_delete_tool')

  register('memory_recent', 'List the most recently created memories.', {
    limit: { type: 'number', description: 'Maximum items (default 5).' },
  }, 'memory_recent_tool')

  register('memory_tasks', "List in-progress work memories (tagged task:*).", {
    limit: { type: 'number', description: 'Maximum items (default 10).' },
  }, 'memory_tasks_tool')

  register('memory_commands', 'List recorded command outcomes (gotchas tagged cmd:*).', {
    limit: { type: 'number', description: 'Maximum items (default 20).' },
  }, 'memory_commands_tool')

  register('memory_relate', 'Create a typed relation between two memories.', {
    from_id: { type: 'string', required: true, description: 'Source memory id.' },
    to_id: { type: 'string', required: true, description: 'Target memory id.' },
    kind: {
      type: 'string', required: true,
      enum: ['supersedes', 'contradicts', 'invalidates', 'derived_from', 'verified_by', 'refines', 'depends_on'],
      description: 'Relation kind.',
    },
  }, 'memory_relate_tool')

  register('memory_relations', 'List relations attached to a memory.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
  }, 'memory_relations_tool')

  register('memory_history', 'Read the revision history of a memory.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
  }, 'memory_history_tool')

  register('memory_verify', 'Mark a memory verified, setting verified_at and the commit.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    method: { type: 'string', description: 'How it was verified.' },
    commit: { type: 'string', description: 'Git commit verified at (defaults to HEAD).' },
    confidence: { type: 'number', description: 'Confidence to set (default 1.0).' },
  }, 'memory_verify_tool')

  register('engineering_context', 'Assemble ranked engineering context for a task and tags.', {
    tags: { type: 'array', required: true, items: { type: 'string' }, description: 'Tags to match.' },
    task: { type: 'string', description: 'Task description shown in the header.' },
    current_task: { type: 'string', description: 'What you are working on now; boosts relevant memories.' },
    paths: { type: 'array', items: { type: 'string' }, description: 'Changed paths to boost.' },
    types: { type: 'array', items: { type: 'string' }, description: 'Filter by memory types.' },
    token_budget: { type: 'number', description: 'Optional token budget.' },
    include_stale: { type: 'boolean', description: 'Include potentially stale items.' },
  }, 'engineering_context_tool')

  register('memory_export', 'Export all memories and conflicts as portable JSON.', {}, 'memory_export_tool')

  register('memory_import', 'Import memories from a previous export (duplicate ids are skipped).', {
    data: { type: 'json', required: true, description: "The export object with 'items' and optional 'conflicts'." },
  }, 'memory_import_tool')
}
