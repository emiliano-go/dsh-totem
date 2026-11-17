/**
 * Human slash commands for Totem.
 *
 * Most commands run directly against the agent without becoming a model
 * message, which makes them the cheapest way to read or write memory: no turn,
 * no tool round-trip, no context cost. `/triage` is the deliberate exception:
 * it steers a model-visible turn because the work needs the agent's evidence
 * tools. The set is small — the memory tools remain the model's surface, these
 * are the human's.
 *
 * @module dsh-totem/commands
 */
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { TotemService } from './service.ts'
import {
  DEFAULT_FEED_URL,
  prepareTriage,
  type TriageOptions,
} from './triage.ts'

/** Result shape shared with the Harness command registry. */
type Result = { kind: 'success'; text?: string } | { kind: 'error'; text: string }

const MEMORY_TYPES = new Set([
  'decision', 'invariant', 'gotcha', 'rejected_idea', 'assumption', 'open_question',
  'ambiguity', 'contract', 'constraint', 'hypothesis', 'observation', 'bug',
  'architecture', 'implementation',
])

/** Parsed `/remember` input. */
export interface RememberInput {
  type: string
  tags: string[]
  statement: string
}

/** Optional settings for the non-memory commands. */
export interface TotemCommandOptions {
  triage?: Partial<TriageOptions>
}

/**
 * Parse `[/type] [tags:a,b] <statement>`.
 *
 * Unknown types fall back to `observation` rather than failing the command: a
 * human typing `/remember` cares about the fact, not the taxonomy.
 */
export function parseRemember(raw: string): RememberInput | { error: string } {
  let rest = raw.trim()
  let type = 'observation'
  let tags: string[] = []
  for (;;) {
    // The separator is whitespace or end-of-input, so a bare `type:decision`
    // is consumed instead of being mistaken for the statement text.
    const match = /^(type:([a-z_]+)|tags:([^\s]+))(?:\s+|$)/u.exec(rest)
    if (match === null) break
    if (match[2] !== undefined) {
      if (MEMORY_TYPES.has(match[2])) type = match[2]
    } else if (match[3] !== undefined) {
      tags = match[3].split(',').map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9-]+/gu, '-')).filter(Boolean)
    }
    rest = rest.slice(match[0].length)
  }
  rest = rest.trim()
  if (rest.length === 0) return { error: 'usage: /remember [type:decision] [tags:a,b] <statement>' }
  return { type, tags, statement: rest }
}

/** First sentence of a statement, capped, as a title. */
export function titleFor(statement: string): string {
  const first = statement.split(/(?<=[.!?])\s/u)[0] ?? statement
  return first.slice(0, 120).trim() || statement.slice(0, 120)
}

function lines(items: unknown, limit = 8): string {
  if (!Array.isArray(items)) return ''
  return items.slice(0, limit).map((item) => {
    const record = item as { id?: unknown; type?: unknown; title?: unknown; statement?: unknown }
    const id = typeof record.id === 'string' ? record.id.slice(0, 8) : ''
    const type = typeof record.type === 'string' ? `[${record.type}] ` : ''
    const title = typeof record.title === 'string' ? record.title : ''
    const statement = typeof record.statement === 'string' ? record.statement : ''
    return `- ${id} ${type}${[title, statement].filter(Boolean).join(': ')}`.slice(0, 240)
  }).join('\n')
}

/**
 * Register the Totem commands when the Harness composition mounts a command
 * surface. A profile without `dsh-commands` simply gets no commands.
 */
