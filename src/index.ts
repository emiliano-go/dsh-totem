/**
 * Totem persistent memory for DeepSeek Harness.
 *
 * Mounts a native `memory_*` tool surface, a memory workflow prompt section, a
 * first-step digest, and one stdio MCP connection to the Totem server. The
 * forked file tools register memories after each successful read/mutation and
 * take their prose from a separately configured model.
 *
 * @module dsh-totem
 */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import { TotemService, type TotemConfig } from './service.ts'
import { registerMemoryTools } from './tools.ts'
import { registerUserTools, userContext } from './user.ts'
import { CandidateService } from './candidates.ts'
import { clueSeeds, generateClues } from './clues.ts'
import { ReminderService, registerReminderTools } from './reminders.ts'
import { WatchService, registerWatchTools } from './watches.ts'
import { registerAssistantRoutes } from './routes.ts'
import { registerNotificationHooks, registerNotifyTool } from './notify.ts'
import { registerCiTools } from './ci.ts'
import { UnreadStore } from './unread.ts'
import { registerInterruptedTurnResume } from './resume.ts'
import { OverviewService } from './overview.ts'
import { statePath } from './store.ts'
import { MEMORY_PROMPT } from './prompt.ts'
import { CompactionMemory } from './compaction.ts'
import { registerTotemCommands } from './commands.ts'
import { registerWorkflowSkills } from './skills.ts'
import { registerRecallTool } from './recall.ts'
import { ConflictInbox } from './conflicts.ts'
import { VerifyLane, VerifyStore } from './verify-lane.ts'
import { RestartController } from './restart.ts'
import { budgetFor, clipToTokens } from './budget.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'totem-memory': { kind: 'totem-memory' } & ContextFormed
  }
}

/** Stable Cordis plugin name. */
export const name = 'totem'

/** Services required before tool, prompt, and digest registration. */
export const inject = ['tools', 'llm', 'systemPrompt', 'workingDirectory', 'agents']

/** Plugin configuration. */
export interface Config {
  /** Executable that serves the Totem MCP server over stdio. */
  command: string
  /** Arguments for {@link command}. */
  args: string[]
  /** Extra environment for the Totem child. */
  env: Record<string, string>
  /** Retrieval encoder: auto uses Model2Vec when installed, hash stays offline. */
  embeddingBackend: 'auto' | 'hash' | 'model2vec'
  /** Static retrieval model id or local directory. */
  embeddingModel: string
  /** Optional local model directory for offline installs. */
  embeddingLocal: string
  /** Working directory for the Totem child; omitted uses the Host directory. */
  cwd?: string
  /** Secondary model provider route; empty uses the deployment default model. */
  provider: Volatile<string>
  /** Secondary model id; empty uses the deployment default model. */
  model: Volatile<string>
  /** Register a memory after every successful file read. */
  readRegister: boolean
  /** Register a memory after every successful write, edit, or patch. */
  autoRegister: boolean
  /** Serve a fresh file TLDR instead of the full body on a whole-file read. */
  preferFileContext: boolean
  /** Let the secondary model author memory prose. */
  distill: boolean
  /** Inject a recent-memory digest at the first step of a session. */
  digest: boolean
  /** Token budget for the first-step digest. */
  digestTokens: number
  /** Token budget for the post-compaction recovery block. */
  recoveryTokens: number
  /** Secondary-model output cap. */
  maxTokens: number
  /** Input byte cap for one distillation call. */
  maxInputBytes: number
  /** Per-call Totem and distillation timeout. */
  timeoutMs: number
  /** Log memory registration failures. */
  debug: boolean
  /** Inject the owner's global preferences at the first step. */
  userContext: boolean
  /** Distill each completed turn into memory candidates. */
  distillTurn: Volatile<boolean>
  /** Minimum assistant text length for turn distillation. */
  distillTurnMinChars: Volatile<number>
  /** Bearer token for the assistant HTTP routes. */
  apiToken: Volatile<string>
  /** ntfy base URL. */
  ntfyUrl: Volatile<string>
  /** ntfy topic; empty disables ntfy. */
  ntfyTopic: Volatile<string>
  /** Optional ntfy bearer token. */
  ntfyToken: Volatile<string>
  /** Telegram bot token. */
  telegramBotToken: Volatile<string>
  /** Telegram chat id. */
  telegramChatId: Volatile<string>
  /** Send a push notification when a turn finishes. */
  notifyTurnEnd: Volatile<boolean>
  /** Send a push notification when a tool approval is requested. */
  notifyApproval: Volatile<boolean>
  /** Allow watches to fetch loopback/private addresses. */
  watchAllowPrivate: Volatile<boolean>
  /** Directory for TrustSight triage artifacts; empty uses `<session cwd>/alert-triage`. */
  triageDir: string
  /** TrustSight watcher feed base URL; empty uses `WATCHER_FEED_URL` or the public feed. */
  triageFeedUrl: string
  /** Default lookback in days for `/triage` when the ledger has no entries. */
  triageWindowDays: number
  /** Maximum alerts queued per `/triage` run; `0` queues every untriaged alert. */
  triageBatch: number
  /** Deterministic verify command run once per turn; empty disables the command. */
  verifyCommand: Volatile<string>
  /** Deterministic verify rule ids to skip. */
  verifyDisable: Volatile<string[]>
  /** Launcher that restarts the host process; resolved against PATH. */
  restartCommand: Volatile<string>
  /** Local quiet window for silent reminders, e.g. "22:00-08:00"; empty disables it. */
  quietHours: Volatile<string>
  /** Continue turns that a Host restart cut in half. */
  resumeInterrupted: Volatile<boolean>
  /** Only Sessions active within this many minutes are considered. */
  resumeWindowMinutes: number
  /** Maximum Sessions resumed per boot. */
  resumeMaxSessions: number
  /** Maximum auto-resume attempts per Session per cooldown window. */
  resumeMaxAttempts: number
  /** Cooldown over which resume attempts are counted. */
  resumeCooldownMinutes: number
}

