/** Authenticated HTTP routes backing the assistant settings section. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { TotemService } from './service.ts'
import type { CandidateService } from './candidates.ts'
import type { ReminderService } from './reminders.ts'
import type { WatchService } from './watches.ts'
import type { VerifyLane, VerifyStore } from './verify-lane.ts'
import { ruleCatalog } from './verify-lane.ts'
import { sendNotification } from './notify.ts'
import type { OverviewService } from './overview.ts'
import type { ConflictInbox } from './conflicts.ts'
import type { RestartController } from './restart.ts'
import type { UnreadStore } from './unread.ts'

const BODY_LIMIT = 1_000_000

/** The slice of Totem's quality report the review tab shows. */
interface QualitySummary {
  total?: number
  durable?: number
  staleEvidence?: { items?: number; ratio?: number }
  conflicts?: { open?: number; total?: number }
}

/** Collaborators the assistant routes read. */
interface AssistantDeps {
  totem: TotemService
  reminders: ReminderService
  watches: WatchService
  candidates: CandidateService
  overview: OverviewService
  conflicts: ConflictInbox
  verify: VerifyStore
  verifyLane: VerifyLane
  unread: UnreadStore
  restart: RestartController
}

/** Per-request facts the handlers need. */
interface RouteContext {
  /** Port this request arrived on, so the launcher targets the same one. */
  port?: number
}

function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

function authorized(req: IncomingMessage, token: string): boolean {
  if (token.length === 0) return false
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ') === true && header.slice(7) === token) return true
  const direct = req.headers['x-totem-token']
  return typeof direct === 'string' && direct === token
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > BODY_LIMIT) throw new Error('body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

async function memories(totem: TotemService, url: URL): Promise<unknown> {
  const project = url.searchParams.get('project') ?? totem.lastProject
  if (!project || !isAbsolute(project)) throw new Error('an absolute project path is required')
  const query = url.searchParams.get('query')?.trim() ?? ''
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))
  const signal = AbortSignal.timeout(20_000)
  const result = query.length > 0
    ? await totem.call('memory_search_tool', { query, project, limit }, signal)
    : await totem.call('memory_list_tool', { project, limit }, signal)
  return { project, items: Array.isArray(result) ? result : [] }
}

