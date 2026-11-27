/**
 * Native Totem tool surface. Each tool proxies one Totem MCP tool, injects the
 * session's project root, and keeps the model-facing names short.
 *
 * @module dsh-totem/tools
 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemService } from './service.ts'
import type { ConflictInbox } from './conflicts.ts'

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

/**
 * Retain the conflicts a write reported.
 *
 * The write itself already succeeded, so a failure here must not turn a stored
 * memory into a tool error; the inbox is a review aid, not part of the write.
 */
async function keepConflicts(
  dependencies: ToolDependencies,
  totem: TotemService,
  result: unknown,
  exec: { signal: AbortSignal; agent?: unknown },
): Promise<void> {
  const inbox = dependencies.conflicts
  if (inbox === undefined || typeof result !== 'object' || result === null) return
  const record = result as { id?: unknown; conflicts?: unknown }
  if (!Array.isArray(record.conflicts) || record.conflicts.length === 0) return
  try {
    const project = await totem.projectFor(exec.agent, exec.signal)
    await inbox.record(project, typeof record.id === 'string' ? record.id : '', record.conflicts)
  } catch {
    // The memory is stored; only the review entry is missing.
  }
}

/** Optional collaborators a composition may provide. */
export interface ToolDependencies {
  /** Conflict inbox that retains detected contradictions for review. */
  conflicts?: ConflictInbox
}

