/**
 * Release approvals: relays the release tracker's approval queue to the Web UI.
 *
 * The tracker (n8n) lives on the LAN and keeps the queue in its own workflow
 * state. The browser cannot reach it, so this route proxies list/act calls and
 * keeps the tracker's shared token on the Host.
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

interface TrackerConfig {
  /** Base URL of the n8n instance, no trailing slash. */
  url?: string
  /** Shared secret expected by the tracker's `totem-approvals` webhook. */
  token?: string
}

const BODY_LIMIT = 32_000
const TIMEOUT_MS = 15_000
const DEFAULT_URL = 'http://192.168.31.200:5678'

function send(res: ServerResponse, status: number, value: unknown): void {
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

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
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
    ? (parsed as Record<string, unknown>)
    : {}
}

/**
 * The tracker config lives beside the Totem data instead of the plugin row so
 * the token never travels through the settings document.
 */
async function loadConfig(): Promise<TrackerConfig> {
  const path = join(homedir(), '.local', 'share', 'totem', 'approvals.json')
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as TrackerConfig
    return {
      url: String(parsed.url || process.env.DSH_N8N_URL || DEFAULT_URL).replace(/\/+$/, ''),
      token: String(parsed.token || process.env.DSH_N8N_TOKEN || ''),
    }
  } catch {
    return {
      url: String(process.env.DSH_N8N_URL || DEFAULT_URL).replace(/\/+$/, ''),
      token: String(process.env.DSH_N8N_TOKEN || ''),
    }
  }
}

async function callTracker(
  config: TrackerConfig,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${config.url}/webhook/totem-approvals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-totem-token': config.token },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const text = await response.text()
    const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : null
    return { status: response.status, body: parsed }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Register the approval proxy while the Web server is mounted.
 * @param ctx - the Host plugin context.
 * @param deps - the Totem service, read for its own API token.
 */
export function registerApprovalRoutes(
  ctx: Context,
  deps: { totem: { config: { apiToken: { get: () => string } } } },
): void {
  ctx.inject(['webServer'], (webCtx) => {
    const server = (webCtx as unknown as { webServer: { register: (route: unknown) => () => void } }).webServer
    webCtx.effect(() => server.register({
      kind: 'prefix',
      path: '/totem/approvals',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        void (async () => {
          try {
            const token = deps.totem.config.apiToken.get().trim()
            if (!authorized(req, token)) return send(res, 401, { error: 'unauthorized' })

            const config = await loadConfig()
            if (config.token.length === 0) {
              return send(res, 503, {
                error: 'tracker token missing',
                hint: 'write {"url":"http://192.168.31.200:5678","token":"<DSH_WEBHOOK_TOKEN>"} to ~/.local/share/totem/approvals.json',
              })
            }

            if (req.method === 'GET') {
              const result = await callTracker(config, { op: 'list' })
              return send(res, result.status === 200 ? 200 : 502, result.body)
            }
            if (req.method === 'POST') {
              const input = await readBody(req)
              if (String(input.op || '') === 'enqueue') {
                const drafted = await callTracker(config, {
                  op: 'enqueue',
                  note: String(input.note || ''),
                  url: String(input.url || ''),
                })
                return send(res, drafted.status, drafted.body)
              }
              const result = await callTracker(config, {
                op: 'act',
                key: String(input.key || ''),
                action: String(input.action || ''),
              })
              return send(res, result.status, result.body)
            }
            return send(res, 405, { error: 'method not allowed' })
          } catch (error) {
            const aborted = error instanceof Error && error.name === 'AbortError'
            return send(res, aborted ? 504 : 500, {
              error: aborted ? 'tracker timed out' : error instanceof Error ? error.message : String(error),
            })
          }
        })()
      },
    }), 'dsh-totem: approval routes')
  })
}
