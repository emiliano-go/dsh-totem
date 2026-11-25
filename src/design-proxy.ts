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
import { copyFileSync, existsSync, readFileSync, readdirSync, watch, writeFileSync, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http'
import { connect } from 'node:net'
import type { Duplex } from 'node:stream'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

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
  /** Public DSH origin used by the canvas URL tool. */
  publicUrl?: string
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

/** The installed artifact plugin that turns a canvas record into a link. */
function artifactPluginFile(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  const profile = process.env.DSH_TOTEM_PROFILE?.trim() || 'web-totem'
  return join(home, 'profiles', profile, 'node_modules', 'dsh-claude-artifacts', 'lib', 'index.js')
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

/** Normalize a public origin without a trailing slash. */
export function normalizePublicUrl(value: string | undefined): string {
  return (value?.trim() || 'https://dsh.emiliano-go.com').replace(/\/+$/u, '')
}

/** Same-origin canvas URL for a canvas root. */
export function canvasUrlFor(root: string, publicUrl?: string): string {
  return `${normalizePublicUrl(publicUrl)}${designPagePath(root)}`
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

interface ArtifactRecord {
  root: string
  title?: string
}

function records(): ArtifactRecord[] {
  const found: ArtifactRecord[] = []
  const dir = artifactsDir()
  if (!existsSync(dir)) return found
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    try {
      const record = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { root?: unknown; title?: unknown }
      if (typeof record.root === 'string' && record.root.length > 0) {
        found.push({
          root: record.root,
          ...typeof record.title === 'string' ? { title: record.title } : {},
        })
      }
    } catch {
      // A partially written record is ignored until the next sync.
    }
  }
  return found
}

/** Find a canvas by absolute path, folder name, or recorded title. */
export function findCanvasRoot(query: string): string | undefined {
  const text = query.trim()
  if (text.length === 0) return undefined
  const direct = resolve(text)
  const known = records()
  const exact = known.find(record => resolve(record.root) === direct)
  if (exact !== undefined) return exact.root
  const named = known.find(record =>
    basename(record.root) === text
    || record.title?.toLowerCase() === text.toLowerCase(),
  )
  if (named !== undefined) return named.root
  return existsSync(direct) ? direct : undefined
}

/**
 * Make the artifact page link same-origin. The upstream plugin still returns
 * the editor's absolute loopback URL, which no remote browser can open.
 */
export function ensureArtifactLinks(): void {
  const file = artifactPluginFile()
  if (!existsSync(file)) return
  const source = readFileSync(file, 'utf8')
  if (source.includes('const at = new URL(out.remoteUrl)')) return
  const before = `  if (!remoteHost) return { url: out.url, reused };
  return typeof out.remoteUrl === "string" ? { url: out.remoteUrl, reused } : { url: out.url, reused, remote: "unsupported" };`
  const after = `  if (!remoteHost) return { url: out.url, reused };
  if (typeof out.remoteUrl === "string") {
    const at = new URL(out.remoteUrl);
    return { url: at.pathname + at.search, reused };
  }
  return { url: out.url, reused, remote: "unsupported" };`
  if (!source.includes(before)) return
  copyFileSync(file, `${file}.bak-totem-design`)
  writeFileSync(file, source.replace(before, after))
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
  ensureArtifactLinks()
  ctx.inject(['webServer'], (webCtx) => {
    const server = (webCtx as unknown as { webServer: DesignWebServer }).webServer
    const routes = new Map<string, () => void>()
    const pageRoots = new Map<string, string>()
    const mounted = new Set<string>()
    const opening = new Map<string, Promise<void>>()
    let watcher: FSWatcher | undefined
    let pending: NodeJS.Timeout | undefined

    /** Mount a canvas on the editor hub before a page or socket reaches it. */
    const ensureCanvas = (root: string): Promise<void> => {
      if (mounted.has(root)) return Promise.resolve()
      const inFlight = opening.get(root)
      if (inFlight !== undefined) return inFlight
      const script = editorScript()
      if (!existsSync(script)) return Promise.resolve()
      const job = new Promise<void>((accept, reject) => {
        const child = spawn(process.execPath, [script, 'open', root], { stdio: 'ignore' })
        child.once('error', reject)
        child.once('exit', (code) => {
          if (code === 0) {
            mounted.add(root)
            accept()
          } else {
            reject(new Error(`canvas editor open exited ${code ?? 'without a code'}`))
          }
        })
      }).catch((error) => {
        ctx.logger.warn(`dsh-totem: canvas ${root} did not open: ${String(error)}`)
      }).finally(() => {
        opening.delete(root)
      })
      opening.set(root, job)
      return job
    }

    const rootForUrl = (url: string): { page: string; root: string } | undefined => {
      const path = url.split('?')[0] ?? '/'
      for (const [page, root] of pageRoots) {
        if (path === page || path.startsWith(page) || path === page.slice(0, -1)) return { page, root }
      }
      return undefined
    }

    const sync = (): void => {
      const wanted = new Map<string, string>()
      pageRoots.clear()
      const dir = artifactsDir()
      if (existsSync(dir)) {
        for (const name of readdirSync(dir)) {
          if (!name.endsWith('.json')) continue
          const root = rootOf(join(dir, name))
          if (root !== undefined) {
            const page = designPagePath(root)
            pageRoots.set(page, root)
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
            handler: async (req, socket, head) => {
              const root = wanted.get(path)
              if (root !== undefined) await ensureCanvas(root)
              proxyUpgrade(req, socket, head, options.port)
            },
          }))
        } catch (error) {
          ctx.logger.warn(`dsh-totem: design upgrade ${path} not registered: ${String(error)}`)
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
      handler: async (req, res) => {
        const match = rootForUrl(req.url ?? '/')
        if (match !== undefined) await ensureCanvas(match.root)
        proxyHttp(req, res, options.port)
      },
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

/**
 * Register `generate_canvas_url`, which returns the same-origin URL for a
 * recorded canvas. It works before the editor has mounted that canvas; the
 * first request to `/design/...` mounts it.
 */
export function registerCanvasUrlTool(ctx: Context, options: DesignProxyOptions): void {
  const render = (value: unknown): { type: 'text'; text: string }[] => [{
    type: 'text',
    text: JSON.stringify(value, null, 2),
  }]
  ctx.tools.register(defineTool({
    name: 'generate_canvas_url',
    description: 'Return the same-origin URL for a claude-design canvas. Use it when an artifact path or title must be opened through the DSH domain instead of the editor loopback port.',
    parameters: {
      path: { type: 'string', description: 'Canvas folder path (absolute or relative) or a recorded canvas title.' },
      title: { type: 'string', description: 'Recorded canvas title, when the exact path is unknown.' },
    } as never,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => render(value),
    },
    async execute(args: Record<string, unknown>) {
      const query = typeof args.path === 'string'
        ? args.path
        : typeof args.title === 'string' ? args.title : ''
      if (query.trim().length === 0) throw new Error('generate_canvas_url needs a canvas path or title')
      const root = findCanvasRoot(query)
      if (root === undefined) throw new Error(`no recorded canvas matches ${query}`)
      return {
        url: canvasUrlFor(root, options.publicUrl),
        path: designPagePath(root),
        root,
      }
    },
  }))
}
