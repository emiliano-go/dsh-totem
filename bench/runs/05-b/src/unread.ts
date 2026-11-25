/**
 * Host-side store for "Mark as unread".
 *
 * The green dot is browser state, but the *intent* ("I want to come back to
 * this") belongs to the user, not one browser profile. This store is the shared
 * source of truth: the client mirrors it into localStorage for instant reloads
 * and offline starts, and reconciles against it on load, on focus, and on a slow
 * poll so a mark set on the phone shows up on the desktop.
 *
 * One JSON document under the DSH state directory, written through
 * `JsonStore`'s serialized read-modify-write so concurrent requests cannot tear
 * the file. Marks expire after 30 days and the document is capped so an
 * abandoned browser cannot grow it without bound.
 *
 * @module dsh-totem/unread
 */
import { JsonStore, statePath } from './store.ts'

/** One session the user marked unread. */
export interface UnreadMark {
  sessionId: string
  /** Epoch milliseconds of the last mark, newest first in `list()`. */
  markedAt: number
}

interface UnreadDocument {
  version: 1
  /** Session id to epoch milliseconds. */
  marks: Record<string, number>
}

/** Marks older than this are dropped on every read and write. */
export const UNREAD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Upper bound on stored marks; oldest are dropped first. */
export const UNREAD_MAX_MARKS = 500

/** Longest session id accepted; DSH ids are far shorter. */
const MAX_ID_LENGTH = 200

const INITIAL: UnreadDocument = { version: 1, marks: {} }

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

/** Prune expired entries and cap the document, keeping the newest. */
function normalize(document: UnreadDocument, now: number): UnreadDocument {
  const entries = Object.entries(document?.marks ?? {})
    .filter(([id, at]) => validId(id) && typeof at === 'number' && Number.isFinite(at) && now - at <= UNREAD_MAX_AGE_MS)
    .sort((left, right) => right[1] - left[1])
    .slice(0, UNREAD_MAX_MARKS)
  return { version: 1, marks: Object.fromEntries(entries) }
}

/** Sort the document into the newest-first list the API returns. */
function listOf(document: UnreadDocument): UnreadMark[] {
  return Object.entries(document.marks)
    .map(([sessionId, markedAt]) => ({ sessionId, markedAt }))
    .sort((left, right) => right.markedAt - left.markedAt)
}

/** Shared, last-write-wins unread marks for one Host. */
export class UnreadStore {
  private readonly store: JsonStore<UnreadDocument>

  constructor(path = statePath('unread.json')) {
    this.store = new JsonStore<UnreadDocument>(path, INITIAL)
  }

  /** Current marks, newest first, with expired entries filtered out. */
  async list(now = Date.now()): Promise<UnreadMark[]> {
    return listOf(normalize(await this.store.read(), now))
  }

  /** Add or refresh one mark and return the resulting list. */
  async mark(sessionId: unknown, now = Date.now()): Promise<UnreadMark[]> {
    if (!validId(sessionId)) return this.list(now)
    const next = await this.store.update((current) => {
      const normalized = normalize(current, now)
      return normalize({ version: 1, marks: { ...normalized.marks, [sessionId]: now } }, now)
    })
    return listOf(next)
  }

  /** Remove marks for the given sessions and return the resulting list. */
  async clear(sessionIds: readonly unknown[], now = Date.now()): Promise<UnreadMark[]> {
    const drop = new Set(sessionIds.filter(validId))
    if (drop.size === 0) return this.list(now)
    const next = await this.store.update((current) => {
      const normalized = normalize(current, now)
      for (const id of drop) delete normalized.marks[id]
      return normalize(normalized, now)
    })
    return listOf(next)
  }
}
