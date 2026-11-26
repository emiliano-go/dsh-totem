/**
 * Compaction survival: remember that history was condensed, then put the
 * durable decisions back in front of the model.
 *
 * The Harness compaction backend replaces an older span of the conversation
 * with one summary message. That summary is written by a model and keeps what
 * the summarizer thought mattered, so a decision or gotcha recorded forty turns
 * ago can disappear. Totem already stores those facts durably; this module
 * watches the session log for compaction markers and asks the plugin to inject
 * a budgeted recovery block at the next step.
 *
 * Two markers are recognised, because a compaction that fails part way through
 * still leaves the first one behind:
 *
 * - `compaction/start` — the durable lock written before summarization.
 * - a user message whose source is `compact-checkpoint` — the replacement.
 *
 * @module dsh-totem/compaction
 */
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { bulletBlock, clipToTokens, rankItems, type BudgetItem } from './budget.ts'
import type { TotemService } from './service.ts'
import type { SessionLedger } from './ledger.ts'
import { ContextBlockStore } from './compaction/blocks.ts'

/** The event fields compaction detection reads. */
export interface CompactionEventLike {
  type?: unknown
  data?: unknown
}

function sourceKind(event: CompactionEventLike): string {
  const data = event.data as { message?: { source?: { kind?: unknown } }; source?: { kind?: unknown } } | undefined
  const kind = data?.message?.source?.kind ?? data?.source?.kind
  return typeof kind === 'string' ? kind : ''
}

/**
 * Whether one session event marks a compaction.
 *
 * Exported for tests: the two markers are the whole detection contract, and
 * treating either as "nothing happened" is the silent memory-loss bug this
 * module exists to prevent.
 */
export function isCompactionEvent(event: CompactionEventLike): boolean {
  if (event.type === 'compaction/start') return true
  if (event.type === 'user/message') return sourceKind(event) === 'compact-checkpoint'
  return false
}

/** Types worth restoring after a compaction: durable claims, not file state. */
const RECOVERY_TYPES = new Set([
  'decision', 'invariant', 'contract', 'gotcha', 'constraint', 'architecture', 'bug', 'rejected_idea',
])

/** Render the post-compaction recovery block. */
export function formatRecovery(
  recent: readonly BudgetItem[],
  tasks: readonly BudgetItem[],
  maxTokens = 600,
  workingState = '',
  compactSummary = '',
): string {
  const durable = rankItems(recent.filter((item) => {
    const type = typeof item.type === 'string' ? item.type : ''
    return RECOVERY_TYPES.has(type)
  }))
  const hasMemory = durable.length > 0 || tasks.length > 0
  const compact = compactSummary.trim().length === 0
    ? ''
    : clipToTokens(
      `Latest compact (search older compacts with compaction_search):\n${compactSummary.trim()}`,
      Math.max(120, Math.floor(maxTokens * 0.3)),
    )
  const remaining = Math.max(0, maxTokens - Math.ceil(compact.length / 4))
  if (!hasMemory && workingState.length === 0 && compact.length === 0) return ''
  // The mechanical ledger keeps the present task; durable memory keeps the
  // decisions behind it. Split the budget so neither starves the other.
  const working = workingState.length === 0
    ? ''
    : clipToTokens(workingState, Math.max(120, Math.floor(remaining * 0.5)))
  const memoryBudget = Math.max(0, remaining - (working.length === 0 ? 0 : Math.ceil(working.length / 4)))
  if (!hasMemory) return [compact, working].filter(Boolean).join('\n\n')
  // Memory tasks share importance semantics with other items, so they are
  // rendered after the durable claims and get whatever budget remains.
  const lines = bulletBlock(durable, Math.max(0, memoryBudget - 120))
  const suffix = lines.length > 0 ? lines : []
  const taskLines = bulletBlock(tasks, Math.max(0, memoryBudget - 60), 160)
  if (suffix.length === 0 && taskLines.length === 0) return [compact, working].filter(Boolean).join('\n\n')
  const memory = clipToTokens([
    'Project memory restored after context compaction (Totem).',
    'These are durable claims from earlier work; verify anything stale-prone before relying on it.',
    ...suffix.length === 0 ? [] : ['Durable:', ...suffix],
    ...taskLines.length === 0 ? [] : ['In progress:', ...taskLines],
  ].join('\n'), memoryBudget)
  return [compact, working, memory].filter(Boolean).join('\n\n')
}

/** Session-scoped compaction tracker. */
export class CompactionMemory {
  /** Sessions with a compaction marker that has not been answered yet. */
  private readonly pending = new Set<string>()
  /** Compaction markers seen per session, for diagnostics and routes. */
  private readonly counts = new Map<string, number>()

  constructor(
    private readonly totem: TotemService,
    private readonly ledger?: SessionLedger,
    private readonly blocks: Pick<ContextBlockStore, 'read'> = new ContextBlockStore(),
  ) {}

  /** Record one event; returns true when it was a compaction marker. */
  note(sessionId: string, event: CompactionEventLike): boolean {
    if (sessionId.length === 0 || !isCompactionEvent(event)) return false
    this.pending.add(sessionId)
    this.counts.set(sessionId, (this.counts.get(sessionId) ?? 0) + 1)
    return true
  }

  /** Whether the session still needs a recovery block. */
  needsRecovery(sessionId: string): boolean {
    return this.pending.has(sessionId)
  }

  /** Compactions observed for one session. */
  count(sessionId: string): number {
    return this.counts.get(sessionId) ?? 0
  }

  /** Forget a session (disposal, or a session that will never step again). */
  clear(sessionId: string): void {
    this.pending.delete(sessionId)
    this.counts.delete(sessionId)
  }

  /**
   * Build and consume the recovery block for one session.
   *
   * The pending flag is cleared before the query so a Totem failure cannot
   * cause the same block to be retried on every later step forever; a failure
   * simply produces no injection this time.
   */
  async take(agent: unknown, sessionId: string, signal: AbortSignal, maxTokens: number): Promise<string> {
    if (!this.pending.has(sessionId)) return ''
    this.pending.delete(sessionId)
    try {
      const project = await this.totem.projectFor(agent, signal)
      const [recent, tasks, blocks] = await Promise.all([
        this.totem.call('memory_list_tool', { sort: 'importance', limit: 40, project }, signal),
        this.totem.call('memory_tasks_tool', { limit: 10, project }, signal),
        this.blocks.read(sessionId).catch(() => []),
      ]) as [BudgetItem[] | unknown, BudgetItem[] | unknown, { summary: string }[]]
      const latestCompact = blocks.length === 0 ? '' : blocks[blocks.length - 1].summary
      return formatRecovery(
        Array.isArray(recent) ? recent as BudgetItem[] : [],
        Array.isArray(tasks) ? tasks as BudgetItem[] : [],
        maxTokens,
        this.ledger?.render(sessionId, Math.max(0, Math.floor(maxTokens * 0.5))) ?? '',
        latestCompact,
      )
    } catch {
      return ''
    }
  }
}

/** A recovery block as an injectable user message with a stable source kind. */
export function recoveryMessage(text: string): unknown {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'totem-memory' },
  })
}

/** Convenience alias so callers need no Context import for the message helper. */
export type RecoveryContext = Context
