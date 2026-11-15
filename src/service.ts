/**
 * Totem service: one lazy stdio MCP connection to the Totem server, file-touch
 * memory registration, and the secondary-model distillation route.
 *
 * @module dsh-totem/service
 */
import { basename, isAbsolute, join, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { statePath } from './store.ts'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { distillAuthored, distillMemory, distillSession, type DistillTarget, type MemoryDraft } from './distill.ts'

/** Resolved plugin configuration shared by every entry point. */
export interface TotemConfig {
  /** Executable that speaks MCP over stdio (the Totem server). */
  command: string
  /** Arguments passed to {@link command}. */
  args: string[]
  /** Extra environment for the Totem child process. */
  env: Record<string, string>
  /** Working directory for the Totem child; omitted uses the Host directory. */
  cwd?: string
  /** Secondary model provider route; empty uses the deployment default. */
  provider: Volatile<string>
  /** Secondary model id; empty uses the deployment default. */
  model: Volatile<string>
  /** Register memories after successful file reads. */
  readRegister: boolean
  /** Register memories after successful file writes/edits/patches. */
  autoRegister: boolean
  /** Serve a fresh file TLDR instead of the full body on a whole-file read. */
  preferFileContext: boolean
  /** Let the secondary model author memory prose. */
  distill: boolean
  /** Inject a recent-memory digest at the first step of a session. */
  digest: boolean
  /** Secondary-model output cap. */
  maxTokens: number
  /** Input byte cap for one distillation call. */
  maxInputBytes: number
  /** Per-call MCP and distillation timeout. */
  timeoutMs: number
  /** Log registration failures to the Host console. */
  debug: boolean
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
  /** Distill a turn into memory candidates at turn end. */
  distillTurn: Volatile<boolean>
  /** Minimum assistant text length for turn distillation. */
  distillTurnMinChars: Volatile<number>
  /** Check and update the Totem extraction coverage ledger. */
  coverage: Volatile<boolean>
  /** Expand multi-hop recall with model-generated clue queries. */
  clues: Volatile<boolean>
  /** Allow watches to fetch loopback/private addresses. */
  watchAllowPrivate: Volatile<boolean>
}

/** One observed file touch from a forked file tool. */
export interface FileTouch {
  agent?: unknown
  path: string
  tool: 'read' | 'write' | 'edit' | 'apply_patch'
  action: 'read' | 'write' | 'edit' | 'patch'
  symbol?: string
  before?: string | null
  after?: string | null
  startLine?: number
  endLine?: number
  signal?: AbortSignal
}

/** One cached file-state TLDR returned before a full read. */
export interface CachedFileContext {
  id: string
  path: string
  title?: string
  tldr: string
  language?: string
  lineCount?: number
  byteCount?: number
  symbols?: { name: string; kind: string; signature?: string; detail?: string }[]
  blobHash: string
  fresh: true
  changed?: boolean
  created?: boolean
  updatedAt?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    totem: TotemService
  }
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string')
    .map(block => block.text)
    .join('')
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

/**
 * Owns the Totem connection and memory registration for one Host.
 *
 * Constructing the service registers it as `ctx.totem`; the client connects on
 * the first operation so boot never depends on the Totem server being up.
 */
export class TotemService extends Service {
  private client: Client | undefined
  private connecting: Promise<Client> | undefined
  private readonly initialized = new Set<string>()
  /** Resolved project per session, so a subagent can inherit its parent's. */
  private readonly projects = new Map<string, string>()
  /** Explicit project per child session, set when a delegation is published. */
  private readonly overrides = new Map<string, string>()
  private lastProjectPath = ''

  constructor(ctx: Context, readonly config: TotemConfig) {
    super(ctx, 'totem')
  }

  /** Resolve the secondary-model route, falling back to the deployment default. */
  target(): DistillTarget | undefined {
    if (!this.config.distill) return undefined
    // Each field falls back independently, so setting only `model` pins a cheap
    // memory model on the same provider as the deployment default (Hestia's
    // `small_model` behavior).
    const fallback = (this.ctx.get('agentDefaultModel') as { currentSelection?: () => { provider: string; model: string } } | undefined)
      ?.currentSelection?.()
    const provider = this.config.provider.get().trim() || fallback?.provider
    const model = this.config.model.get().trim() || fallback?.model
    if (provider === undefined || model === undefined) return undefined
    return {
      provider,
      model,
      maxTokens: this.config.maxTokens,
      maxInputBytes: this.config.maxInputBytes,
      timeoutMs: this.config.timeoutMs,
    }
  }

  /** Close the Totem MCP child so headless hosts can exit. */
  async dispose(): Promise<void> {
    const client = this.client
    this.client = undefined
    if (client !== undefined) await client.close().catch(() => {})
  }

  /** Most recently resolved session project, for the assistant routes. */
  get lastProject(): string {
    return this.lastProjectPath
  }

  /** Project already resolved for one session, if any. */
  projectOf(sessionId: string): string | undefined {
    return this.projects.get(sessionId) ?? this.overrides.get(sessionId)
  }

  /**
   * Pin one child session to a project.
   *
   * A delegated agent that works in a worktree or a temporary directory would
   * otherwise write its memories into a second, near-empty store and the parent
   * session would never see what the child learned.
   */
  overrideProject(sessionId: string, project: string): void {
    if (sessionId.length === 0 || project.length === 0) return
    this.overrides.set(sessionId, project)
  }

  /** Drop a session's project state when it can no longer run. */
  clearProject(sessionId: string): void {
    this.projects.delete(sessionId)
    this.overrides.delete(sessionId)
  }

  /** Stable pseudo-project whose `.totem/totem.db` is the global user memory DB. */
  async userProject(): Promise<string> {
    const dir = statePath('user')
    const dbDir = join(dir, '.totem')
    await mkdir(dbDir, { recursive: true })
    const link = join(dbDir, 'totem.db')
    if (!existsSync(link)) {
      const target = process.env.TOTEM_USER_DB
        ?? join(homedir(), '.local', 'share', 'totem', 'totem.db')
      await mkdir(join(target, '..'), { recursive: true })
      await symlink(target, link).catch(() => {})
    }
    return dir
  }

  /** Resolve the project root Totem should use for a tool execution. */
  async projectFor(agent: unknown, signal?: AbortSignal): Promise<string> {
    const sessionId = (agent as { session?: { id?: string } } | undefined)?.session?.id ?? ''
    const pinned = sessionId.length > 0 ? this.overrides.get(sessionId) : undefined
    const project = pinned ?? (agent === undefined
      ? process.cwd()
      : await this.ctx.workingDirectory.ensure(agent, signal).catch(() => process.cwd()))
    await this.ensureProject(project, signal)
    this.lastProjectPath = project
    if (sessionId.length > 0) this.projects.set(sessionId, project)
    return project
  }

  /** First-use project setup; Totem needs `.totem` before any read/write registration. */
  private async ensureProject(project: string, signal?: AbortSignal): Promise<void> {
    if (this.initialized.has(project)) return
    try {
      await this.invoke('totem_init_tool', { project }, signal)
      this.initialized.add(project)
    } catch {
      // A missing server surfaces on the real operation; retry init next time.
    }
  }

  private async ensureClient(): Promise<Client> {
    if (this.client !== undefined) return this.client
    if (this.connecting === undefined) {
      this.connecting = (async () => {
        const transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args,
          env: { ...process.env, ...this.config.env } as Record<string, string>,
          ...this.config.cwd === undefined ? {} : { cwd: this.config.cwd },
        })
        const client = new Client(
          { name: 'dsh-totem', version: '0.1.0' },
          { capabilities: {}, versionNegotiation: { mode: 'auto' } },
        )
        client.onclose = () => {
          this.client = undefined
        }
        await client.connect(transport)
        this.client = client
        return client
      })().finally(() => {
        this.connecting = undefined
      })
    }
    return this.connecting
  }

  /** Call one Totem MCP tool, initializing the project DB on first use. */
  async call(name: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<unknown> {
    const project = typeof args.project === 'string' ? args.project : undefined
    if (project !== undefined && name !== 'totem_init_tool') await this.ensureProject(project, signal)
    return this.invoke(name, args, signal)
  }

  /** Invoke one Totem tool without project initialization. */
  private async invoke(name: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<unknown> {
    const client = await this.ensureClient()
    const deadline = AbortSignal.timeout(this.config.timeoutMs)
    const combined = signal === undefined ? deadline : AbortSignal.any([signal, deadline])
    const result = await client.callTool(
      { name, arguments: args },
      { signal: combined, timeout: this.config.timeoutMs },
    )
    if (result.isError === true) {
      throw new Error(extractText(result.content) || `totem: ${name} failed`)
    }
    const text = extractText(result.content)
    if (text.length > 0) {
      // Totem MCP tools catch logical failures and return them as plain text
      // with isError=false; surface them instead of treating them as a value.
      if (text.startsWith('Error:')) throw new Error(text.replace(/^Error:\s*/, ''))
      return safeJson(text)
    }
    return result.structuredContent ?? null
  }

  private warn(where: string, error: unknown): void {
    if (!this.config.debug) return
    console.warn(`[dsh-totem] ${where}:`, error instanceof Error ? error.message : error)
  }

  /** One cached file TLDR for a whole-file read, or undefined when unavailable. */
  async cachedRead(input: {
    path: string
    agent?: unknown
    signal?: AbortSignal
  }): Promise<CachedFileContext | undefined> {
    if (!this.config.preferFileContext) return undefined
    try {
      const project = await this.projectFor(input.agent, input.signal)
      const result = await this.call('memory_file_context_tool', {
        path: input.path,
        refresh: false,
        project,
      }, input.signal)
      if (typeof result !== 'object' || result === null) return undefined
      const context = result as CachedFileContext
      return context.fresh === true ? context : undefined
    } catch (error) {
      this.warn('cachedRead', error)
      return undefined
    }
  }

  /**
   * Record a successful file read. Deterministic and cheap: no model call.
   */
  async recordRead(touch: FileTouch): Promise<void> {
    if (!this.config.autoRegister || !this.config.readRegister) return
    try {
      const project = await this.projectFor(touch.agent, touch.signal)
      await this.call('memory_file_context_tool', withoutUndefined({
        path: touch.path,
        reason: 'read',
        tags: ['read'],
        project,
      }), touch.signal)
    } catch (error) {
      this.warn('recordRead', error)
    }
  }

  /** Draft fields for one file touch, authored by the secondary model when enabled. */
  private async draft(touch: FileTouch): Promise<MemoryDraft | undefined> {
    const target = this.target()
    if (target === undefined) return undefined
    return distillMemory(this.ctx, target, {
      tool: touch.tool,
      action: touch.action,
      path: touch.path,
      ...touch.symbol === undefined ? {} : { symbol: touch.symbol },
      before: touch.before,
      after: touch.after,
      ...touch.startLine === undefined ? {} : { startLine: touch.startLine },
      ...touch.endLine === undefined ? {} : { endLine: touch.endLine },
    }, touch.signal, (touch.agent as { id?: string } | undefined)?.id)
  }

  /**
   * Record a successful file mutation: one implementation memory for the file
   * plus one memory per changed symbol.
   */
  async recordWrite(touch: FileTouch): Promise<void> {
    if (!this.config.autoRegister) return
    try {
      const draft = await this.draft(touch)
      const name = basename(touch.path)
      const reason = draft?.reason ?? 'Agent code change'
      const project = await this.projectFor(touch.agent, touch.signal)
      await this.call('memory_file_context_tool', withoutUndefined({
        path: touch.path,
        reason,
        tags: draft?.tags,
        project,
      }), touch.signal)
      for (const signature of draft?.signatures ?? []) {
        await this.call('memory_create_tool', withoutUndefined({
          type: 'implementation',
          title: `${signature.name} — ${name}`,
          statement: signature.statement ?? `Defines ${signature.name} in ${name}.`,
          tags: ['implementation', `path:${touch.path}`, `symbol:${signature.name}`],
          details: signature.signature,
          metadata: {
            subject: signature.name,
            kind: signature.kind,
            signature: signature.signature,
            path: touch.path,
          },
          asserted_by: 'agent',
          project,
        }), touch.signal)
      }
    } catch (error) {
      this.warn('recordWrite', error)
    }
  }

  /**
   * Create or update one summary for the work done in this session.
   * Skipped when the model cannot produce a concise summary.
   */
  async recordSessionSummary(input: {
    project: string
    sessionId: string
    text: string
    changes: { path: string; tool: string }[]
    checks?: { command: string; cwd?: string; exitCode: number; output: string }[]
  }): Promise<void> {
    const files = [...new Set(input.changes.map((change) => {
      if (!isAbsolute(change.path)) return change.path.replaceAll('\\', '/')
      const rel = relative(input.project, change.path).replaceAll('\\', '/')
      return rel.startsWith('..') ? change.path.replaceAll('\\', '/') : rel
    }).filter(Boolean))]
    const tools = [...new Set(input.changes.map(change => change.tool))]
    if (files.length === 0 || input.text.trim().length < 200) return
    const target = this.target()
    if (target === undefined) return
    try {
      const summary = await distillSession(this.ctx, target, {
        project: input.project,
        assistantText: input.text,
        files,
        tools,
      })
      if (summary === undefined) return
      const created = await this.call('memory_session_summary_tool', {
        session_id: input.sessionId,
        summary,
        files,
        tools,
        project: input.project,
      }) as { id?: unknown } | null
      const id = typeof created?.id === 'string' ? created.id : undefined
      if (id !== undefined) {
        for (const check of input.checks ?? []) {
          await this.call('memory_check_record_tool', {
            id,
            name: check.command.slice(0, 200),
            command: check.command,
            ...check.cwd === undefined ? {} : { cwd: check.cwd },
            exit_code: check.exitCode,
            output: check.output.slice(0, 4000),
            ran_at: new Date().toISOString(),
          })
        }
      }
    } catch (error) {
      this.warn('recordSessionSummary', error)
    }
  }

  /**
   * Create an explicit memory, rewriting the caller's draft with the secondary
   * model when enabled.
   */
  async createMemory(args: Record<string, unknown>, signal?: AbortSignal, agent?: unknown): Promise<unknown> {
    const target = this.target()
    const statement = typeof args.statement === 'string' ? args.statement : ''
    const titled = await (target === undefined || statement.length === 0
      ? undefined
      : distillAuthored(this.ctx, target, {
        type: typeof args.type === 'string' ? args.type : 'observation',
        title: typeof args.title === 'string' ? args.title : '',
        statement,
        details: typeof args.details === 'string' ? args.details : undefined,
        tags: Array.isArray(args.tags) ? args.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      }, signal, (agent as { id?: string } | undefined)?.id))
    const project = await this.projectFor(agent, signal)
    return this.call('memory_create_tool', withoutUndefined({
      ...args,
      title: titled?.title ?? args.title,
      statement: titled?.statement ?? args.statement,
      details: titled?.details ?? args.details,
      tags: titled?.tags ?? args.tags,
      project,
    }), signal)
  }

  /** Update an explicit memory; only the prose is rewritten. */
  async updateMemory(args: Record<string, unknown>, signal?: AbortSignal, agent?: unknown): Promise<unknown> {
    const target = this.target()
    const statement = typeof args.statement === 'string' ? args.statement : ''
    const titled = await (target === undefined || statement.length === 0
      ? undefined
      : distillAuthored(this.ctx, target, {
        type: 'observation',
        title: typeof args.title === 'string' ? args.title : '',
        statement,
        details: typeof args.details === 'string' ? args.details : undefined,
        tags: [],
      }, signal, (agent as { id?: string } | undefined)?.id))
    const project = await this.projectFor(agent, signal)
    return this.call('memory_update_tool', withoutUndefined({
      ...args,
      statement: titled?.statement ?? args.statement,
      details: titled?.details ?? args.details,
      project,
    }), signal)
  }
}
