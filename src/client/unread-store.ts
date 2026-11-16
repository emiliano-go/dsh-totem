/**
 * Persistence for "Mark as unread".
 *
 * The green dot is browser state, so its marks are stored in the browser too:
 * a small JSON map in `localStorage`. Marks survive reloads and browser
 * restarts, and never leave the machine.
 *
 * The store is deliberately dumb — it records ids and timestamps and prunes old
 * entries. Deciding when a mark stops being valid (the session ran again, or was
 * opened) belongs to the controller that owns the live status.
 *
 * @module dsh-totem/unread-store
 */

/** One session the user marked unread. */
export interface UnreadRecord {
  sessionId: string
  /** Epoch milliseconds of the last mark, newest last. */
  markedAt: number
}

/** The slice of `Storage` this module needs, so tests can pass a map-backed fake. */
export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** Storage key shared by every session. */
export const UNREAD_KEY = 'dsh-totem:unread-sessions'

/** Marks older than this are dropped on read. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Browser storage when available, otherwise `undefined` (tests, SSR). */
function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** Read the persisted marks, newest first, dropping anything unreadable. */
export function readUnread(storage: StorageLike | undefined = defaultStorage()): UnreadRecord[] {
  if (storage === undefined) return []
  let parsed: unknown
  try {
    const raw = storage.getItem(UNREAD_KEY)
    parsed = raw === null ? undefined : JSON.parse(raw) as unknown
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const now = Date.now()
  const seen = new Set<string>()
  const records: UnreadRecord[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as { sessionId?: unknown; markedAt?: unknown }
    if (typeof record.sessionId !== 'string' || record.sessionId.length === 0) continue
    const markedAt = typeof record.markedAt === 'number' && Number.isFinite(record.markedAt) ? record.markedAt : now
    if (now - markedAt > MAX_AGE_MS || seen.has(record.sessionId)) continue
    seen.add(record.sessionId)
    records.push({ sessionId: record.sessionId, markedAt })
  }
  return records.sort((left, right) => right.markedAt - left.markedAt)
}

/** Write the marks back, newest first. */
export function writeUnread(records: readonly UnreadRecord[], storage: StorageLike | undefined = defaultStorage()): void {
  if (storage === undefined) return
  try {
    storage.setItem(UNREAD_KEY, JSON.stringify(records))
  } catch {
    // A full or disabled storage must not break the action; the dot is already set.
  }
}

/** Replace or insert one mark, keeping the list newest first and deduplicated. */
export function withMark(records: readonly UnreadRecord[], sessionId: string, markedAt = Date.now()): UnreadRecord[] {
  const rest = records.filter(record => record.sessionId !== sessionId)
  return [{ sessionId, markedAt }, ...rest].sort((left, right) => right.markedAt - left.markedAt)
}

/** Remove one mark. */
export function withoutMark(records: readonly UnreadRecord[], sessionId: string): UnreadRecord[] {
  return records.filter(record => record.sessionId !== sessionId)
}

/**
 * Mark one session unread in storage.
 * @returns the persisted records after the change.
 */
export function markStored(sessionId: string, storage?: StorageLike): UnreadRecord[] {
  const records = withMark(readUnread(storage), sessionId)
  writeUnread(records, storage)
  return records
}

/** Clear one session's stored mark. */
export function clearStored(sessionId: string, storage?: StorageLike): UnreadRecord[] {
  const records = withoutMark(readUnread(storage), sessionId)
  writeUnread(records, storage)
  return records
}

/** Whether a session currently has a stored mark. */
export function isStoredUnread(sessionId: string, storage?: StorageLike): boolean {
  return readUnread(storage).some(record => record.sessionId === sessionId)
}
