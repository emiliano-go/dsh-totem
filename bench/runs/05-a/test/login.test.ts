import { expect, test } from 'bun:test'
import { createHash, createHmac } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  authorityFor,
  deriveLoginKey,
  handleBrowserLogin,
  handleLoginCookie,
  handleLoginPage,
  loginUrlFor,
  mintCookie,
  parseCookieSecret,
  readCookieSecret,
} from '../src/login.ts'

const SECRET = 'Lk91ByeVuFIaXICOnR1JMZndozhBFoFyvTJGa6gz9cE'
const CREDENTIALS = `version: 1
records:
  client-connection/browser-session:
    kind: grant
    payload:
      version: 1
      secret: ${SECRET}
`

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), 'totem-login-'))
  writeFileSync(join(dir, '.credentials.yaml'), CREDENTIALS)
  return dir
}

function request(host = 'dsh.emiliano-go.com', proto = 'https'): IncomingMessage {
  return {
    headers: { host, 'x-forwarded-proto': proto },
    socket: { encrypted: false },
  } as unknown as IncomingMessage
}

interface Captured {
  status: number
  headers: Record<string, string>
  body: string
}

function response(): { res: ServerResponse; captured: Captured } {
  const captured: Captured = { status: 0, headers: {}, body: '' }
  const res = {
    writeHead: (status: number, headers: Record<string, string>) => {
      captured.status = status
      captured.headers = headers
    },
    end: (body?: string) => { captured.body = body ?? '' },
  } as unknown as ServerResponse
  return { res, captured }
}

function b64url(value: Buffer): string {
  return value.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function secretBytes(secret: string): Buffer {
  const padding = '='.repeat((4 - secret.length % 4) % 4)
  return Buffer.from(secret.replaceAll('-', '+').replaceAll('_', '/') + padding, 'base64')
}

/** The exact checks DSH's decodeCookie performs. */
function decode(cookieValue: string, secret: string, authority: string) {
  const [version, body, signature] = cookieValue.split('.')
  const expected = createHmac('sha256', secretBytes(secret)).update(body).digest()
  expect(signature).toBe(b64url(expected))
  expect(version).toBe('v1')
  const decoded = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as Record<string, unknown>
  expect(decoded.authority).toBe(authority)
  expect(decoded.version).toBe(1)
  const issued = Number(decoded.issuedAt)
  const expires = Number(decoded.expiresAt)
  expect(Number.isSafeInteger(issued)).toBe(true)
  expect(expires - issued).toBe(3650 * 86_400_000)
  return decoded
}

test('the record secret is extracted from the credentials file', () => {
  expect(parseCookieSecret(CREDENTIALS)).toBe(SECRET)
  expect(parseCookieSecret('records:\n  other:\n    secret: nope\n')).toBeUndefined()
  expect(readCookieSecret(home())).toBe(SECRET)
})

test('the login key is stable and derived from the secret', () => {
  expect(deriveLoginKey(SECRET)).toBe(deriveLoginKey(SECRET))
  expect(deriveLoginKey(SECRET)).toMatch(/^[A-Za-z0-9_-]{43}$/u)
  expect(deriveLoginKey(SECRET)).not.toBe(deriveLoginKey('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'))
})

test('the minted cookie passes the host decoder', () => {
  const authority = 'dsh.emiliano-go.com'
  const header = mintCookie(SECRET, authority, 1_800_000_000_000)
  const [pair, ...attributes] = header.split('; ')
  const [name, value] = pair.split('=')
  expect(name).toBe(`dsh-auth-${b64url(createHash('sha256').update(authority).digest())}`)
  expect(attributes).toContain('HttpOnly')
  expect(attributes).toContain('SameSite=Lax')
  expect(attributes).toContain('Secure')
  const decoded = decode(value, SECRET, authority)
  expect(decoded.issuedAt).toBe(1_800_000_000_000)
  expect(decoded.expiresAt).toBe(1_800_000_000_000 + 3650 * 86_400_000)
})

test('authority mirrors the listener protocol, not the public scheme', () => {
  expect(authorityFor(request())).toBe('dsh.emiliano-go.com')
  expect(authorityFor(request('localhost:3080', 'http'))).toBe('localhost:3080')
  const tls = { headers: { host: 'dsh.emiliano-go.com' }, socket: { encrypted: true } } as unknown as IncomingMessage
  expect(authorityFor(tls)).toBe('https://dsh.emiliano-go.com')
})

test('the login URL is path based and bookmarkable', () => {
  const url = loginUrlFor(request(), home())
  expect(url).toBe(`https://dsh.emiliano-go.com/totem/login/${deriveLoginKey(SECRET)}`)
  expect(url).not.toContain('?')
})

test('the login route mints a cookie and rejects a wrong key', () => {
  const dir = home()
  const good = response()
  handleBrowserLogin(request(), good.res, deriveLoginKey(SECRET), dir)
  expect(good.captured.status).toBe(303)
  expect(good.captured.headers.location).toBe('/')
  expect(good.captured.headers['set-cookie']).toContain('dsh-auth-')

  const bad = response()
  handleBrowserLogin(request(), bad.res, 'nope', dir)
  expect(bad.captured.status).toBe(404)
})

test('the login page exchanges the key on the same origin', () => {
  const dir = home()
  const page = response()
  handleLoginPage(request(), page.res, deriveLoginKey(SECRET), dir)
  expect(page.captured.status).toBe(200)
  expect(page.captured.headers['set-cookie']).toBeUndefined()
  expect(page.captured.headers['content-type']).toContain('text/html')
  expect(page.captured.body).toContain('/totem/login/' + deriveLoginKey(SECRET) + '/cookie')
  expect(page.captured.body).toContain('credentials: "same-origin"')

  const cookie = response()
  handleLoginCookie(request(), cookie.res, deriveLoginKey(SECRET), dir)
  expect(cookie.captured.status).toBe(204)
  const header = cookie.captured.headers['set-cookie']
  expect(header).toContain('dsh-auth-')
  const value = header.split('; ')[0].split('=')[1]
  decode(value, SECRET, 'dsh.emiliano-go.com')

  const wrong = response()
  handleLoginPage(request(), wrong.res, 'nope', dir)
  expect(wrong.captured.status).toBe(404)
})

test('missing credentials disable the link instead of crashing', () => {
  const empty = mkdtempSync(join(tmpdir(), 'totem-login-empty-'))
  expect(loginUrlFor(request(), empty)).toBeNull()
  const missing = response()
  handleBrowserLogin(request(), missing.res, 'irrelevant', empty)
  expect(missing.captured.status).toBe(503)
})
