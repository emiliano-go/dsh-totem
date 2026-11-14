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
import { ReminderService, registerReminderTools } from './reminders.ts'
import { WatchService, registerWatchTools } from './watches.ts'
import { registerAssistantRoutes } from './routes.ts'
import { registerNotifyTool } from './notify.ts'
import { registerCiTools } from './ci.ts'
import { LayaEngine, registerLayaTool } from './laya.ts'
import { statePath } from './store.ts'
import { MEMORY_PROMPT } from './prompt.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'totem-memory': { kind: 'totem-memory' } & ContextFormed
    'laya-feedback': { kind: 'laya-feedback' } & ContextFormed
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
  /** Let the secondary model author memory prose. */
  distill: boolean
  /** Inject a recent-memory digest at the first step of a session. */
  digest: boolean
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
  /** Allow watches to fetch loopback/private addresses. */
  watchAllowPrivate: Volatile<boolean>
  /** Initial laya switch state when no saved state exists. */
  layaEnabled: boolean
  /** Laya HTTP base URL. */
  layaBaseUrl: string
  /** Command that starts the laya server. */
  layaServerCommand: string
  /** Whether this plugin owns the laya server process. */
  layaManageServer: boolean
  /** Laya pass threshold. */
  layaPassThreshold: Volatile<number>
  /** Feedback retries per turn. */
  layaMaxRetries: Volatile<number>
  /** Laya request timeout in milliseconds. */
  layaTimeoutMs: Volatile<number>
  /** Optional question-set override path. */
  layaQuestionsFile: Volatile<string>
  /** Display name of the loaded laya model. */
  layaModel: Volatile<string>
  /** Step-level checks: off, deterministic veto only, or full judge. */
  layaStepChecks: Volatile<'off' | 'veto' | 'full'>
  /** Step check cadence. */
  layaStepCadence: Volatile<'turn' | 'tool' | 'both'>
  /** Corrective feedback budget per turn. */
  layaStepMaxFeedback: Volatile<number>
  /** Optional project verify command run once per turn. */
  layaVerifyCommand: Volatile<string>
  /** External scanners: auto, on, or off. */
  layaVerifyExternal: Volatile<'auto' | 'on' | 'off'>
  /** Deterministic rules to disable. */
  layaVerifyDisable: Volatile<string[]>
}

/** Loader schema; every field is live so the Plugins page can edit it. */
export const Config: z<Config> = z.object({
  command: z.string().default('totem-mcp'),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  cwd: z.string(),
  provider: z.string().default('').volatile(),
  model: z.string().default('').volatile(),
  readRegister: z.boolean().default(true),
  autoRegister: z.boolean().default(true),
  distill: z.boolean().default(true),
  digest: z.boolean().default(true),
  maxTokens: z.number().step(1).min(64).default(512),
  maxInputBytes: z.number().step(1).min(1024).default(24000),
  timeoutMs: z.number().step(1).min(1000).default(15000),
  debug: z.boolean().default(false),
  userContext: z.boolean().default(true),
  distillTurn: z.boolean().default(true).volatile(),
  distillTurnMinChars: z.number().step(1).min(0).default(200).volatile(),
  apiToken: z.string().default('').volatile(),
  ntfyUrl: z.string().default('https://ntfy.sh').volatile(),
  ntfyTopic: z.string().default('').volatile(),
  ntfyToken: z.string().default('').volatile(),
  telegramBotToken: z.string().default('').volatile(),
  telegramChatId: z.string().default('').volatile(),
  watchAllowPrivate: z.boolean().default(false).volatile(),
  layaEnabled: z.boolean().default(false),
  layaBaseUrl: z.string().default('http://127.0.0.1:8765'),
  layaServerCommand: z.string().default('/home/eclipse/Documents/laya-ft/.venv/bin/python /home/eclipse/Documents/GitHub/safebox/encoder/script/laya-server.py --model /data/laya-ft/out-m5mem4-head --port 8765'),
  layaManageServer: z.boolean().default(true),
  layaPassThreshold: z.number().default(0.65).volatile(),
  layaMaxRetries: z.number().step(1).min(0).default(1).volatile(),
  layaTimeoutMs: z.number().step(1).min(1000).default(60000).volatile(),
  layaQuestionsFile: z.string().default('').volatile(),
  layaModel: z.string().default('/data/laya-ft/out-m5mem4-head').volatile(),
  layaStepChecks: z.union(['off', 'veto', 'full']).default('veto').volatile(),
  layaStepCadence: z.union(['turn', 'tool', 'both']).default('turn').volatile(),
  layaStepMaxFeedback: z.number().step(1).min(0).default(2).volatile(),
  layaVerifyCommand: z.string().default('').volatile(),
  layaVerifyExternal: z.union(['auto', 'on', 'off']).default('off').volatile(),
  layaVerifyDisable: z.array(String).default([]).volatile(),
})

