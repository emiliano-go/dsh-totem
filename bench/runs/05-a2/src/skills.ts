/**
 * Procedural memory as Harness skills.
 *
 * Totem already stores reusable procedures (`memory_workflow`, induced from a
 * session by `memory_induce_workflow`), but a database row is inert: nothing
 * discovers it, nothing loads it on demand, and the agent has to know it exists
 * before searching. The Harness skill registry solves exactly that — a catalog
 * with cheap summaries and body-on-demand loading — so this module projects
 * workflows into it instead of copying them anywhere.
 *
 * The projection is read-through: the registry asks for a catalog, we query
 * Totem, and the body is re-read on every load. A workflow edited with
 * `memory_workflow` is visible on the next catalog without an invalidation
 * dance.
 *
 * @module dsh-totem/skills
 */
import type { Context } from '@deepseek-ai/cordis'
import type { TotemService } from './service.ts'

/** Provider name reported in the skill catalog. */
export const PROVIDER = 'totem-workflows'

/** One Totem workflow memory reduced to the fields projection needs. */
export interface WorkflowItem {
  id?: unknown
  title?: unknown
  statement?: unknown
  details?: unknown
  metadata?: {
    kind?: unknown
    name?: unknown
    responsibility?: unknown
    steps?: unknown
    preconditions?: unknown
    verification?: unknown
    failureModes?: unknown
    [key: string]: unknown
  }
}

/** Kebab-case skill name from a workflow label. */
export function skillName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64)
}

function strings(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
    .slice(0, limit)
}

/** Whether one memory row is a workflow this provider should project. */
export function isWorkflow(item: WorkflowItem): boolean {
  return item.metadata?.kind === 'workflow' && typeof item.metadata?.name === 'string'
    && item.metadata.name.trim().length > 0
}

/**
 * Render one workflow as a skill body.
 *
 * The body is instructions, not a report: steps stay imperative so a model that
 * loads the skill can follow it, and the verification section is listed
 * separately because a procedure without a check is how sessions drift.
 */
export function renderSkill(item: WorkflowItem): string {
  const metadata = item.metadata ?? {}
  const name = typeof metadata.name === 'string' ? metadata.name.trim() : 'workflow'
  const summary = typeof metadata.responsibility === 'string'
    ? metadata.responsibility
    : typeof item.statement === 'string' ? item.statement : ''
  const steps = strings(metadata.steps, 40)
  const preconditions = strings(metadata.preconditions, 20)
  const verification = strings(metadata.verification, 20)
  const failureModes = strings(metadata.failureModes, 20)
  return [
    `# ${name}`,
    '',
    summary,
    '',
    ...preconditions.length === 0 ? [] : ['## Before you start', ...preconditions.map(line => `- ${line}`), ''],
    '## Steps',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    ...verification.length === 0 ? [] : ['## Verify', ...verification.map(line => `- ${line}`), ''],
    ...failureModes.length === 0 ? [] : ['## Known failure modes', ...failureModes.map(line => `- ${line}`), ''],
  ].join('\n').trim()
}

/**
 * Register the workflow provider when the composition mounts a skill registry.
 *
 * Discovery failures return an empty catalog rather than throwing: a Totem
 * server that is down must not take the agent's skill catalog with it.
 */
export function registerWorkflowSkills(ctx: Context, totem: TotemService): void {
  ctx.inject(['skills'], (child) => {
    child.effect(() => child.skills.registerProvider(() => ({
      name: PROVIDER,
      async list(options) {
        try {
          const project = options.cwd ?? process.cwd()
          const items = await totem.call('memory_list_tool', {
            tags: ['workflow'],
            limit: 100,
            project,
          }, options.signal)
          if (!Array.isArray(items)) return []
          return (items as WorkflowItem[]).filter(isWorkflow).flatMap((item, index) => {
            const metadata = item.metadata ?? {}
            const name = skillName(String(metadata.name))
            if (name.length === 0) return []
            const description = typeof metadata.responsibility === 'string'
              ? metadata.responsibility.slice(0, 200)
              : typeof item.statement === 'string' ? item.statement.slice(0, 200) : `Workflow ${name}`
            const preconditions = strings(metadata.preconditions, 6)
            return [{
              name,
              description,
              ...preconditions.length === 0 ? {} : { whenToUse: preconditions.join('; ').slice(0, 300) },
              invocation: { modelInvocable: true, userInvocable: true },
              source: 'runtime' as const,
              provider: PROVIDER,
              rank: 100 + index,
              locator: String(item.id ?? name),
            }]
          })
        } catch {
          return []
        }
      },
      async get(candidate, options) {
        try {
          const item = await totem.call('memory_get_tool', {
            id: String(candidate.locator),
            include_evidence: false,
            project: options.cwd ?? process.cwd(),
          }, options.signal) as WorkflowItem | null
          if (item === null || !isWorkflow(item)) return undefined
          return {
            name: candidate.name,
            description: candidate.description,
            ...candidate.whenToUse === undefined ? {} : { whenToUse: candidate.whenToUse },
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'runtime' as const,
            provider: PROVIDER,
            content: renderSkill(item),
          }
        } catch {
          return undefined
        }
      },
    })), 'dsh-totem: workflow skills')
  })
}
