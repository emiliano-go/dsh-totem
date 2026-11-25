/**
 * Mechanical working-state ledger for long sessions.
 *
 * Compaction summaries are model output: they keep what the summarizer thought
 * mattered. Benchmarks show that LLM summaries retain only a small fraction of
 * details that recur later, while code-built extraction keeps most of them.
 * This module observes the session events and writes down the parts that are
 * cheap and unambiguous — the current goal, the latest user requests verbatim,
 * todos, files touched, commands and failures — so the post-compaction
 * recovery block can restore them even when the summary dropped them.
 *
 * The ledger is per Session, persisted under `~/.dsh/totem/ledgers/`, and
 * flushed at turn boundaries and before a compaction so it survives a restart
 * and the auto-resume path.
 *
 * @module dsh-totem/ledger
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clipToTokens } from './budget.ts'
import { stateDir } from './store.ts'

/** One event field the ledger reads. */
export interface LedgerEventLike {
  type?: unknown
  data?: unknown
}

/** One file the session changed. */
export interface LedgerFile {
  path: string
  action: string
  at: number
}

/** One command and its exit code. */
export interface LedgerCheck {
  command: string
  exitCode: number
  at: number
}

/** Persisted state for one Session. */
export interface LedgerState {
  version: 1
  /** First real user request, the task's anchor. */
  goal: string
  /** Latest user requests, verbatim and newest last. */
  users: string[]
  /** Current todo list from the last `todo_write` call. */
  todos: { content: string; status: string }[]
  /** Files changed by the session, newest first. */
  files: LedgerFile[]
  /** Recent commands with exit codes, newest first. */
  checks: LedgerCheck[]
  /** Last failing command and the tail of its output. */
  failure?: { command: string; output: string; at: number }
  turns: number
  updatedAt: number
}

/** Hard caps keep the injected block small and the file bounded. */
export const LEDGER_LIMITS = {
  users: 5,
  userChars: 400,
  todos: 20,
  todoChars: 160,
  files: 12,
  checks: 5,
  failureChars: 300,
  commandChars: 200,
} as const

function emptyState(): LedgerState {
  return {
    version: 1,
    goal: '',
    users: [],
    todos: [],
    files: [],
    checks: [],
    turns: 0,
    updatedAt: 0,
  }
}

function textOf(blocks: unknown[]): string {
  return blocks.flatMap((block) => {
    if (typeof block !== 'object' || block === null) return []
    const record = block as { type?: unknown; text?: unknown }
    return record.type === 'text' && typeof record.text === 'string' ? [record.text] : []
  }).join('\n')
}

function sourceKind(data: unknown): string {
  const record = data as {
    message?: { source?: { kind?: unknown } }
    source?: { kind?: unknown }
  } | undefined
  const kind = record?.message?.source?.kind ?? record?.source?.kind
  return typeof kind === 'string' ? kind : ''
}

function toolArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || value.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text
}

/** One Session's ledger file and in-memory state. */
export class SessionLedger {
  private readonly states = new Map<string, LedgerState>()
  private readonly calls = new Map<string, Map<string, { name: string; args: Record<string, unknown> }>>()
  private readonly dir: string

  constructor(options: { dir?: string } = {}) {
    this.dir = options.dir ?? join(stateDir(), 'ledgers')
  }

