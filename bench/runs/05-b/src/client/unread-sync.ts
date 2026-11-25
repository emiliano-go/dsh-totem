/**
 * Host transport for the unread marks.
 *
 * The Host owns the marks (see `src/unread.ts`); this adapter is the browser's
 * half of the wire. It uses the same `/totem` prefix and bearer token as the
 * rest of the client, and returns `undefined` on any failure so a missing
 * network must not make the local mirror worse.
 *
 * @module dsh-totem/client/unread-sync
 */
import type { UnreadRecord } from './unread-store.ts'

/** Operations the controller needs from the Host. */
export interface UnreadRemote {
  list: () => Promise<UnreadRecord[] | undefined>
  mark: (sessionId: string) => Promise<UnreadRecord[] | undefined>
  clear: (sessionIds: readonly string[]) => Promise<UnreadRecord[] | undefined>
}

/** Read a response's `items`, dropping malformed records. */
export function parseItems(value: unknown): UnreadRecord[] | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return undefined
  const records: UnreadRecord[] = []
  for (const entry of items) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as { sessionId?: unknown; markedAt?: unknown }
    if (typeof record.sessionId !== 'string' || record.sessionId.length === 0) continue
    const markedAt = typeof record.markedAt === 'number' && Number.isFinite(record.markedAt)
      ? record.markedAt
      : Date.now()
    records.push({ sessionId: record.sessionId, markedAt })
  }
  return records
}

/** `/totem/unread` client; `token` is read lazily so settings edits apply. */
export class UnreadApi implements UnreadRemote {
  constructor(private readonly token: () => string) {}

  private async request(path: string, init: RequestInit): Promise<UnreadRecord[] | undefined> {
    const token = this.token().trim()
    if (token.length === 0) return undefined
    try {
      const response = await fetch(`/totem${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...init.body === undefined ? {} : { 'content-type': 'application/json' },
        },
      })
      if (!response.ok) return undefined
      return parseItems(await response.json())
    } catch {
      return undefined
    }
  }

  async list(): Promise<UnreadRecord[] | undefined> {
    return this.request('/unread', { method: 'GET' })
  }

  async mark(sessionId: string): Promise<UnreadRecord[] | undefined> {
    return this.request('/unread', { method: 'POST', body: JSON.stringify({ sessionId }) })
  }

  async clear(sessionIds: readonly string[]): Promise<UnreadRecord[] | undefined> {
    return this.request('/unread/clear', { method: 'POST', body: JSON.stringify({ sessionIds }) })
  }
}