/** Register the native memory tools. */
export function registerMemoryTools(ctx: Context, totem: TotemService, dependencies: ToolDependencies = {}): void {
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
        const started = Date.now()
        const value = await totem.call(tool, { ...args as Record<string, unknown>, project }, exec.signal)
        if (name === 'memory_search' || name === 'engineering_context') {
          totem.metrics.record('memory.query', {
            tool: name,
            ms: Date.now() - started,
            bytes: JSON.stringify(value).length,
            results: Array.isArray(value)
              ? value.length
              : typeof value === 'object' && value !== null
                ? Array.isArray((value as { selectedIds?: unknown }).selectedIds)
                  ? (value as { selectedIds: unknown[] }).selectedIds.length
                  : 0
                : 0,
          })
        }
        return value
      },
    }))
  }

  register('memory_search', 'Search project memory (Totem) by tags and full text.', {
    query: { type: 'string', required: true, description: 'Search query.' },
    types: { type: 'array', items: { type: 'string' }, description: 'Filter by memory types.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags.' },
    include_stale: { type: 'boolean', description: 'Include potentially stale items.' },
    limit: { type: 'number', description: 'Maximum results (default 20).' },
    as_of: { type: 'string', description: 'Evaluate temporal validity at this ISO timestamp.' },
    include_expired: { type: 'boolean', description: 'Include memories outside their validity window.' },
    include_file_state: { type: 'boolean', description: 'Include operational file-state TLDRs (default false).' },
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
    tools: { type: 'array', items: { type: 'string' }, description: 'Tool names this memory governs, e.g. ["write","edit"]. Stored as tool:<name> tags and enforced before those tools run.' },
    details: { type: 'string', description: 'Optional additional details.' },
    aliases: { type: 'array', items: { type: 'string' }, description: 'Alternate phrasings of the same claim.' },
    event_time: { type: 'string', description: 'ISO timestamp when the described event happened.' },
    provenance: { type: 'array', items: { type: 'json' }, description: 'Source records with source_kind, source_id, method, unit_id.' },
    link_to: { type: 'string', description: 'Existing memory id to link instead of creating a new item.' },
    confidence: { type: 'number', description: '0-1; derived from asserted_by when omitted.' },
    importance: { type: 'number', description: '0-1 (default 0.5).' },
    asserted_by: { type: 'string', enum: ASSERTED_BY, description: 'Who established the claim.' },
    metadata: { type: 'json', description: 'Extra metadata (decisions need rationale; invariants need verificationMethod and condition).' },
    evidence: { type: 'array', items: { type: 'json' }, description: 'Evidence objects with path/startLine/endLine/contentHash.' },
    related_memory_ids: { type: 'array', items: { type: 'string' }, description: 'Related memory ids.' },
    valid_from: { type: 'string', description: 'ISO timestamp when the claim starts being true.' },
    valid_to: { type: 'string', description: 'ISO timestamp when the claim stops being true.' },
  }, 'memory_create_tool', async (args, exec) => {
    const result = await totem.createMemory(args, exec.signal, exec.agent)
    await keepConflicts(dependencies, totem, result, exec)
    return result
  })

  register('memory_update', 'Update an existing memory; a secondary model rewrites changed prose.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    reason: { type: 'string', description: 'Why this update was made.' },
    title: { type: 'string', description: 'New title.' },
    statement: { type: 'string', description: 'New statement.' },
    details: { type: 'string', description: 'New details.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'New tags.' },
    tools: { type: 'array', items: { type: 'string' }, description: 'Tool names this memory governs; merged into tags as tool:<name>.' },
    status: { type: 'string', description: 'New status.' },
    confidence: { type: 'number', description: 'New confidence 0-1.' },
    importance: { type: 'number', description: 'New importance 0-1.' },
    metadata: { type: 'json', description: 'New metadata.' },
    valid_from: { type: 'string', description: 'New validity start (empty string clears it).' },
    valid_to: { type: 'string', description: 'New validity end (empty string clears it).' },
    event_time: { type: 'string', description: 'New event time (empty string clears it).' },
    aliases: { type: 'array', items: { type: 'string' }, description: 'Additional alternate phrasings.' },
  }, 'memory_update_tool', async (args, exec) => {
    const result = await totem.updateMemory(args, exec.signal, exec.agent)
    await keepConflicts(dependencies, totem, result, exec)
    return result
  })

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

  register('memory_aliases', 'Add or list alternate phrasings for a memory.', {
    action: { type: 'string', description: "Action: 'add' or 'list' (default list)." },
    item_id: { type: 'string', description: 'Memory id for add or list.' },
    alias: { type: 'string', description: 'Alias text for add.' },
    source: { type: 'string', description: 'Who supplied the alias.' },
    limit: { type: 'number', description: 'Maximum rows for list (default 200).' },
  }, 'memory_aliases_tool')

  register('memory_provenance', 'Add or list auditable sources for a memory.', {
    action: { type: 'string', description: "Action: 'add' or 'list' (default list)." },
    item_id: { type: 'string', description: 'Memory id.' },
    source_kind: { type: 'string', description: 'session, file, command, test, user, doc, import.' },
    source_id: { type: 'string', description: 'Session id, path, or command hash.' },
    method: { type: 'string', description: 'read, write, test, command, user, doc, inference, summary, import.' },
    unit_id: { type: 'string', description: 'Turn or message id.' },
    evidence_hash: { type: 'string', description: 'Evidence digest observed at capture.' },
    observed_at: { type: 'string', description: 'ISO time the source was observed.' },
    metadata: { type: 'json', description: 'Extra provenance metadata.' },
  }, 'memory_provenance_tool')

  register('memory_coverage', 'Derive or update the extraction coverage ledger.', {
    action: { type: 'string', description: "status, mark, reset, or list." },
    source_kind: { type: 'string', description: 'session, file, doc.' },
    source_id: { type: 'string', description: 'Stable source id.' },
    units: { type: 'array', items: { type: 'json' }, description: 'Units with unit_id and fingerprint.' },
    extractor_version: { type: 'string', description: 'Extractor version.' },
    unit_id: { type: 'string', description: 'Unit id for mark.' },
    fingerprint: { type: 'string', description: 'Content fingerprint for mark.' },
    metadata: { type: 'json', description: 'Extra coverage metadata.' },
  }, 'memory_coverage_tool')

  register('memory_identity', 'Find likely duplicate claims, or merge a duplicate into a canonical.', {
    action: { type: 'string', description: "check or merge." },
    statement: { type: 'string', description: 'Candidate statement for check.' },
    title: { type: 'string', description: 'Candidate title.' },
    aliases: { type: 'array', items: { type: 'string' }, description: 'Candidate aliases.' },
    evidence_paths: { type: 'array', items: { type: 'string' }, description: 'Candidate evidence paths.' },
    entity_ids: { type: 'array', items: { type: 'string' }, description: 'Candidate entity ids.' },
    duplicate_id: { type: 'string', description: 'Duplicate memory id for merge.' },
    canonical_id: { type: 'string', description: 'Canonical memory id for merge.' },
    dry_run: { type: 'boolean', description: 'Preview a merge (default true).' },
    reason: { type: 'string', description: 'Merge reason.' },
  }, 'memory_identity_tool')

  register('memory_argument', 'Create, list, delete, or simplify multi-premise arguments.', {
    action: { type: 'string', description: "create, list, delete, or simplify." },
    conclusion_id: { type: 'string', description: 'Conclusion memory id.' },
    premise_ids: { type: 'array', items: { type: 'string' }, description: 'Premise memory ids.' },
    kind: { type: 'string', description: 'entails, supports, or explains.' },
    source_episode: { type: 'string', description: 'Session or episode that recorded the argument.' },
    argument_id: { type: 'string', description: 'Argument id for delete.' },
    apply: { type: 'boolean', description: 'Apply simplification (default true).' },
    item_id: { type: 'string', description: 'Item id for list.' },
  }, 'memory_argument_tool')

  register('memory_history', 'Read the revision history of a memory.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
  }, 'memory_history_tool')

  register('memory_verify', 'Mark a memory verified. Pass check_id to justify it with a recorded check; without one the verification is recorded as an assertion.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    method: { type: 'string', description: 'How it was verified.' },
    commit: { type: 'string', description: 'Git commit verified at (defaults to HEAD).' },
    confidence: { type: 'number', description: 'Confidence to set (default 1.0).' },
    check_id: { type: 'string', description: 'Recorded check id that justifies the verification.' },
  }, 'memory_verify_tool')

  register('memory_check_record', 'Record an observed check for a memory: command, cwd, exit code, output hash, evidence hash, commit, and run time.', {
    id: { type: 'string', required: true, description: 'Memory id the check supports.' },
    name: { type: 'string', required: true, description: 'Short check name, for example "pytest tests/test_auth.py".' },
    command: { type: 'string', description: 'Command that was run.' },
    cwd: { type: 'string', description: 'Working directory of the run.' },
    exit_code: { type: 'number', description: 'Observed exit code; 0 is a pass.' },
    output: { type: 'string', description: 'Captured output; hashed, not stored verbatim.' },
    output_hash: { type: 'string', description: 'Precomputed SHA-256 of the output.' },
    evidence_hash: { type: 'string', description: 'Evidence digest the check ran against (defaults to current evidence).' },
    commit: { type: 'string', description: 'Git commit the check ran at (defaults to HEAD).' },
    ran_at: { type: 'string', description: 'ISO timestamp of the run.' },
  }, 'memory_check_record_tool')

  register('memory_audit', 'Verify the memory history hash chain and each item state digest.', {}, 'memory_audit_tool')

  register('memory_quality', 'Report signal ratio, provenance, stale evidence, conflicts, and digest quality.', {}, 'memory_quality_tool')

  register('memory_file_context', 'Return a file current-state TLDR keyed by content hash; a fresh file is not rewritten.', {
    path: { type: 'string', required: true, description: 'File path relative to the project or absolute.' },
    reason: { type: 'string', description: 'Why the file state was captured.' },
    statement: { type: 'string', description: 'Optional TLDR override.' },
    details: { type: 'string', description: 'Optional extra details.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Extra tags.' },
    refresh: { type: 'boolean', description: 'Update when the content changed (default true).' },
    title: { type: 'string', description: 'Optional title override.' },
  }, 'memory_file_context_tool')

  register('memory_session_summary', 'Create or update one compact summary for a work session.', {
    session_id: { type: 'string', required: true, description: 'Stable session id.' },
    summary: { type: 'string', required: true, description: 'What changed and why, in one or two sentences.' },
    files: { type: 'array', items: { type: 'string' }, description: 'Changed file paths.' },
    tools: { type: 'array', items: { type: 'string' }, description: 'Tool names used in the session.' },
    commit: { type: 'string', description: 'Git commit, defaults to HEAD.' },
    title: { type: 'string', description: 'Optional title override.' },
  }, 'memory_session_summary_tool')

  register('memory_workflow', 'Create or update a reusable procedure with steps and verification.', {
    name: { type: 'string', required: true, description: 'Workflow name.' },
    steps: { type: 'array', required: true, items: { type: 'string' }, description: 'Ordered steps.' },
    preconditions: { type: 'array', items: { type: 'string' }, description: 'Preconditions.' },
    verification: { type: 'array', items: { type: 'string' }, description: 'Verification steps.' },
    failure_modes: { type: 'array', items: { type: 'string' }, description: 'Known failure modes.' },
    summary: { type: 'string', description: 'One-sentence purpose.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Extra tags.' },
  }, 'memory_workflow_tool')

  register('memory_profile', 'Write one always-on user profile block.', {
    section: { type: 'string', required: true, description: 'Profile section, such as identity or preferences.' },
    content: { type: 'string', required: true, description: 'Durable profile fact.' },
    source: { type: 'string', description: 'Who asserted it (default user).' },
  }, 'memory_profile_tool')

  register('memory_graph', 'Show entities and the memories linked to them.', {
    entity: { type: 'string', description: 'Entity name or substring.' },
    limit: { type: 'number', description: 'Result cap (default 50).' },
  }, 'memory_graph_tool')

  register('memory_rollup', 'Summarize file state into module and project memories.', {
    path_prefix: { type: 'string', description: 'Only files under this path prefix.' },
    apply: { type: 'boolean', description: 'Write the summaries (default false).' },
    min_files: { type: 'number', description: 'Minimum files per module (default 2).' },
  }, 'memory_rollup_tool')

  register('memory_heat', 'Rank memories by recency, importance, and access.', {
    limit: { type: 'number', description: 'Rows per side (default 20).' },
  }, 'memory_heat_tool')

  register('memory_touch', 'Record that memories were read, feeding the heat score.', {
    ids: { type: 'array', required: true, items: { type: 'string' }, description: 'Memory ids.' },
  }, 'memory_touch_tool')

  register('memory_decay', 'Archive low-heat operational and episodic memories past their TTL.', {
    days: { type: 'number', description: 'TTL in days (default 180).' },
    dry_run: { type: 'boolean', description: 'Report only (default true).' },
    min_importance: { type: 'number', description: 'Keep items at or above this importance (default 0.5).' },
  }, 'memory_decay_tool')

  register('memory_induce_workflow', 'Turn a session summary into a reusable workflow draft.', {
    session_id: { type: 'string', required: true, description: 'Session id with a stored summary.' },
    apply: { type: 'boolean', description: 'Create the workflow (default false).' },
    name: { type: 'string', description: 'Optional workflow name.' },
  }, 'memory_induce_workflow_tool')

  register('memory_maintenance', 'Run revalidation, rollup, decay, and consolidation.', {
    apply: { type: 'boolean', description: 'Apply changes (default false).' },
  }, 'memory_maintenance_tool')

  register('memory_export_markdown', 'Export active memories as Markdown notes.', {
    directory: { type: 'string', required: true, description: 'Destination directory.' },
  }, 'memory_export_markdown_tool')

  register('memory_import_markdown', 'Import Markdown notes produced by memory_export_markdown.', {
    directory: { type: 'string', required: true, description: 'Source directory.' },
  }, 'memory_import_markdown_tool')

  register('engineering_context', 'Assemble ranked engineering context for a task and tags.', {
    tags: { type: 'array', required: true, items: { type: 'string' }, description: 'Tags to match.' },
    task: { type: 'string', description: 'Task description shown in the header.' },
    current_task: { type: 'string', description: 'What you are working on now; boosts relevant memories.' },
    paths: { type: 'array', items: { type: 'string' }, description: 'Changed paths to boost.' },
    types: { type: 'array', items: { type: 'string' }, description: 'Filter by memory types.' },
    token_budget: { type: 'number', description: 'Optional token budget.' },
    max_item_chars: { type: 'number', description: 'Cap a single item so it cannot dominate the budget.' },
    include_stale: { type: 'boolean', description: 'Include potentially stale items.' },
    as_of: { type: 'string', description: 'Evaluate temporal validity at this ISO timestamp.' },
    include_expired: { type: 'boolean', description: 'Include memories outside their validity window.' },
    include_derived: { type: 'boolean', description: 'Include generated module/session summaries (default false).' },
    seed_ids: { type: 'array', items: { type: 'string' }, description: 'Extra candidate ids from clue search.' },
  }, 'engineering_context_tool')

  register('memory_export', 'Export all memories and conflicts as portable JSON.', {}, 'memory_export_tool')

  register('memory_import', 'Import memories from a previous export (duplicate ids are skipped).', {
    data: { type: 'json', required: true, description: "The export object with 'items' and optional 'conflicts'." },
  }, 'memory_import_tool')

  register('memory_feedback', 'Record whether a memory was useful, wrong, irrelevant, verified, or stale.', {
    id: { type: 'string', required: true, description: 'Memory id.' },
    signal: {
      type: 'string', required: true,
      enum: ['useful', 'wrong', 'irrelevant', 'verified', 'stale'],
      description: 'Feedback signal.',
    },
    query: { type: 'string', description: 'Task or query the item was considered for.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Tags supplied with that query.' },
    weight: { type: 'number', description: 'Relative weight in [0, 10] (default 1).' },
  }, 'memory_feedback_tool')

  register('memory_feedback_list', 'List recorded retrieval feedback.', {
    id: { type: 'string', description: 'Only feedback for this memory id.' },
    limit: { type: 'number', description: 'Maximum rows (default 200).' },
  }, 'memory_feedback_list_tool')

  register('memory_train_models', 'Fit the reranker and calibrator from recorded feedback.', {
    min_examples: { type: 'number', description: 'Minimum weighted examples before training (default 24).' },
  }, 'memory_train_models_tool')

  register('memory_consolidate', 'Cluster near-duplicate memories and optionally supersede duplicates.', {
    apply: { type: 'boolean', description: 'Apply the consolidation; the default is a dry run.' },
    threshold: { type: 'number', description: 'Cosine similarity needed to join a cluster (default 0.92).' },
  }, 'memory_consolidate_tool')

  register('memory_conflicts', 'List contradictions detected between stored memories and not yet resolved.', {
    include_resolved: { type: 'boolean', description: 'Include conflicts already resolved.' },
  }, 'memory_list_tool', async (args, exec) => {
    const inbox = dependencies.conflicts
    if (inbox === undefined) return { conflicts: [], note: 'conflict inbox is not mounted in this profile' }
    const project = await totem.projectFor(exec.agent, exec.signal)
    return { project, conflicts: await inbox.list(project, args.include_resolved === true) }
  })

  register('memory_resolve_conflict', 'Resolve one inbox conflict: relate the pair as contradictory and optionally supersede the losing memory.', {
    id: { type: 'string', required: true, description: 'Conflict id from memory_conflicts.' },
    resolution: {
      type: 'string', required: true,
      description: "Resolution text, or 'keep-a' / 'keep-b' to supersede the other side; 'both' records the contradiction only.",
    },
  }, 'memory_list_tool', async (args, exec) => {
    const inbox = dependencies.conflicts
    if (inbox === undefined) throw new Error('conflict inbox is not mounted in this profile')
    const id = typeof args.id === 'string' ? args.id : ''
    const resolution = typeof args.resolution === 'string' ? args.resolution : 'both'
    const resolved = await inbox.resolve(id, resolution, totem, exec.signal)
    if (resolved === undefined) throw new Error(`conflict ${id} is unknown or already resolved`)
    return resolved
  })

  register('memory_eval', 'Evaluate memory ranking (recall@k, MRR, latency) on a golden case file or an auto-derived smoke set.', {
    cases_file: { type: 'string', description: 'JSON case file; omitted derives cases from stored memories.' },
    k: { type: 'number', description: 'Recall cutoff (default 10).' },
    baseline_file: { type: 'string', description: 'Prior report to gate against.' },
    tolerance: { type: 'number', description: 'Allowed recall/MRR regression (default 0.02).' },
    p95_ms: { type: 'number', description: 'Latency budget for the gate (default 2000).' },
  }, 'totem_eval_tool')

  register('memory_prune', 'Prune stale operational file-state TLDRs. Durable decisions, gotchas, and architecture memories are never touched.', {
    max_age_days: { type: 'number', description: 'Only items older than this many days (default 14).' },
    paths: { type: 'array', items: { type: 'string' }, description: 'Optional path prefixes; defaults to scratch/benchmark roots.' },
    dry_run: { type: 'boolean', description: 'Report candidates without deleting (default true).' },
  }, 'memory_prune_file_state_tool')

  ctx.tools.register(defineTool({
    name: 'memory_metrics',
    description: 'Read recent memory and harness metrics from metrics.jsonl. Use it to check memory hit rate, latency, and file-memory noise over time.',
    parameters: {
      limit: { type: 'number', description: 'Newest events to return (default 200, max 1000).' },
    } as never,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => TEXT(value),
    },
    async execute(args: Record<string, unknown>) {
      const limit = typeof args.limit === 'number' ? args.limit : 200
      return totem.metrics.summary(limit)
    },
  }))
}
