/**
 * Permanent browser login for the DSH Web host.
 *
 * DSH's own `?token=` launch token is random per process, so it changes on
 * every restart and cannot be bookmarked. This route instead derives a stable
 * key from the persistent browser-session signing secret and mints the same
 * signed cookie DSH expects. The key lives in the path, so Cloudflare Access
 * cannot drop it the way it drops a query string.
 *
 * @module dsh-totem/login
 */
import { execFileSync } from 'node:child_process'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Cookie prefix and payload version DSH's browser auth expects. */
const COOKIE_PREFIX = 'dsh-auth-'
const COOKIE_VERSION = 1
/** Matches the profile's `cookieMaxAgeDays`; DSH rejects longer intervals. */
export const MAX_AGE_DAYS = 3650
const DAY_MS = 86_400_000
const KEY_LABEL = 'dsh-totem:login:v1'

/** DSH home, honouring the same override the host uses. */
export function dshHome(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.DSH_HOME?.trim()
  return configured !== undefined && configured.length > 0 ? configured : join(homedir(), '.dsh')
}

function base64url(value: Buffer): string {
  return value.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

/** DSH signs with the decoded 32-byte secret, not its base64url spelling. */
function secretBytes(secret: string): Buffer | undefined {
  if (!/^[A-Za-z0-9_-]+$/u.test(secret)) return undefined
  const padding = '='.repeat((4 - secret.length % 4) % 4)
  const decoded = Buffer.from(secret.replaceAll('-', '+').replaceAll('_', '/') + padding, 'base64')
  return decoded.byteLength === 32 ? decoded : undefined
}

/** Extract `client-connection/browser-session`'s secret from the credentials YAML. */
export function parseCookieSecret(text: string): string | undefined {
  let recordIndent = -1
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/u, '')
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const indent = line.length - line.trimStart().length
    if (recordIndent === -1) {
      if (trimmed === 'client-connection/browser-session:') recordIndent = indent
      continue
    }
    if (indent <= recordIndent) return undefined
    const match = /^secret:\s*([A-Za-z0-9_-]+)\s*$/u.exec(trimmed)
    if (match !== null) return match[1]
  }
  return undefined
}

interface SecretCache {
  path: string
  mtimeMs: number
  secret: string | undefined
}

let cache: SecretCache | undefined

/** Read the persistent browser-session secret, caching by file mtime. */
export function readCookieSecret(home = dshHome()): string | undefined {
  const path = join(home, '.credentials.yaml')
  try {
    const { mtimeMs } = statSync(path)
    if (cache?.path === path && cache.mtimeMs === mtimeMs) return cache.secret
    const parsed = parseCookieSecret(readFileSync(path, 'utf8'))
    const secret = parsed === undefined ? undefined : secretBytes(parsed) === undefined ? undefined : parsed
    cache = { path, mtimeMs, secret }
    return secret
  } catch {
    return undefined
  }
}

/** Stable login key derived from the cookie secret. */
export function deriveLoginKey(secret: string): string {
  const key = secretBytes(secret)
  if (key === undefined) throw new Error('invalid browser-session secret')
  return base64url(createHmac('sha256', key).update(KEY_LABEL).digest())
}

/** Authority exactly as DSH computes it: origin when TLS, host when plain. */
export function authorityFor(req: IncomingMessage): string | undefined {
  const host = req.headers.host
  if (host === undefined || host.length === 0) return undefined
  const secure = (req.socket as { encrypted?: boolean }).encrypted === true
  try {
    const url = new URL(`${secure ? 'https:' : 'http:'}//${host}`)
    return secure ? url.origin : url.host
  } catch {
    return undefined
  }
}

/** Public base URL for the login link, using the proxy's forwarded scheme. */
function publicBase(req: IncomingMessage): string | undefined {
  const authority = authorityFor(req)
  if (authority === undefined) return undefined
  if (authority.startsWith('http://') || authority.startsWith('https://')) return authority
  const forwarded = req.headers['x-forwarded-proto']
  const proto = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim().toLowerCase() : undefined
  const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/iu.test(authority)
  return `${proto === 'http' || (proto === undefined && loopback) ? 'http' : 'https'}://${authority}`
}

/** Stable, bookmarkable login URL for the requesting authority. */
export function loginUrlFor(req: IncomingMessage, home = dshHome()): string | null {
  const base = publicBase(req)
  const secret = readCookieSecret(home)
  if (base === undefined || secret === undefined) return null
  return `${base}/totem/login/${deriveLoginKey(secret)}`
}