  /** Update from one session event. Never throws on malformed events. */
  note(sessionId: string, event: LedgerEventLike): void {
    if (sessionId.length === 0) return
    const state = this.stateFor(sessionId)
    const type = typeof event.type === 'string' ? event.type : ''
    const data = event.data

    if (type === 'user/message') {
      const record = data as { message?: { content?: unknown[]; source?: unknown }; content?: unknown[]; source?: unknown } | undefined
      const message = record?.message ?? record
      if (sourceKind(data) !== 'user') return
      const text = textOf(Array.isArray(message?.content) ? message.content : []).trim()
      if (text.length === 0) return
      const clipped = clip(text, LEDGER_LIMITS.userChars)
      if (state.users.at(-1) !== clipped) state.users.push(clipped)
      state.users = state.users.slice(-LEDGER_LIMITS.users)
      if (state.goal.length === 0) state.goal = clip(text, LEDGER_LIMITS.userChars)
      state.updatedAt = Date.now()
      return
    }

    if (type === 'tool/call') {
      const call = data as { callId?: unknown; name?: unknown; arguments?: unknown } | undefined
      const callId = stringField(call?.callId)
      const name = stringField(call?.name)
      if (callId.length === 0 || name.length === 0) return
      const args = toolArguments(call?.arguments)
      let calls = this.calls.get(sessionId)
      if (calls === undefined) {
        calls = new Map()
        this.calls.set(sessionId, calls)
      }
      calls.set(callId, { name, args })
      if (name.includes('todo')) this.readTodos(state, args)
      state.updatedAt = Date.now()
      return
    }

    if (type === 'tool/result') {
      const result = data as {
        toolCallId?: unknown
        message?: { content?: unknown[]; toolCallId?: unknown; isError?: unknown; meta?: { exitCode?: unknown } }
        meta?: { exitCode?: unknown; path?: unknown }
      } | undefined
      // Current events put the id and the error flag on the message; older
      // fixtures put the id at the data level. Accept both.
      const callId = stringField(result?.message?.toolCallId) || stringField(result?.toolCallId)
      const call = callId.length === 0 ? undefined : this.calls.get(sessionId)?.get(callId)
      if (call === undefined) return
      this.calls.get(sessionId)?.delete(callId)
      this.readResult(state, call, result, result?.message?.isError === true)
      state.updatedAt = Date.now()
      return
    }

    if (type === 'turn/end') {
      state.turns += 1
      state.updatedAt = Date.now()
      this.flush(sessionId)
      return
    }

    if (type === 'compaction/start') {
      this.flush(sessionId)
    }
  }

  /** Whether the ledger has anything worth injecting. */
  has(sessionId: string): boolean {
    const state = this.states.get(sessionId) ?? this.load(sessionId)
    return state !== undefined && (state.goal.length > 0 || state.users.length > 0 || state.todos.length > 0 || state.files.length > 0)
  }

  /**
   * Render the working-state block. Mechanical facts only; the goal, the
   * latest user requests, open todos, touched files, and the last failure.
   */
  render(sessionId: string, maxTokens: number): string {
    const state = this.states.get(sessionId) ?? this.load(sessionId)
    if (state === undefined || maxTokens <= 0) return ''
    if (
      state.goal.length === 0
      && state.users.length === 0
      && state.todos.length === 0
      && state.files.length === 0
      && state.checks.length === 0
      && state.failure === undefined
    ) return ''
    const lines: string[] = ['### Working state (mechanical, not summarized)']
    if (state.goal.length > 0) lines.push(`Goal: ${clip(state.goal, 260)}`)
    const open = state.todos.filter(todo => todo.status !== 'completed')
    if (open.length > 0) {
      lines.push(`Open todos (${open.length}/${state.todos.length}):`)
      for (const todo of open.slice(0, 6)) lines.push(`- [ ] ${todo.content}`)
    }
    if (state.failure !== undefined) {
      lines.push(`Last failure: \`${state.failure.command}\``)
      if (state.failure.output.length > 0) lines.push(`  ${clip(state.failure.output, 220).replaceAll('\n', ' ')}`)
    }
    if (state.users.length > 0) {
      lines.push('Latest user requests (verbatim):')
      for (const message of state.users.slice(-2)) lines.push(`- ${clip(message, 200)}`)
    }
    if (state.files.length > 0) {
      lines.push('Files touched (newest first):')
      for (const file of state.files.slice(0, 5)) lines.push(`- ${file.path} (${file.action})`)
    }
    if (state.checks.length > 0) {
      const checks = state.checks.slice(0, 3).map(check => `\`${check.command}\` → ${check.exitCode}`)
      lines.push(`Recent commands: ${checks.join('; ')}`)
    }
    const next = open[0]?.content ?? ''
    if (next.length > 0) lines.push(`Next: ${clip(next, 200)}`)
    return clipToTokens(lines.join('\n'), maxTokens)
  }

