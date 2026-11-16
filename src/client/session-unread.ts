/**
 * Bridges the persisted unread marks to DSH's live `completionUnread` set.
 *
 * DSH owns the green dot: a session that finished while it was not the main view
 * is added to `completionUnread`, and opening it again removes it. This controller
 * restores the user's stored marks on load, persists new ones, and drops a mark
 * once the session runs again or is opened — the same lifecycle DSH applies to
 * the dot itself, so storage and screen never disagree.
 *
 * @module dsh-totem/session-unread
 */
import { clearStored, markStored, readUnread, type StorageLike } from './unread-store.ts'

/** One status entry as published by the `uiSession` service. */
export interface SessionStatusLike {
  running?: boolean
  completionUnread?: boolean
}

/** The `uiSession` surface this controller needs. */
export interface UiSessionLike {
  completionUnread: Set<string>
  publishStatus: () => void
  current: {
    getSnapshot?: () => { key?: string } | undefined
    value?: { key?: string } | undefined
  }
  sessionStatus: {
    getSnapshot: () => Map<string, SessionStatusLike>
    subscribe: (listener: () => void) => () => void
  }
}

/** The session currently open in the main view, when known. */
export function currentKey(session: UiSessionLike): string | undefined {
  const snapshot = session.current.getSnapshot?.() ?? session.current.value
  return snapshot?.key
}

/**
 * Restore, persist, and expire unread marks against the live session service.
 */
export class SessionUnreadController {
  constructor(
    private readonly session: UiSessionLike,
    private readonly storage?: StorageLike,
  ) {}

  /** Whether the session is the one the user is looking at. */
  isCurrent(sessionId: string): boolean {
    return currentKey(this.session) === sessionId
  }

  /**
   * Mark a session unread: persist it, then light the dot.
   *
   * Returns `false` when there is nothing to mark (no id), so the caller can stay
   * silent instead of writing an empty record.
   */
  mark(sessionId: string): boolean {
    if (sessionId.length === 0) return false
    markStored(sessionId, this.storage)
    this.session.completionUnread.add(sessionId)
    this.session.publishStatus()
    return true
  }

  /**
   * Re-apply stored marks after a reload.
   *
   * A stored session that is already running, or that is now the open one, no
   * longer deserves the dot; its record is cleared instead of restored.
   */
  restore(): void {
    const statuses = this.session.sessionStatus.getSnapshot()
    const current = currentKey(this.session)
    let changed = false
    for (const record of readUnread(this.storage)) {
      const status = statuses.get(record.sessionId)
      if (status?.running === true || record.sessionId === current) {
        clearStored(record.sessionId, this.storage)
        continue
      }
      if (this.session.completionUnread.has(record.sessionId)) continue
      this.session.completionUnread.add(record.sessionId)
      changed = true
    }
    if (changed) this.session.publishStatus()
  }

  /**
   * Follow the session service and drop marks that DSH would drop.
   * @returns a disposer for the subscription.
   */
  watch(): () => void {
    return this.session.sessionStatus.subscribe(() => {
      const statuses = this.session.sessionStatus.getSnapshot()
      const current = currentKey(this.session)
      for (const record of readUnread(this.storage)) {
        const resumed = statuses.get(record.sessionId)?.running === true
        if (resumed || record.sessionId === current) clearStored(record.sessionId, this.storage)
      }
    })
  }
}