/** Loader schema; every field is live so the Plugins page can edit it. */
export const Config: z<Config> = z.object({
  command: z.string().default('totem-mcp'),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  embeddingBackend: z.union(['auto', 'hash', 'model2vec']).default('auto').volatile(),
  embeddingModel: z.string().default('minishlab/potion-retrieval-32M'),
  embeddingLocal: z.string().default(''),
  cwd: z.string(),
  provider: z.string().default('').volatile(),
  model: z.string().default('').volatile(),
  readRegister: z.boolean().default(true),
  autoRegister: z.boolean().default(true),
  preferFileContext: z.boolean().default(true),
  distill: z.boolean().default(true),
  digest: z.boolean().default(true),
  digestTokens: z.number().step(1).min(0).default(400),
  recoveryTokens: z.number().step(1).min(0).default(600),
  maxTokens: z.number().step(1).min(64).default(512),
  maxInputBytes: z.number().step(1).min(1024).default(24000),
  timeoutMs: z.number().step(1).min(1000).default(15000),
  debug: z.boolean().default(false),
  userContext: z.boolean().default(true),
  distillTurn: z.boolean().default(true).volatile(),
  distillTurnMinChars: z.number().step(1).min(0).default(200).volatile(),
  coverage: z.boolean().default(true).volatile(),
  clues: z.boolean().default(false).volatile(),
  apiToken: z.string().default('').volatile(),
  ntfyUrl: z.string().default('https://ntfy.sh').volatile(),
  ntfyTopic: z.string().default('').volatile(),
  ntfyToken: z.string().default('').volatile(),
  telegramBotToken: z.string().default('').volatile(),
  telegramChatId: z.string().default('').volatile(),
  notifyTurnEnd: z.boolean().default(true).volatile(),
  notifyApproval: z.boolean().default(true).volatile(),
  watchAllowPrivate: z.boolean().default(false).volatile(),
  triageDir: z.string().default(''),
  triageFeedUrl: z.string().default(''),
  triageWindowDays: z.number().step(1).min(1).default(7),
  triageBatch: z.number().step(1).min(0).default(20),
  verifyCommand: z.string().default('').volatile(),
  verifyDisable: z.array(String).default([]).volatile(),
  restartCommand: z.string().default('dsh-totem').volatile(),
  quietHours: z.string().default('22:00-08:00').volatile(),
  resumeInterrupted: z.boolean().default(true).volatile(),
  resumeWindowMinutes: z.number().step(1).min(1).default(30),
  resumeMaxSessions: z.number().step(1).min(1).default(3),
  resumeMaxAttempts: z.number().step(1).min(1).default(3),
  resumeCooldownMinutes: z.number().step(1).min(1).default(30),
})

