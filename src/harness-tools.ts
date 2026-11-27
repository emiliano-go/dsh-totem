/** Tools for the harness-optimization history, separate from task memory. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { HarnessMemory, HarnessStatus } from './harness-memory.ts'
import type { MetricsLog } from './metrics.ts'

const TEXT = (value: unknown): { type: 'text'; text: string }[] => [{
  type: 'text',
  text: JSON.stringify(value, null, 2),
}]

const STATUS: HarnessStatus[] = ['proposed', 'accepted', 'rejected', 'superseded']

export function registerHarnessTools(ctx: Context, harness: HarnessMemory, metrics?: MetricsLog): void {
  ctx.tools.register(defineTool({
    name: 'harness_plan',
    description: 'Decide the next harness experiment from prior attempts. Call before changing a harness mechanism; returns the strongest accepted edit, rejected edits, and one concrete next experiment.',
    parameters: {
      rootCause: { type: 'string', required: true, description: 'The recurring harness problem to plan for.' },
      benchmark: { type: 'string', description: 'Target benchmark or task context.' },
      model: { type: 'string', description: 'Target policy/model context.' },
      limit: { type: 'number', description: 'Maximum history records to inspect (default 50, max 50).' },
    } as never,
    output: { schema: { type: 'json' }, render: (_args, value) => TEXT(value) },
    async execute(args: Record<string, unknown>) {
      const plan = await harness.plan(String(args.rootCause ?? ''), {
        benchmark: typeof args.benchmark === 'string' ? args.benchmark : '',
        model: typeof args.model === 'string' ? args.model : '',
        limit: typeof args.limit === 'number' ? args.limit : 50,
      })
      metrics?.record('harness.plan', {
        rootCause: plan.rootCause,
        matched: plan.total,
        accepted: plan.accepted?.id ?? '',
        rejected: plan.rejected.length,
      })
      return plan
    },
  }))

  ctx.tools.register(defineTool({
    name: 'harness_record',
    description: 'Record a harness-optimization attempt: recurring root cause, edit, rationale, predicted result, observed result, and evaluation context. This is separate from task memory.',
    parameters: {
      rootCause: { type: 'string', required: true, description: 'The recurring harness problem this edit addresses.' },
      edit: { type: 'string', required: true, description: 'The change that was made.' },
      rationale: { type: 'string', description: 'Why this edit should address the root cause.' },
      predicted: { type: 'string', description: 'Predicted task/benchmark outcome before evaluation.' },
      observed: { type: 'string', description: 'Observed task/benchmark outcome after evaluation.' },
      benchmark: { type: 'string', description: 'Benchmark or task context.' },
      model: { type: 'string', description: 'Policy/model context.' },
      commit: { type: 'string', description: 'Commit containing the edit.' },
      round: { type: 'number', description: 'Optimization round (default 1).' },
      status: { type: 'string', enum: STATUS, description: 'Attempt status (default proposed).' },
      metrics: { type: 'json', description: 'Numeric measurements, e.g. {score: 73.2, delta: 2.4}.' },
      relatedMemoryIds: { type: 'array', items: { type: 'string' }, description: 'Task-memory ids this edit relates to.' },
    } as never,
    output: { schema: { type: 'json' }, render: (_args, value) => TEXT(value) },
    async execute(args: Record<string, unknown>) {
      const status = typeof args.status === 'string' && STATUS.includes(args.status as HarnessStatus)
        ? args.status as HarnessStatus
        : 'proposed'
      const record = await harness.record({
        rootCause: String(args.rootCause ?? ''),
        edit: String(args.edit ?? ''),
        rationale: typeof args.rationale === 'string' ? args.rationale : '',
        predicted: typeof args.predicted === 'string' ? args.predicted : '',
        observed: typeof args.observed === 'string' ? args.observed : '',
        benchmark: typeof args.benchmark === 'string' ? args.benchmark : '',
        model: typeof args.model === 'string' ? args.model : '',
        commit: typeof args.commit === 'string' ? args.commit : '',
        round: typeof args.round === 'number' ? args.round : 1,
        status,
        metrics: typeof args.metrics === 'object' && args.metrics !== null
          ? Object.fromEntries(Object.entries(args.metrics).filter(([, value]) => typeof value === 'number')) as Record<string, number>
          : {},
        relatedMemoryIds: Array.isArray(args.relatedMemoryIds)
          ? args.relatedMemoryIds.filter((id): id is string => typeof id === 'string')
          : [],
      })
      metrics?.record('harness.record', { id: record.id, status, benchmark: record.benchmark, model: record.model })
      return record
    },
  }))

  ctx.tools.register(defineTool({
    name: 'harness_history',
    description: 'Search prior harness-optimization attempts by root cause, edit, benchmark, or model. Use before changing the harness so the same failed edit is not repeated.',
    parameters: {
      query: { type: 'string', description: 'Text to match across the harness history.' },
      limit: { type: 'number', description: 'Maximum records (default 5, max 50).' },
    } as never,
    output: { schema: { type: 'json' }, render: (_args, value) => TEXT(value) },
    async execute(args: Record<string, unknown>) {
      const limit = typeof args.limit === 'number' ? args.limit : 5
      const records = await harness.history(typeof args.query === 'string' ? args.query : '', limit)
      metrics?.record('harness.history', { results: records.length })
      return { total: records.length, records }
    },
  }))
}