  /** Persist one session's state (atomic write). */
  flush(sessionId: string): void {
    const state = this.states.get(sessionId)
    if (state === undefined) return
    try {
      mkdirSync(this.dir, { recursive: true })
      const path = this.pathFor(sessionId)
      const temp = `${path}.tmp`
      writeFileSync(temp, `${JSON.stringify(state)}\n`, 'utf8')
      renameSync(temp, path)
    } catch {
      // A ledger write must never break the turn.
    }
  }

  /** Flush and drop one session from memory. */
  forget(sessionId: string): void {
    this.flush(sessionId)
    this.states.delete(sessionId)
    this.calls.delete(sessionId)
  }

  private readTodos(state: LedgerState, args: Record<string, unknown>): void {
    const raw = args.todos
    if (!Array.isArray(raw)) return
    const todos: { content: string; status: string }[] = []
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue
      const record = item as { content?: unknown; status?: unknown }
      const content = stringField(record.content).trim()
      if (content.length === 0) continue
      const status = stringField(record.status) || 'pending'
      todos.push({ content: clip(content, LEDGER_LIMITS.todoChars), status })
    }
    state.todos = todos.slice(0, LEDGER_LIMITS.todos)
  }

  private readResult(
    state: LedgerState,
    call: { name: string; args: Record<string, unknown> },
    result: {
      message?: { content?: unknown[]; isError?: unknown }
      meta?: { exitCode?: unknown; path?: unknown }
    } | undefined,
    isError: boolean,
  ): void {
    const mutating = call.name === 'write' || call.name === 'edit' || call.name === 'apply_patch'
    if (mutating) {
      const path = stringField(call.args.file_path)
        || stringField(call.args.filePath)
        || stringField(call.args.path)
        || stringField(result?.meta?.path)
      if (path.length > 0) {
        state.files = state.files.filter(file => file.path !== path)
        state.files.unshift({ path, action: call.name, at: Date.now() })
        state.files = state.files.slice(0, LEDGER_LIMITS.files)
      }
    }
    if (call.name === 'bash') {
      const command = clip(stringField(call.args.command).trim(), LEDGER_LIMITS.commandChars)
      const exitCode = typeof result?.meta?.exitCode === 'number' ? result.meta.exitCode : (isError ? 1 : 0)
      if (command.length > 0) {
        state.checks = [{ command, exitCode, at: Date.now() }, ...state.checks].slice(0, LEDGER_LIMITS.checks)
        if (exitCode !== 0) {
          const output = textOf(Array.isArray(result?.message?.content) ? result.message.content : [])
          state.failure = {
            command,
            output: clip(output.trim(), LEDGER_LIMITS.failureChars),
            at: Date.now(),
          }
        } else {
          state.failure = undefined
        }
      }
    } else if (isError) {
      const output = textOf(Array.isArray(result?.message?.content) ? result.message.content : [])
      state.failure = {
        command: call.name,
        output: clip(output.trim(), LEDGER_LIMITS.failureChars),
        at: Date.now(),
      }
    }
  }

  private stateFor(sessionId: string): LedgerState {
    let state = this.states.get(sessionId)
    if (state === undefined) {
      state = this.load(sessionId) ?? emptyState()
      this.states.set(sessionId, state)
    }
    return state
  }

  private load(sessionId: string): LedgerState | undefined {
    try {
      const path = this.pathFor(sessionId)
      if (!existsSync(path)) return undefined
      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
      if (typeof parsed !== 'object' || parsed === null) return undefined
      const record = parsed as Partial<LedgerState>
      if (record.version !== 1) return undefined
      return {
        ...emptyState(),
        ...record,
        users: Array.isArray(record.users) ? record.users.filter((item): item is string => typeof item === 'string') : [],
        todos: Array.isArray(record.todos) ? record.todos.filter(item => typeof item?.content === 'string') : [],
        files: Array.isArray(record.files) ? record.files.filter(item => typeof item?.path === 'string') : [],
        checks: Array.isArray(record.checks) ? record.checks.filter(item => typeof item?.command === 'string') : [],
      }
    } catch {
      return undefined
    }
  }

  private pathFor(sessionId: string): string {
    const safe = sessionId.replaceAll(/[^A-Za-z0-9_-]/g, '_')
    return join(this.dir, `${safe}.json`)
  }
}