export function registerTotemCommands(
  ctx: Context,
  totem: TotemService,
  options: TotemCommandOptions = {},
): void {
  ctx.inject(['commands'], (child) => {
    const register = (definition: Parameters<Context['commands']['register']>[0]): void => {
      child.effect(() => child.commands.register(definition), `dsh-totem: command /${definition.name}`)
    }
    const triage: TriageOptions = {
      dir: options.triage?.dir ?? '',
      feedUrl: options.triage?.feedUrl ?? '',
      windowDays: options.triage?.windowDays ?? 7,
      batch: options.triage?.batch ?? 20,
    }

    register({
      name: 'remember',
      description: 'Store a durable memory in Totem without spending a model turn.',
      input: { hint: '[type:decision] [tags:a,b] <statement>' },
      async handler({ agent, rawInput, signal }): Promise<Result> {
        const parsed = parseRemember(rawInput)
        if ('error' in parsed) return { kind: 'error', text: parsed.error }
        try {
          const result = await totem.createMemory({
            type: parsed.type,
            title: titleFor(parsed.statement),
            statement: parsed.statement,
            tags: parsed.tags.length > 0 ? parsed.tags : ['command'],
            asserted_by: 'user',
          }, signal, agent) as { id?: unknown; conflicts?: unknown }
          const id = typeof result?.id === 'string' ? result.id : '?'
          const conflicts = Array.isArray(result?.conflicts) ? result.conflicts.length : 0
          return {
            kind: 'success',
            text: conflicts === 0
              ? `Stored ${parsed.type} ${id}.`
              : `Stored ${parsed.type} ${id} with ${conflicts} possible conflict(s); see /memory.`,
          }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    register({
      name: 'recall',
      description: 'Search project memory and print the strongest matches.',
      input: { hint: '<query>' },
      async handler({ agent, rawInput, signal }): Promise<Result> {
        const query = rawInput.trim()
        if (query.length === 0) return { kind: 'error', text: 'usage: /recall <query>' }
        try {
          const project = await totem.projectFor(agent, signal)
          const items = await totem.call('memory_search_tool', { query, limit: 8, project }, signal)
          const text = lines(items)
          return text.length === 0
            ? { kind: 'success', text: 'No memory matched.' }
            : { kind: 'success', text }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    register({
      name: 'forget',
      description: 'Delete one memory by id.',
      input: { hint: '<id> [reason]' },
      async handler({ rawInput, signal }): Promise<Result> {
        const [id, ...rest] = rawInput.trim().split(/\s+/u)
        if (id === undefined || id.length === 0) return { kind: 'error', text: 'usage: /forget <id> [reason]' }
        try {
          await totem.call('memory_delete_tool', {
            id,
            reason: rest.join(' ').trim() || 'deleted by user command',
          }, signal)
          return { kind: 'success', text: `Deleted ${id}.` }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    register({
      name: 'memory',
      description: 'Show memory quality: counts, stale evidence, and open conflicts.',
      async handler({ agent, signal }): Promise<Result> {
        try {
          const project = await totem.projectFor(agent, signal)
          const quality = await totem.call('memory_quality_tool', { project }, signal) as {
            totals?: { active?: number; archived?: number }
            conflicts?: { open?: number; total?: number }
            provenance?: { coverage?: number }
            staleEvidence?: number
            [key: string]: unknown
          }
          const totals = quality?.totals ?? {}
          const conflicts = quality?.conflicts ?? {}
          const stale = typeof quality?.staleEvidence === 'number' ? quality.staleEvidence : undefined
          return {
            kind: 'success',
            text: [
              `active ${totals.active ?? '?'} · archived ${totals.archived ?? '?'}`,
              `conflicts ${conflicts.open ?? 0} open / ${conflicts.total ?? 0} total`,
              ...stale === undefined ? [] : [`stale evidence ${stale}`],
            ].join('\n'),
          }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    register({
      name: 'handoff',
      description: 'Store a session handoff summary before the context is compacted.',
      input: { hint: '<what the next session must know>' },
      async handler({ agent, rawInput, signal }): Promise<Result> {
        const summary = rawInput.trim()
        if (summary.length === 0) return { kind: 'error', text: 'usage: /handoff <summary>' }
        const session = (agent as { session?: { id?: string; header?: { cwd?: string } } }).session
        const sessionId = session?.id ?? ''
        if (sessionId.length === 0) return { kind: 'error', text: 'no session identity' }
        try {
          const project = await totem.projectFor(agent, signal)
          await totem.call('memory_session_summary_tool', {
            session_id: sessionId,
            summary,
            project,
            reason: 'user handoff command',
          }, signal)
          return { kind: 'success', text: 'Handoff stored.' }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    register({
      name: 'triage',
      description: 'Triage untriaged TrustSight watcher alerts and record them in alert-triage/ledger.jsonl.',
      input: { hint: '[7d|30|YYYY-MM-DD|all] [--limit N]' },
      async handler({ agent, rawInput, signal }): Promise<Result> {
        const session = (agent as { session?: { header?: { cwd?: string } } }).session
        try {
          const preparation = await prepareTriage({
            cwd: session?.header?.cwd ?? process.cwd(),
            rawInput,
            options: {
              ...triage,
              feedUrl: triage.feedUrl.trim() || process.env.WATCHER_FEED_URL?.trim() || DEFAULT_FEED_URL,
            },
            now: Date.now(),
            signal,
          })
          if (preparation.kind === 'error') return { kind: 'error', text: preparation.text }
          if (preparation.kind === 'empty') return { kind: 'success', text: preparation.text }
          agent.steer(createUserMessage({
            content: [{ type: 'text', text: preparation.prompt }],
            source: { kind: 'user' },
          }))
          return { kind: 'success', text: preparation.text }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  })
}
