/**
 * Read the OpenCode Go usage meters for each key in encoder's rotation pool.
 *
 * The provider exposes `/inference/go/v1/usage`; the local rotation proxy only
 * forwards the OpenAI-compatible `/v1` API. Keys never leave this module in a
 * response: only a masked label and a stable hash are returned.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type KeyUsageState = 'usable' | 'suspended' | 'revoked'

export interface KeyUsageMeter {
  status: string
  percent: number
  resetsAt: string | null
}

export interface KeyUsageMeters {
  rolling: KeyUsageMeter | null
  weekly: KeyUsageMeter | null
  monthly: KeyUsageMeter | null
}

export interface KeyUsageCard {
  id: string
  masked: string
  state: KeyUsageState
  suspendedUntil: string | null
  usage: KeyUsageMeters | null
  error: string | null
}

export interface KeyUsageSnapshot {
  provider: string
  generatedAt: string
  keys: KeyUsageCard[]
}

export interface KeyUsageOptions {
  authPath?: string
  provider?: string
  usageUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  now?: number
}

interface AuthPool {
  type?: string
  key?: string
  keys?: string[]
  suspended?: Record<string, number>
  revoked?: string[]
}

const DEFAULT_USAGE_URL = 'https://opencode.ai/inference/go/v1/usage'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

function masked(key: string): string {
  return key.length > 14 ? `${key.slice(0, 10)}…${key.slice(-4)}` : '…'
}

function meter(value: unknown): KeyUsageMeter | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const percent = Number(record.percent)
  if (!Number.isFinite(percent)) return null
  return {
    status: typeof record.status === 'string' ? record.status : 'unknown',
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    resetsAt: typeof record.resetsAt === 'string' ? record.resetsAt : null,
  }
}

function parseUsage(value: unknown): KeyUsageMeters | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  return {
    rolling: meter(record.rolling),
    weekly: meter(record.weekly),
    monthly: meter(record.monthly),
  }
}

function poolAt(authPath: string, provider: string): AuthPool | undefined {
  const all = JSON.parse(readFileSync(authPath, 'utf8')) as Record<string, unknown>
  const entry = all[provider]
  if (typeof entry !== 'object' || entry === null) return undefined
  const pool = entry as AuthPool
  return pool.type === 'api' ? pool : undefined
}

async function usageFor(
  key: string,
  options: Required<Pick<KeyUsageOptions, 'usageUrl' | 'timeoutMs' | 'now'>>,
  fetchImpl: typeof fetch,
): Promise<{ usage: KeyUsageMeters | null; error: string | null }> {
  try {
    const response = await fetchImpl(options.usageUrl, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(options.timeoutMs),
    })
    if (!response.ok) return { usage: null, error: `HTTP ${response.status}` }
    const body = await response.json() as { usage?: unknown }
    return { usage: parseUsage(body.usage), error: null }
  } catch (error) {
    return { usage: null, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Return masked per-key meters from the configured encoder auth pool. */
export async function readKeyUsage(options: KeyUsageOptions = {}): Promise<KeyUsageSnapshot> {
  const provider = options.provider ?? process.env.DSH_KEYS_PROVIDER ?? 'opencode-go'
  const authPath = options.authPath
    ?? process.env.DSH_KEYS_AUTH
    ?? join(homedir(), '.local', 'share', 'encoder', 'auth.json')
  const now = options.now ?? Date.now()
  const settings = {
    usageUrl: options.usageUrl ?? DEFAULT_USAGE_URL,
    timeoutMs: options.timeoutMs ?? 5000,
    now,
  }
  const fetchImpl = options.fetchImpl ?? fetch

  let pool: AuthPool | undefined
  try {
    pool = poolAt(authPath, provider)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') pool = undefined
    else throw error
  }
  const keys = [...new Set([pool?.key, ...(pool?.keys ?? [])].filter((key): key is string => typeof key === 'string' && key.length > 0))]
  const suspended = pool?.suspended ?? {}
  const revoked = new Set(pool?.revoked ?? [])
  const cards = await Promise.all(keys.map(async (key): Promise<KeyUsageCard> => {
    const hash = hashKey(key)
    const until = suspended[hash]
    const isRevoked = revoked.has(hash)
    const state: KeyUsageState = isRevoked ? 'revoked' : until !== undefined && until > now ? 'suspended' : 'usable'
    const result = await usageFor(key, settings, fetchImpl)
    return {
      id: hash,
      masked: masked(key),
      state,
      suspendedUntil: until !== undefined && until > now ? new Date(until).toISOString() : null,
      usage: result.usage,
      error: result.error,
    }
  }))

  return {
    provider,
    generatedAt: new Date(now).toISOString(),
    keys: cards,
  }
}