export function resolveConfig(config: Config): TotemConfig {
  const embeddingEnv: Record<string, string> = {}
  if (!config.env.TOTEM_EMBEDDING_BACKEND) {
    embeddingEnv.TOTEM_EMBEDDING_BACKEND = config.embeddingBackend
  }
  if (!config.env.TOTEM_EMBEDDING_MODEL) {
    embeddingEnv.TOTEM_EMBEDDING_MODEL = config.embeddingModel
  }
  if (!config.env.TOTEM_EMBEDDING_LOCAL && config.embeddingLocal) {
    embeddingEnv.TOTEM_EMBEDDING_LOCAL = config.embeddingLocal
  }
  return {
    command: config.command,
    args: [...config.args],
    // Explicit environment entries win over the structured fields.
    env: { ...embeddingEnv, ...config.env },
    ...config.cwd === undefined || config.cwd.trim() === '' ? {} : { cwd: config.cwd },
    provider: config.provider,
    model: config.model,
    readRegister: config.readRegister,
    autoRegister: config.autoRegister,
    preferFileContext: config.preferFileContext,
    distill: config.distill,
    digest: config.digest,
    digestTokens: config.digestTokens,
    recoveryTokens: config.recoveryTokens,
    maxTokens: config.maxTokens,
    maxInputBytes: config.maxInputBytes,
    timeoutMs: config.timeoutMs,
    debug: config.debug,
    apiToken: config.apiToken,
    ntfyUrl: config.ntfyUrl,
    ntfyTopic: config.ntfyTopic,
    ntfyToken: config.ntfyToken,
    telegramBotToken: config.telegramBotToken,
    telegramChatId: config.telegramChatId,
    notifyTurnEnd: config.notifyTurnEnd,
    notifyApproval: config.notifyApproval,
    restartCommand: config.restartCommand,
    quietHours: config.quietHours,
    distillTurn: config.distillTurn,
    distillTurnMinChars: config.distillTurnMinChars,
    coverage: config.coverage,
    clues: config.clues,
    watchAllowPrivate: config.watchAllowPrivate,
  }
}

function asItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  if (typeof value === 'object' && value !== null) {
    const items = (value as { items?: unknown }).items
    if (Array.isArray(items)) return items.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  }
  return []
}

function line(item: Record<string, unknown>): string {
  const type = typeof item.type === 'string' ? `[${item.type}] ` : ''
  const title = typeof item.title === 'string' ? item.title : ''
  const statement = typeof item.statement === 'string' ? item.statement : ''
  const text = [title, statement].filter(Boolean).join(': ')
  return `- ${type}${text}`.slice(0, 320)
}

function isFileState(item: Record<string, unknown>): boolean {
  const metadata = item.metadata
  if (typeof metadata === 'object' && metadata !== null
    && (metadata as { fileKind?: unknown }).fileKind === 'file_tldr') return true
  return item.type === 'implementation'
    && typeof item.title === 'string'
    && item.title.startsWith('File:')
}

export function formatDigest(recent: unknown, tasks: unknown, maxTokens = 400): string {
  const recentItems = asItems(recent)
    .filter(item => !isFileState(item))
    .sort((a, b) => Number(b.importance ?? 0) - Number(a.importance ?? 0))
  const recentLines = recentItems.slice(0, 5).map(line).filter(Boolean)
  const taskLines = asItems(tasks).slice(0, 5).map(line).filter(Boolean)
  if (recentLines.length === 0 && taskLines.length === 0) return ''
  const text = [
    'Project memory (Totem) — treat as stale-prone and verify before relying on it.',
    ...recentLines.length === 0 ? [] : ['Recent:', ...recentLines],
    ...taskLines.length === 0 ? [] : ['In progress:', ...taskLines],
  ].join('\n')
  return maxTokens > 0 ? clipToTokens(text, maxTokens) : text
}

