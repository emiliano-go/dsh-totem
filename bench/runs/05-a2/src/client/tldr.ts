/**
 * Browser transport for the hover TLDR.
 *
 * The Host generates the summary at turn end and stores it; the hover card only
 * reads it back. A short cache keeps re-hovering the same row from hitting the
 * route again, and a failed read renders nothing rather than an error.
 *
 * @module dsh-totem/client/tldr
 */

/** One stored hover summary. */
export interface SessionTldr {
  tldr: string
  /** Epoch milliseconds of the generation. */
  updatedAt: number
}

/** How long a fetched summary stays fresh in the browser. */
const CACHE_MS = 30_000

/** `/totem/tldr` client with a per-session cache. */
export class TldrApi {
  private readonly cache = new Map<string, { at: number; value: SessionTldr | undefined }>()
  private readonly inflight = new Map<string, Promise<SessionTldr | undefined>>()

  constructor(private readonly token: () => string) {}

  /** Read the summary for one session, or undefined when none exists. */
  async load(sessionId: string): Promise<SessionTldr | undefined> {
    if (sessionId.length === 0) return undefined
    const cached = this.cache.get(sessionId)
    if (cached !== undefined && Date.now() - cached.at < CACHE_MS) return cached.value
    const running = this.inflight.get(sessionId)
    if (running !== undefined) return running
    const request = this.read(sessionId)
    this.inflight.set(sessionId, request)
    try {
      const value = await request
      // An absent summary is usually "not generated yet"; do not pin that
      // answer for the whole cache window.
      if (value !== undefined) this.cache.set(sessionId, { at: Date.now(), value })
      return value
    } finally {
      this.inflight.delete(sessionId)
    }
  }

  /** Read the stored summary, then ask the Host to build one for a live session. */
  private async read(sessionId: string): Promise<SessionTldr | undefined> {
    const stored = await this.fetch(sessionId, 'GET')
    return stored ?? this.fetch(sessionId, 'POST')
  }

  private async fetch(sessionId: string, method: 'GET' | 'POST'): Promise<SessionTldr | undefined> {
    const token = this.token().trim()
    if (token.length === 0) return undefined
    try {
      const response = await fetch(
        method === 'GET' ? `/totem/tldr?sessionId=${encodeURIComponent(sessionId)}` : '/totem/tldr',
        {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            ...method === 'POST' ? { 'content-type': 'application/json' } : {},
          },
          ...method === 'POST' ? { body: JSON.stringify({ sessionId }) } : {},
        },
      )
      if (!response.ok) return undefined
      const body = await response.json() as { tldr?: unknown; updatedAt?: unknown }
      if (typeof body.tldr !== 'string' || body.tldr.trim().length === 0) return undefined
      return {
        tldr: body.tldr,
        updatedAt: typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt) ? body.updatedAt : 0,
      }
    } catch {
      return undefined
    }
  }
}
