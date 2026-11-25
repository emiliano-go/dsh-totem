/**
 * Serve the claude-design editor under the DSH origin.
 *
 * The editor is its own HTTP server on 127.0.0.1:4720. Its remote link is
 * `http://<host>:4720/...`, which a Cloudflare-tunneled DSH domain cannot
 * reach. Proxy `/design/*` and the editor's WebSocket to the loopback server
 * so the same-origin link works from any device that can open DSH.
 *
 * The editor identifies a canvas by a hash of its folder, so a WebSocket needs
 * one exact upgrade registration per canvas. The artifact records are the
 * source of those roots; a watcher adds or removes a route as canvases open.
 *
 * @module dsh-totem/design-proxy
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, watch, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http'
import { connect } from 'node:net'
import type { Duplex } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'

/** Web server surface this proxy needs. */
interface DesignWebServer {
  register: (route: {
    kind: 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }) => () => void
  registerUpgrade: (route: {
    path: string
    handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
  }) => () => void
}

/** Options resolved from the plugin config. */
export interface DesignProxyOptions {
  port: number
}

const EDITOR_PREFIX = '/design'
const HOST = '127.0.0.1'

/** The installed artifact launcher for the active profile. */
function editorScript(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  const profile = process.env.DSH_TOTEM_PROFILE?.trim() || 'web-totem'
  return join(home, 'profiles', profile, 'node_modules', 'dsh-claude-design',
    'skills', 'claude-design', 'scripts', 'artifact.mjs')
}

/** The artifact record directory, following DSH_HOME when set. */
function artifactsDir(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(home, 'baoyu-design', 'artifacts')
}

/** The editor's page path for a canvas root. */
export function designPagePath(root: string): string {
  const id = createHash('sha256').update(resolve(root)).digest('base64url').slice(0, 22)
  return `${EDITOR_PREFIX}/${id}/`
}

/** One artifact record as written by dsh-claude-artifacts. */
function rootOf(file: string): string | undefined {
  try {
    const record = JSON.parse(readFileSync(file, 'utf8')) as { root?: unknown }
    return typeof record.root === 'string' && record.root.length > 0 ? record.root : undefined
  } catch {
    return undefined
  }
}

/** Rewrite the authority the loopback editor expects. */
function upstreamHeaders(req: IncomingMessage, port: number): IncomingHttpHeaders {
  const headers: IncomingHttpHeaders = { ...req.headers, host: `${HOST}:${port}` }
  if (headers.origin !== undefined) headers.origin = `http://${HOST}:${port}`
  if (headers.referer !== undefined) {
    try {
      const at = new URL(headers.referer)
      headers.referer = `http://${HOST}:${port}${at.pathname}${at.search}`
    } catch {
      delete headers.referer
    }
  }
  return headers
}

/** Proxy one HTTP request to the editor. */
function proxyHttp(req: IncomingMessage, res: ServerResponse, port: number): void {
  const upstream = httpRequest({
    host: HOST,
    port,
    method: req.method,
    path: req.url ?? '/',
    headers: upstreamHeaders(req, port),
  }, (answer) => {
    res.writeHead(answer.statusCode ?? 502, answer.headers)
    answer.pipe(res)
  })
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('design editor is not running')
  })
  req.pipe(upstream)
}

/** Proxy one WebSocket upgrade to the editor. */
function proxyUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, port: number): void {
  const upstream = connect(port, HOST, () => {
    const headers = upstreamHeaders(req, port)
    const lines = [`${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1`]
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue
      for (const one of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${one}`)
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (head.length > 0) upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
  socket.on('close', () => upstream.destroy())
}

/** Register `/design` and keep one upgrade route per recorded canvas. */
export function registerDesignProxy(ctx: Context, options: DesignProxyOptions): void {
  ctx.inject(['webServer'], (webCtx) => {
    const server = (webCtx as unknown as { webServer: DesignWebServer }).webServer
    const routes = new Map<string, () => void>()
    let watcher: FSWatcher | undefined
    let pending: NodeJS.Timeout | undefined
    let editorStarted = false

    const sync = (): void => {
      const wanted = new Map<string, string>()
      const dir = artifactsDir()
      if (existsSync(dir)) {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith('.json')) continue
          const root = rootOf(join(dir, name))
          if (root !== undefined) {
            const page = designPagePath(root)
            wanted.set(page, root)
            // The editor's live stream upgrades at this sub-path; the page
            // itself is served by the HTTP prefix route.
            wanted.set(`${page}__deck/events`, root)
          }
        }
      }
      for (const [path, dispose] of routes) {
        if (wanted.has(path)) continue
        dispose()
        routes.delete(path)
      }
      for (const path of wanted.keys()) {
        if (routes.has(path)) continue
        try {
          routes.set(path, server.registerUpgrade({
            path,
            handler: (req, socket, head) => proxyUpgrade(req, socket, head, options.port),
          }))
        } catch (error) {
          ctx.logger.warn(`dsh-totem: design upgrade ${path} not registered: ${String(error)}`)
        }
      }
      // The editor is a separate process and does not survive a Host restart.
      // Start it with the first recorded canvas; later Artifacts opens reuse it.
      if (!editorStarted && wanted.size > 0) {
        const script = editorScript()
        const root = wanted.values().next().value
        if (existsSync(script) && root !== undefined) {
          editorStarted = true
          try {
            const child = spawn(process.execPath, [script, 'open', root], { detached: true, stdio: 'ignore' })
            child.unref()
          } catch (error) {
            ctx.logger.warn(`dsh-totem: design editor did not start: ${String(error)}`)
          }
        }
      }
    }

    const schedule = (): void => {
      if (pending !== undefined) clearTimeout(pending)
      pending = setTimeout(() => {
        pending = undefined
        sync()
      }, 100)
    }

    const disposeHttp = server.register({
      kind: 'prefix',
      path: EDITOR_PREFIX,
      handler: (req, res) => proxyHttp(req, res, options.port),
    })

    sync()
    if (existsSync(artifactsDir())) {
      try {
        watcher = watch(artifactsDir(), { persistent: false }, schedule)
      } catch (error) {
        ctx.logger.warn(`dsh-totem: design artifact watcher failed: ${String(error)}`)
      }
    }

    webCtx.effect(() => () => {
      disposeHttp()
      for (const dispose of routes.values()) dispose()
      routes.clear()
      watcher?.close()
      if (pending !== undefined) clearTimeout(pending)
    }, 'dsh-totem: design proxy')
  })
}