/** Last human task text in a request, ignoring injected memory blocks. */
export function lastUserTask(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (typeof message !== 'object' || message === null) continue
    const record = message as { role?: unknown; content?: unknown; source?: { kind?: unknown } }
    if (record.role !== 'user') continue
    if (record.source?.kind === 'totem-memory') continue
    if (!Array.isArray(record.content)) continue
    const text = record.content.flatMap((block) => {
      if (typeof block !== 'object' || block === null) return []
      const value = block as { type?: unknown; text?: unknown }
      return value.type === 'text' && typeof value.text === 'string' ? [value.text] : []
    }).join('\n').trim()
    if (text.length > 0) return text
  }
  return ''
}

/**
 * Register the Totem service, tools, prompt section, and first-step digest.
 * @param ctx - plugin context with tools, llm, prompt, working directory, and agents.
 * @param config - validated plugin configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const totem = new TotemService(ctx, resolved)

  ctx.systemPrompt.section({
    name: 'totem:workflow',
    order: ctx.systemPrompt.getSectionOrder('TOOL_WORKFLOW'),
    text: MEMORY_PROMPT,
  })

  const conflicts = new ConflictInbox()
  // Sessions with a turn in flight; a deferred restart waits for this to empty.
  const running = new Set<string>()
  const restarter = new RestartController({
    launcher: () => totem.config.restartCommand.get(),
    busy: () => running.size > 0,
  })

  // The turn boundary is the safe moment to relaunch: the buffer has been
  // reported and the session events are written. `turn-stopping` also fires
  // for aborted and failed turns, so a dead turn cannot pin the busy flag.
  ctx.on('agent/turn-stopping', ({ agent }) => {
    const id = (agent as { session?: { id?: string } }).session?.id
    if (id !== undefined) running.delete(id)
    restarter.tick()
  })

  registerMemoryTools(ctx, totem, { conflicts })
  registerUserTools(ctx, totem)
  registerNotifyTool(ctx, totem)
  registerNotificationHooks(ctx, totem)
  registerCiTools(ctx)
  registerRecallTool(ctx, totem)
  registerTotemCommands(ctx, totem, {
    triage: {
      dir: config.triageDir,
      feedUrl: config.triageFeedUrl,
      windowDays: config.triageWindowDays,
      batch: config.triageBatch,
    },
    restart: () => {
      const plan = restarter.schedule({ idle: true })
      return { launcher: plan.launcher, mode: plan.mode }
    },
  })
  registerWorkflowSkills(ctx, totem)
  const compaction = new CompactionMemory(totem)
  ctx.effect(() => () => { void totem.dispose() }, 'dsh-totem: totem client')

  const candidates = new CandidateService(ctx, totem)
  const reminders = new ReminderService(ctx, totem)
  const watches = new WatchService(ctx, totem)
  registerReminderTools(ctx, reminders)
  registerWatchTools(ctx, watches)
  const overview = new OverviewService(statePath('usage.jsonl'))
  void overview.ensure()
  // Deterministic verification: the rules that used to run inside the judge,
  // now wired to the turn itself. Advisory only.
  const verifyLane = new VerifyLane({
    command: config.verifyCommand,
    disable: config.verifyDisable,
  })
  const verifyStore = new VerifyStore()
  // Shared across browser profiles and devices; the client keeps a local
  // mirror for reloads and reconciles against this on load/focus/poll.
  const unread = new UnreadStore()

  registerAssistantRoutes(ctx, {
    totem,
    reminders,
    watches,
    candidates,
    unread,
    verifyLane,
    verify: verifyStore,
    overview,
    conflicts,
    restart: restarter,
  })
  registerInterruptedTurnResume(ctx, {
    enabled: config.resumeInterrupted,
    windowMinutes: config.resumeWindowMinutes,
    maxSessions: config.resumeMaxSessions,
    maxAttempts: config.resumeMaxAttempts,
    cooldownMinutes: config.resumeCooldownMinutes,
  })
  ctx.effect(() => { reminders.start(); return () => { reminders.stop() } }, 'dsh-totem: reminders')
  ctx.effect(() => { watches.start(); return () => { watches.stop() } }, 'dsh-totem: watches')


  // Buffer each turn for candidate distillation and durable session summaries.
  interface TurnBuffer {
    turn: number
    task: string
    texts: string[]
    tools: string[]
    calls: Map<string, { name: string; arguments: string }>
    changes: { tool: string; path: string; input: string; output: string; diff?: string }[]
    checks: { command: string; cwd?: string; exitCode: number; output: string }[]
    messageId?: string
  }
  const buffers = new WeakMap<object, TurnBuffer>()
  const bufferFor = (session: object): TurnBuffer => {
    let buffer = buffers.get(session)
    if (buffer === undefined) {
      buffer = { turn: 0, task: '', texts: [], tools: [], calls: new Map(), changes: [], checks: [] }
      buffers.set(session, buffer)
    }
    return buffer
  }
  const textOf = (blocks: unknown[]): string => blocks.flatMap((block) => {
    if (typeof block !== 'object' || block === null) return []
    const record = block as { type?: unknown; text?: unknown }
    return record.type === 'text' && typeof record.text === 'string' ? [record.text] : []
  }).join('\n')
  const MUTATING = new Set(['write', 'edit', 'apply_patch'])

  ctx.on('session/event', (session, event) => {
    // Usage accounting runs for every event; it dedupes by session/seq.
    overview.record((session as { id?: string }).id ?? '', event as { type?: string; seq?: number; time?: number; data?: unknown })
    const eventSessionId = (session as { id?: string }).id ?? ''
    if (compaction.note(eventSessionId, event as { type?: string; data?: unknown })) {
      // The summary is about to be written by the compaction backend, which
      // keeps only what its own summarizer considered important. Persist this
      // session's work first so the durable record does not depend on it.
      const buffer = buffers.get(session)
      if (buffer !== undefined) {
        const header = (session as { header?: { cwd?: string } }).header
        void totem.recordSessionSummary({
          project: header?.cwd ?? '',
          sessionId: eventSessionId,
          text: buffer.texts.join('\n\n'),
          changes: buffer.changes.map(change => ({ path: change.path, tool: change.tool })),
          checks: buffer.checks,
        })
      }
    }
    if (event.type === 'turn/start') {
      running.add(eventSessionId)
      const buffer = bufferFor(session)
      buffer.turn = (event.data as { turn?: number }).turn ?? 0
      buffer.messageId = undefined
    } else if (event.type === 'user/message') {
      const data = event.data as { message?: { content?: unknown[]; source?: { kind?: string } }; content?: unknown[]; source?: { kind?: string } }
      const message = data.message ?? data
      if (message.source?.kind === 'user') {
        const buffer = bufferFor(session)
        buffer.task = textOf(Array.isArray(message.content) ? message.content : [])
        buffer.texts = []
        buffer.tools = []
        buffer.calls.clear()
        buffer.changes = []
        buffer.checks = []
      }
    } else if (event.type === 'assistant/message') {
      const message = (event.data as { message?: { id?: string; content?: unknown[] } }).message
      const blocks = Array.isArray(message?.content) ? message.content : []
      const buffer = bufferFor(session)
      if (typeof message?.id === 'string') buffer.messageId = message.id
      const text = textOf(blocks)
      if (text.trim().length > 0) buffer.texts.push(text)
      for (const block of blocks) {
        if (typeof block !== 'object' || block === null) continue
        const record = block as { type?: unknown; id?: unknown; name?: unknown; arguments?: unknown }
        if (record.type === 'tool-call' && typeof record.name === 'string' && typeof record.id === 'string') {
          const call = { name: record.name, arguments: typeof record.arguments === 'string' ? record.arguments : '' }
          buffer.tools.push(call.name)
          buffer.calls.set(record.id, call)
        }
      }
    } else if (event.type === 'tool/call') {
      const data = event.data as { callId?: unknown; name?: unknown; arguments?: unknown }
      if (typeof data.callId === 'string' && typeof data.name === 'string') {
        const buffer = bufferFor(session)
        const call = { name: data.name, arguments: typeof data.arguments === 'string' ? data.arguments : '' }
        buffer.tools.push(call.name)
        buffer.calls.set(data.callId, call)
      }
    } else if (event.type === 'tool/result') {
      const data = event.data as { toolCallId?: unknown; message?: { content?: unknown[] }; meta?: unknown }
      const call = typeof data.toolCallId === 'string' ? bufferFor(session).calls.get(data.toolCallId) : undefined
      if (call === undefined) return
      const buffer = bufferFor(session)
      const output = textOf(Array.isArray(data.message?.content) ? data.message.content : [])
      if (MUTATING.has(call.name)) {
        let path = ''
        try {
          const args = JSON.parse(call.arguments) as { file_path?: unknown; filePath?: unknown; path?: unknown }
          path = typeof args.file_path === 'string' ? args.file_path
            : typeof args.filePath === 'string' ? args.filePath
              : typeof args.path === 'string' ? args.path : ''
        } catch {}
        const meta = data.meta as { diffs?: unknown } | undefined
        buffer.changes.push({
          tool: call.name,
          path,
          input: call.arguments,
          output,
          ...meta?.diffs === undefined ? {} : { diff: JSON.stringify(meta.diffs) },
        })
      } else if (['read', 'grep', 'glob', 'bash'].includes(call.name)) {
        if (call.name === 'bash') {
          const meta = data.meta as { exitCode?: unknown; cwd?: unknown } | undefined
          if (typeof meta?.exitCode === 'number') {
            try {
              const args = JSON.parse(call.arguments) as { command?: unknown; workdir?: unknown }
              const command = typeof args.command === 'string' ? args.command : ''
              if (/\b(test|pytest|bun test|cargo test|go test|npm test|pnpm test|just test|lint|typecheck|build)\b/i.test(command)) {
                buffer.checks.push({
                  command: command.slice(0, 1000),
                  ...typeof args.workdir === 'string' ? { cwd: args.workdir } : {},
                  exitCode: meta.exitCode,
                  output,
                })
              }
            } catch {}
          }
        }
      }
    } else if (event.type === 'turn/end') {
      running.delete(eventSessionId)
      restarter.tick()
      const buffer = buffers.get(session)
      buffers.delete(session)
      if (buffer === undefined) return
      const header = (session as { header?: { cwd?: string } }).header
      const id = (session as { id?: string }).id
      const turn = (event.data as { turn?: number }).turn
      void candidates.distillTurn({
        project: header?.cwd ?? '',
        sessionId: id ?? '',
        text: buffer.texts.join('\n\n'),
        tools: buffer.tools,
        turn: turn ?? buffer.turn,
        changes: buffer.changes.map(change => ({ path: change.path, tool: change.tool })),
      })
      void totem.recordSessionSummary({
        project: header?.cwd ?? '',
        sessionId: id ?? '',
        text: buffer.texts.join('\n\n'),
        changes: buffer.changes.map(change => ({ path: change.path, tool: change.tool })),
        checks: buffer.checks,
      })
    }
  })

  // Advisory verification at turn end. Never blocks, never retries, never
  // rewrites the turn: the findings are only stored for the in-chat card.
  ctx.on('agent/turn-stopping', async ({ agent, turn }) => {
    const session = (agent as { session?: object }).session
    if (session === undefined) return
    const buffer = buffers.get(session)
    if (buffer === undefined) return
    const header = (session as { header?: { cwd?: string } }).header
    try {
      verifyStore.add(await verifyLane.run({
        session: (session as { id?: string }).id ?? '',
        turn,
        changes: buffer.changes,
        checks: buffer.checks,
        answer: buffer.texts.join('\n\n'),
        ...header?.cwd === undefined ? {} : { project: header.cwd },
      }))
    } catch {
      // A rule that throws must not break the turn; the lane is advisory.
    }
  })

  // Context pressure, when a token meter is mounted, shrinks the injected
  // blocks before they compete with the work they are meant to support.
  const pressureOf = (session: unknown): number | undefined => {
    try {
      const meter = ctx.get('tokenMeter') as
        { contextPressure?: (s: unknown) => { pressureTokens?: number; contextWindow?: number } } | undefined
      const reading = meter?.contextPressure?.(session)
      const used = reading?.pressureTokens
      const window = reading?.contextWindow
      if (typeof used !== 'number' || typeof window !== 'number' || window <= 0) return undefined
      return used / window
    } catch {
      return undefined
    }
  }

  const seen = new WeakSet<object>()
  ctx.on('agent/pre-step', async (request, next) => {
    const decision = await next()
    if (request.step !== 1 || (!resolved.digest && !config.userContext)) return decision
    // An empty first entry owns a no-step turn; keep context for the next step.
    if (decision.kind === 'reject' || decision.messages.length === 0) return decision
    const session = (request.agent as { session?: object }).session
    if (session !== undefined && seen.has(session)) return decision
    try {
      const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(4000)])
      const project = await totem.projectFor(request.agent, deadline)
      const taskText = lastUserTask(request.messages)
      let seeds: string[] = []
      if (resolved.clues && taskText.length > 0) {
        const target = totem.target()
        if (target !== undefined) {
          const clues = await generateClues(
            ctx, target, taskText,
            AbortSignal.any([deadline, AbortSignal.timeout(2500)]),
            session === undefined ? undefined : (session as { id?: string }).id,
          )
          if (clues.length > 0) {
            seeds = await clueSeeds(totem, project, clues, deadline)
          }
        }
      }
      const digestTokens = budgetFor(
        session === undefined ? undefined : pressureOf(session),
        resolved.digestTokens,
      )
      const [owner, recent, tasks, contextResult] = await Promise.all([
        config.userContext ? userContext(totem, deadline) : Promise.resolve(''),
        resolved.digest ? totem.call('memory_list_tool', { sort: 'updated_at', limit: 20, project }, deadline) : Promise.resolve([]),
        resolved.digest ? totem.call('memory_tasks_tool', { limit: 10, project }, deadline) : Promise.resolve([]),
        resolved.digest && taskText.length > 0
          ? totem.call('engineering_context_tool', {
            tags: [],
            task: taskText,
            token_budget: digestTokens,
            max_item_chars: 240,
            include_stale: false,
            ...seeds.length === 0 ? {} : { seed_ids: seeds },
            project,
          }, deadline)
          : Promise.resolve(undefined),
      ])
      const context = contextResult as { context?: unknown; selectedIds?: unknown } | undefined
      const contextText = typeof context?.context === 'string' && context.context.length > 0
        ? context.context
        : ''
      const fallback = resolved.digest ? formatDigest(recent, tasks, digestTokens) : ''
      const text = [
        owner,
        contextText.length > 0
          ? `Project memory (Totem) — treat as stale-prone and verify before relying on it.\n${contextText}`
          : fallback,
      ].filter(Boolean).join('\n\n')
      if (text === '') return decision
      if (session !== undefined) seen.add(session)
      if (contextText.length > 0 && Array.isArray(context?.selectedIds)) {
        void totem.call('memory_touch_tool', {
          ids: context.selectedIds.filter((id): id is string => typeof id === 'string'),
          project,
        }, deadline).catch(() => {})
      }
      const message = createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'totem-memory' },
      })
      return { ...decision, messages: [...decision.messages, message] }
    } catch {
      return decision
    }
  })

  // Restore durable memory after a compaction. This runs at the first step that
  // follows the marker, whichever step number that happens to be; the digest
  // hook above only owns the session's first step.
  ctx.on('agent/pre-step', async (request, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || !resolved.digest) return decision
    const session = (request.agent as { session?: { id?: string } }).session
    const sessionId = session?.id ?? ''
    if (sessionId.length === 0 || !compaction.needsRecovery(sessionId)) return decision
    const recoveryTokens = budgetFor(pressureOf(session), resolved.recoveryTokens)
    const text = await compaction.take(request.agent, sessionId, request.signal, recoveryTokens)
    if (text.length === 0) return decision
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'totem-memory' },
    })
    return { ...decision, messages: [...decision.messages, message] }
  })

  // A delegated agent may run in a worktree or a scratch directory. Without a
  // pinned project it would write into a second, near-empty store and the
  // parent session would never observe what the child learned.
  ctx.on('subagent/start', (info) => {
    const childId = String(info.id)
    void (async () => {
      const child = ctx.agents.get(info.id) as
        { session?: { header?: { parentSession?: string } } } | undefined
      const parentSession = child?.session?.header?.parentSession
      if (parentSession === undefined || parentSession.length === 0) return
      const parent = ctx.agents.get(parentSession) as unknown
      const project = parent !== undefined
        ? await totem.projectFor(parent)
        : totem.projectOf(parentSession)
      if (project !== undefined && project.length > 0) totem.overrideProject(childId, project)
    })().catch(() => {})
  })

  ctx.on('session/disposed', (session) => {
    const id = (session as { id?: string }).id ?? ''
    if (id.length === 0) return
    compaction.clear(id)
    totem.clearProject(id)
  })
}
