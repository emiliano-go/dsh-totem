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
  /** Schedule a host restart; omitted leaves `/restart` unavailable. */
  restart?: () => { launcher: string; mode: 'now' | 'idle' }
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

/** Filesystem-safe slug for a research question. */
export function researchSlug(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48) || 'research'
}

/**
 * Build the turn-steering prompt for `/research`.
 *
 * The skill carries the full protocol, but a profile that has not copied
 * `.agents/skills` into `~/.agents/skills` will not see it, so the prompt
 * repeats the non-negotiable parts: parallel query fan-out, full-page reads,
 * recursive citation following, verification, and a cited report.
 */
export function researchPrompt(question: string, date = new Date().toISOString().slice(0, 10)): string {
  const path = `research/${researchSlug(question)}-${date}.md`
  return [
    'Run a deep research task. Answer with evidence, not the first plausible page.',
    '',
    `Question: ${question}`,
    '',
    'If `deep-research` is in the skill catalog, load it first; it is the full protocol. Otherwise follow these steps:',
    '1. Frame: restate the question, list 3-6 subquestions, and state what evidence would settle each.',
    '2. Fan out: write 3-4 genuinely different queries per subquestion (canonical, exact phrase, site:primary-source, contrarian). Issue them in parallel in one turn.',
    '3. Triage: prefer primary sources (specs, docs, repos, papers, filings) over SEO articles; drop syndicated duplicates.',
    '4. Read: use mcp__searxncrawl__crawl for pages, crawl_site for docs sites, and mcp__cluefinch__web_fetch/web_links for chunked long documents and citation navigation. Never cite a snippet.',
    '5. Recurse: follow cited primary sources up to depth 2; use mcp__cluefinch__web_links to choose links.',
    '6. Gap loop: re-search missing or contradictory claims with new wording; report unresolved contradictions instead of hiding them.',
    '7. Verify: each load-bearing claim needs one primary source or two independent secondary sources; record retrieval dates.',
    '8. Report: answer first, then an evidence table with inline [S#] citations, a full source table (title, URL, type, date), and an explicit contradictions/gaps section. Distinguish fact, inference, and unverified.',
    '',
    'Default budget: 20 searches, 12 distinct pages read in full, recursion depth 2. State it if you exceed it.',
    `Write the report to \`${path}\` in the session cwd and also answer inline.`,
  ].join('\n')
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
      name: 'restart',
      description: 'Relaunch the DSH host, waiting for the running turn to finish.',
      input: { hint: '(no input)' },
      async handler(): Promise<Result> {
        if (options.restart === undefined) {
          return { kind: 'error', text: 'restart is not wired on this host' }
        }
        try {
          const plan = options.restart()
          return {
            kind: 'success',
            text: plan.mode === 'idle'
              ? `Restart queued via ${plan.launcher}; it runs when this turn finishes.`
              : `Restarting via ${plan.launcher}.`,
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

    register({
      name: 'research',
      description: 'Run a deep research task with the search/crawl MCP servers and produce a cited report.',
      input: { hint: '<question>' },
      async handler({ agent, rawInput }): Promise<Result> {
        const question = rawInput.trim()
        if (question.length === 0) return { kind: 'error', text: 'usage: /research <question>' }
        agent.steer(createUserMessage({
          content: [{ type: 'text', text: researchPrompt(question) }],
          source: { kind: 'user' },
        }))
        return { kind: 'success', text: `Researching: ${question}` }
      },
    })
  })
}