function resolveConfig(config: Config): TotemConfig {
  return {
    command: config.command,
    args: [...config.args],
    env: { ...config.env },
    ...config.cwd === undefined || config.cwd.trim() === '' ? {} : { cwd: config.cwd },
    provider: config.provider,
    model: config.model,
    readRegister: config.readRegister,
    autoRegister: config.autoRegister,
    distill: config.distill,
    digest: config.digest,
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
    distillTurn: config.distillTurn,
    distillTurnMinChars: config.distillTurnMinChars,
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

function formatDigest(recent: unknown, tasks: unknown): string {
  const recentLines = asItems(recent).slice(0, 5).map(line).filter(Boolean)
  const taskLines = asItems(tasks).slice(0, 5).map(line).filter(Boolean)
  if (recentLines.length === 0 && taskLines.length === 0) return ''
  return [
    'Project memory (Totem) — treat as stale-prone and verify before relying on it.',
    ...recentLines.length === 0 ? [] : ['Recent:', ...recentLines],
    ...taskLines.length === 0 ? [] : ['In progress:', ...taskLines],
  ].join('\n')
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

  registerMemoryTools(ctx, totem)
  registerUserTools(ctx, totem)
  registerNotifyTool(ctx, totem)
  registerCiTools(ctx)
  const live = <T>(value: T): Volatile<T> => ({ get: () => value }) as unknown as Volatile<T>
  const laya = new LayaEngine(ctx, totem, {
    enabled: live(config.layaEnabled),
    baseUrl: live(config.layaBaseUrl),
    serverCommand: live(config.layaServerCommand),
    manageServer: live(config.layaManageServer),
    passThreshold: config.layaPassThreshold,
    maxRetries: config.layaMaxRetries,
    timeoutMs: config.layaTimeoutMs,
    questionsFile: config.layaQuestionsFile,
    model: config.layaModel,
    stepChecks: config.layaStepChecks,
    stepCadence: config.layaStepCadence,
    stepMaxFeedback: config.layaStepMaxFeedback,
    verifyCommand: config.layaVerifyCommand,
    verifyExternal: config.layaVerifyExternal,
    verifyDisable: config.layaVerifyDisable,
  }, statePath('laya.json'))
  registerLayaTool(ctx, laya)
  void laya.initialize()
  ctx.effect(() => () => { void laya.dispose() }, 'dsh-totem: laya server')
  ctx.effect(() => () => { void totem.dispose() }, 'dsh-totem: totem client')

  const candidates = new CandidateService(ctx, totem)
  const reminders = new ReminderService(ctx, totem)
  const watches = new WatchService(ctx, totem)
  registerReminderTools(ctx, reminders)
  registerWatchTools(ctx, watches)
  registerAssistantRoutes(ctx, { totem, reminders, watches, candidates, laya })
  ctx.effect(() => { reminders.start(); return () => { reminders.stop() } }, 'dsh-totem: reminders')
  ctx.effect(() => { watches.start(); return () => { watches.stop() } }, 'dsh-totem: watches')

  // Buffer each turn for candidate distillation and the Laya judge.
  interface TurnBuffer {
    turn: number
    lastChecked: number
    task: string
    texts: string[]
    tools: string[]
    toolCalls: { name: string; arguments: string }[]
    calls: Map<string, { name: string; arguments: string }>
    changes: { tool: string; path: string; input: string; output: string; diff?: string }[]
    grounding: { tool: string; input?: string; output: string }[]
    messageId?: string
  }
  const buffers = new WeakMap<object, TurnBuffer>()
  const bufferFor = (session: object): TurnBuffer => {
    let buffer = buffers.get(session)
    if (buffer === undefined) {
      buffer = { turn: 0, lastChecked: 0, task: '', texts: [], tools: [], toolCalls: [], calls: new Map(), changes: [], grounding: [] }
      buffers.set(session, buffer)
    }
    return buffer
  }
  const textOf = (blocks: unknown[]): string => blocks.flatMap((block) => {
    if (typeof block !== 'object' || block === null) return []
    const record = block as { type?: unknown; text?: unknown }
    return record.type === 'text' && typeof record.text === 'string' ? [record.text] : []
  }).join('\n')
  const snapshotOf = (buffer: TurnBuffer) => ({
    task: buffer.task,
    answer: buffer.texts.join('\n\n'),
    toolCalls: buffer.toolCalls,
    changes: buffer.changes,
    grounding: buffer.grounding,
    ...buffer.messageId === undefined ? {} : { messageId: buffer.messageId },
  })
  const MUTATING = new Set(['write', 'edit', 'apply_patch'])

  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/start') {
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
        buffer.toolCalls = []
        buffer.calls.clear()
        buffer.changes = []
        buffer.grounding = []
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
          buffer.toolCalls.push(call)
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
        buffer.toolCalls.push(call)
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
        buffer.grounding.push({ tool: call.name, input: call.arguments, output })
      }
    } else if (event.type === 'turn/end') {
      const buffer = buffers.get(session)
      buffers.delete(session)
      if (buffer === undefined) return
      const header = (session as { header?: { cwd?: string } }).header
      const id = (session as { id?: string }).id
      const turn = (event.data as { turn?: number }).turn
      if (id !== undefined && turn !== undefined) laya.clearTurn(id, turn)
      else if (id !== undefined) laya.clearTurn(id, buffer.turn)
      void candidates.distillTurn({
        project: header?.cwd ?? '',
        sessionId: id ?? '',
        text: buffer.texts.join('\n\n'),
        tools: buffer.tools,
      })
    }
  })

  ctx.on('agent/turn-stopping', async ({ agent, turn, signal }) => {
    const session = (agent as { session?: object }).session
    if (session === undefined) return
    const buffer = buffers.get(session)
    if (buffer === undefined) return
    await laya.onTurnStopping({
      agent: agent as never,
      turn,
      signal,
      snapshot: snapshotOf(buffer),
    })
  })

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
      const [owner, recent, tasks] = await Promise.all([
        config.userContext ? userContext(totem, deadline) : Promise.resolve(''),
        resolved.digest ? totem.call('memory_recent_tool', { limit: 5, project }, deadline) : Promise.resolve([]),
        resolved.digest ? totem.call('memory_tasks_tool', { limit: 10, project }, deadline) : Promise.resolve([]),
      ])
      const text = [owner, resolved.digest ? formatDigest(recent, tasks) : ''].filter(Boolean).join('\n\n')
      if (text === '') return decision
      if (session !== undefined) seen.add(session)
      const message = createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'totem-memory' },
      })
      return { ...decision, messages: [...decision.messages, message] }
    } catch {
      return decision
    }
  })

  ctx.on('agent/pre-step', async (request, next) => {
    const decision = await next()
    if (config.layaStepChecks === 'off' || request.step <= 1) return decision
    const session = (request.agent as { session?: { id?: string; header?: { cwd?: string } } }).session
    if (session === undefined) return decision
    const buffer = buffers.get(session)
    if (buffer === undefined) return decision
    const cadence = config.layaStepCadence
    if ((cadence === 'tool' || cadence === 'both') && buffer.changes.length === buffer.lastChecked) return decision
    buffer.lastChecked = buffer.changes.length
    const text = await laya.checkStep({
      snapshot: snapshotOf(buffer),
      agent: request.agent,
      signal: request.signal,
      key: `${session.id ?? ''}:${buffer.turn}`,
      project: session.header?.cwd,
    })
    if (text === undefined) return decision
    return {
      ...decision,
      messages: [...decision.messages, createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'laya-feedback' },
      })],
    }
  })
}