/** Mint the exact cookie DSH's `decodeCookie` accepts. */
export function mintCookie(secret: string, authority: string, now = Date.now()): string {
  const key = secretBytes(secret)
  if (key === undefined) throw new Error('invalid browser-session secret')
  const name = `${COOKIE_PREFIX}${base64url(createHash('sha256').update(authority).digest())}`
  const issuedAt = now
  const expiresAt = issuedAt + MAX_AGE_DAYS * DAY_MS
  const payload = { version: COOKIE_VERSION, authority, issuedAt, expiresAt }
  const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = base64url(createHmac('sha256', key).update(body).digest())
  const value = `v${COOKIE_VERSION}.${body}.${signature}`
  const attributes = [
    `${name}=${value}`,
    `Max-Age=${String(MAX_AGE_DAYS * 86_400)}`,
    'Path=/',
    `Expires=${new Date(expiresAt).toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/iu.test(authority)) attributes.push('Secure')
  return attributes.join('; ')
}

function safeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual, 'utf8')
  const right = Buffer.from(expected, 'utf8')
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}

const qrCache = new Map<string, string>()

/** PNG data URL for a login link, or null when `qrencode` is unavailable. */
export function loginQrFor(url: string): string | null {
  const cached = qrCache.get(url)
  if (cached !== undefined) return cached
  try {
    const png = execFileSync('qrencode', ['-t', 'PNG', '-o', '-', '-s', '6', url], { maxBuffer: 1 << 20 })
    const data = `data:image/png;base64,${png.toString('base64')}`
    qrCache.set(url, data)
    if (qrCache.size > 4) qrCache.delete(qrCache.keys().next().value as string)
    return data
  } catch {
    return null
  }
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

/** Temporary diagnostic: one line per login request in the host journal. */
function log(event: string, req: IncomingMessage): void {
  process.stderr.write(`[totem-login] ${event} host=${req.headers.host ?? '-'}\n`)
}

type Resolved =
  | { ok: true; secret: string; authority: string }
  | { ok: false; status: number; message: string }

function resolve(req: IncomingMessage, key: string, home: string): Resolved {
  const secret = readCookieSecret(home)
  if (secret === undefined) return { ok: false, status: 503, message: 'browser-session secret unavailable; start the host once to create it\n' }
  if (!safeEqual(key, deriveLoginKey(secret))) return { ok: false, status: 404, message: 'not found\n' }
  const authority = authorityFor(req)
  if (authority === undefined) return { ok: false, status: 400, message: 'missing host\n' }
  return { ok: true, secret, authority }
}

function refuse(res: ServerResponse, result: Resolved, event: string, req: IncomingMessage): void {
  if (result.ok) return
  log(`${event} status=${String(result.status)} setCookie=false`, req)
  text(res, result.status, result.message)
}

function page(key: string): string {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Signing in</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:3rem auto;max-width:26rem;padding:0 1rem;color:#ddd;background:#111}a{color:#7ab7ff}</style>
<p id="status">Signing you in…</p>
<noscript><p><a href="/totem/login/${key}/continue">Continue</a></p></noscript>
<script>
fetch("/totem/login/${key}/cookie", { credentials: "same-origin", cache: "no-store" })
  .then(function (response) { if (!response.ok) throw new Error(String(response.status)); location.replace("/") })
  .catch(function () {
    var line = document.getElementById("status")
    line.textContent = "Sign-in failed. "
    var retry = document.createElement("a")
    retry.href = "/totem/login/${key}"
    retry.textContent = "Try again"
    line.appendChild(retry)
  })
</script>
`
}

/** Serve the same-origin login page that exchanges the key for a cookie. */
export function handleLoginPage(req: IncomingMessage, res: ServerResponse, key: string, home = dshHome()): void {
  const result = resolve(req, key, home)
  if (!result.ok) return refuse(res, result, 'page', req)
  log('page status=200 setCookie=false', req)
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  })
  res.end(page(key))
}

/** Mint the browser cookie for a same-origin fetch. */
export function handleLoginCookie(req: IncomingMessage, res: ServerResponse, key: string, home = dshHome()): void {
  const result = resolve(req, key, home)
  if (!result.ok) return refuse(res, result, 'cookie', req)
  log('cookie status=204 setCookie=true', req)
  res.writeHead(204, {
    'cache-control': 'no-store',
    'set-cookie': mintCookie(result.secret, result.authority),
  })
  res.end()
}

/** Set the cookie and redirect; used by the no-JS fallback and existing links. */
export function handleBrowserLogin(req: IncomingMessage, res: ServerResponse, key: string, home = dshHome()): void {
  const result = resolve(req, key, home)
  if (!result.ok) return refuse(res, result, 'continue', req)
  log('continue status=303 setCookie=true', req)
  res.writeHead(303, {
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    location: '/',
    'set-cookie': mintCookie(result.secret, result.authority),
  })
  res.end()
}