const routes = {
  async GET(
    path: string,
    url: URL,
    deps: AssistantDeps,
    _context: RouteContext = {},
  ): Promise<unknown> {
    if (path === '/totem/ping') return { ok: true }
    if (path === '/totem/host') return deps.restart.status()
    if (path === '/totem/verify/rules') {
      return {
        rules: ruleCatalog(),
        settings: {
          command: deps.verifyLane.settings().command,
          disable: deps.verifyLane.settings().disable,
        },
      }
    }
    if (path === '/totem/verify') {
      const turn = Number(url.searchParams.get('turn') ?? '')
      return { result: Number.isFinite(turn) ? deps.verify.forTurn(turn) ?? null : deps.verify.last() ?? null }
    }
    if (path === '/totem/state') {
      return { lastProject: deps.totem.lastProject, userProject: await deps.totem.userProject() }
    }
    if (path === '/totem/memories') return memories(deps.totem, url)
    if (path === '/totem/candidates') return { items: await deps.candidates.list() }
    if (path === '/totem/conflicts') {
      const project = url.searchParams.get('project') ?? deps.totem.lastProject
      const includeResolved = url.searchParams.get('resolved') === '1'
      const items = await deps.conflicts.list(project, includeResolved)
      // Quality is best-effort: an unreachable Totem server must still show the
      // inbox this plugin already has on disk.
      const quality = await deps.totem
        .call('memory_quality_tool', { project }, AbortSignal.timeout(5000))
        .catch(() => undefined) as QualitySummary | undefined
      return {
        items,
        summary: {
          staleItems: Number(quality?.staleEvidence?.items ?? 0),
          staleRatio: Number(quality?.staleEvidence?.ratio ?? 0),
          openConflicts: Number(quality?.conflicts?.open ?? items.length),
          durable: Number(quality?.durable ?? 0),
          total: Number(quality?.total ?? 0),
        },
      }
    }
    if (path === '/totem/reminders') return { items: await deps.reminders.list(true) }
    if (path === '/totem/watches') return { items: await deps.watches.list(true) }
    if (path === '/totem/unread') return { items: await deps.unread.list() }
    if (path === '/totem/overview') {
      await deps.overview.ensure()
      const source = url.searchParams.get('source') ?? 'all'
      const filter = source === 'dsh' || source === 'opencode' || source === 'encoder' ? source : 'all'
      return deps.overview.snapshot(filter)
    }
    throw Object.assign(new Error('not found'), { status: 404 })
  },
  async POST(
    path: string,
    bodyValue: Record<string, unknown>,
    deps: AssistantDeps,
    context: RouteContext = {},
  ): Promise<unknown> {
    if (path === '/totem/restart') {
      const delay = Number(bodyValue.delayMs ?? Number.NaN)
      return {
        plan: deps.restart.schedule({
          idle: bodyValue.idle !== false,
          ...Number.isFinite(delay) ? { delayMs: delay } : {},
          ...context.port === undefined ? {} : { port: context.port },
        }),
      }
    }
    if (path === '/totem/overview/import') { return deps.overview.importHistory() }
    if (path === '/totem/unread') {
      const sessionId = bodyValue.sessionId
      return { items: await deps.unread.mark(sessionId) }
    }
    if (path === '/totem/unread/clear') {
      const sessionIds = Array.isArray(bodyValue.sessionIds) ? bodyValue.sessionIds : []
      return { items: await deps.unread.clear(sessionIds) }
    }
    if (path === '/totem/watches') {
      const interval = Number(bodyValue.intervalMinutes ?? 15)
      return deps.watches.add({
        kind: (bodyValue.kind === 'rss' || bodyValue.kind === 'condition' ? bodyValue.kind : 'page') as 'page' | 'rss' | 'condition',
        url: typeof bodyValue.url === 'string' ? bodyValue.url : '',
        condition: typeof bodyValue.condition === 'string' ? bodyValue.condition : undefined,
        intervalMinutes: Number.isFinite(interval) ? interval : 15,
      })
    }
    if (path === '/totem/notify-test') {
      return sendNotification(deps.totem.config, {
        title: typeof bodyValue.title === 'string' ? bodyValue.title : 'dsh-totem',
        message: typeof bodyValue.message === 'string' ? bodyValue.message : 'Notifications are configured correctly.',
      })
    }
    const candidate = /^\/totem\/candidates\/([^/]+)\/(approve|reject)$/u.exec(path)
    if (candidate !== null) {
      return candidate[2] === 'approve'
        ? { approved: await deps.candidates.approve(decodeURIComponent(candidate[1])) }
        : { rejected: await deps.candidates.reject(decodeURIComponent(candidate[1])) }
    }
    const conflict = /^\/totem\/conflicts\/([^/]+)\/resolve$/u.exec(path)
    if (conflict !== null) {
      const resolution = typeof bodyValue.resolution === 'string' && bodyValue.resolution.trim().length > 0
        ? bodyValue.resolution.trim()
        : 'both'
      const resolved = await deps.conflicts.resolve(decodeURIComponent(conflict[1]), resolution, deps.totem)
      if (resolved === undefined) throw Object.assign(new Error('conflict not found or already resolved'), { status: 404 })
      return { conflict: resolved }
    }
    const reminder = /^\/totem\/reminders\/([^/]+)\/(snooze|ack|done|cancel)$/u.exec(path)
    if (reminder !== null) {
      const id = decodeURIComponent(reminder[1])
      if (reminder[2] === 'snooze') {
        const minutes = Number(bodyValue.minutes ?? 10)
        return { snoozed: await deps.reminders.snooze(id, Number.isFinite(minutes) ? minutes : 10) }
      }
      if (reminder[2] === 'ack') return { acknowledged: await deps.reminders.ack(id) }
      return reminder[2] === 'done'
        ? { done: await deps.reminders.done(id) }
        : { canceled: await deps.reminders.cancel(id) }
    }
    const watch = /^\/totem\/watches\/([^/]+)\/(run|cancel)$/u.exec(path)
    if (watch !== null) {
      const id = decodeURIComponent(watch[1])
      return watch[2] === 'run'
        ? { watch: await deps.watches.runNow(id) }
        : { canceled: await deps.watches.cancel(id) }
    }
    throw Object.assign(new Error('not found'), { status: 404 })
  },
}

/**
 * Register the `/totem` prefix route while the Web server is mounted.
 * Requests need `Authorization: Bearer <apiToken>`; the token lives in the
 * `totem` settings row, which only authenticated clients can read.
 */
export function registerAssistantRoutes(
  ctx: Context,
  deps: AssistantDeps,
): void {
  ctx.inject(['webServer'], (webCtx) => {
    const server = (webCtx as unknown as { webServer: { register: (route: unknown) => () => void } }).webServer
    webCtx.effect(() => server.register({
      kind: 'prefix',
      path: '/totem',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        void (async () => {
          try {
            const token = deps.totem.config.apiToken.get().trim()
            if (!authorized(req, token)) return json(res, 401, { error: 'unauthorized' })
            const url = new URL(req.url ?? '/', 'http://localhost')
            const context: RouteContext = { port: req.socket.localPort }
            if (req.method === 'GET') return json(res, 200, await routes.GET(url.pathname, url, deps, context))
            if (req.method === 'POST') return json(res, 200, await routes.POST(url.pathname, await body(req), deps, context))
            return json(res, 405, { error: 'method not allowed' })
          } catch (error) {
            const status = typeof error === 'object' && error !== null && 'status' in error
              ? Number((error as { status: unknown }).status) : 500
            return json(res, Number.isInteger(status) ? status : 500, {
              error: error instanceof Error ? error.message : String(error),
            })
          }
        })()
      },
    }), 'dsh-totem: assistant routes')
  })
}
