/**
 * Bridges the persisted unread marks to DSH's live `completionUnread` set.
 *
 * DSH owns the green dot: a session that finished while it was not the main view
 * is added to `completionUnread`, and opening it again removes it. This controller
 * restores the user's stored marks on load, persists new ones, and drops a mark
 * once the session runs again or is opened — the same lifecycle DSH applies to
 * the dot itself, so storage and screen never disagree.
 *
 * Storage is two-layer. The Host (`/totem/unread`) is authoritative so a mark
 * made on one device appears on the others; `localStorage` is the instant mirror
 * that survives reloads, offline starts, and a Host that is briefly unreachable.
 * Reconciliation happens on load, on window focus, and on a slow poll.
 *
 * @module dsh-totem/session-unread
 */
import { clearStored, defaultStorage, markStored, readUnread, writeUnread, type StorageLike, type UnreadRecord } from './unread-store.ts'
import type { UnreadRemote } from './unread-sync.ts'

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

/** Set once the local mirror has been reconciled with the Host at least once. */
export const UNREAD_SYNCED_KEY = 'dsh-totem:unread-synced'

/**
 * Restore, persist, and expire unread marks against the live session service.
 */
export class SessionUnreadController {
  /** Marks whose Host write has not been acknowledged yet. */
  private readonly pending = new Set<string>()
  /** Sessions with an in-flight Host clear, so a poll cannot duplicate it. */
  private readonly clearing = new Set<string>()
  /** Completion ids seen on the previous status pass, so only transitions track. */
  private readonly observedUnread = new Set<string>()
  /** Serializes sync runs (initial, focus, poll). */
  private syncing: Promise<void> | undefined

  constructor(
    private readonly session: UiSessionLike,
    private readonly storage?: StorageLike,
    private readonly remote?: UnreadRemote,
  ) {}

  /** Whether the session is the one the user is looking at. */
  isCurrent(sessionId: string): boolean {
    return currentKey(this.session) === sessionId
  }

  /**
   * Mark a session unread: persist locally, light the dot, then tell the Host.
   *
   * Returns `false` when there is nothing to mark (no id), so the caller can stay
   * silent instead of writing an empty record.
   */
  mark(sessionId: string): boolean {
    if (sessionId.length === 0) return false
    markStored(sessionId, this.storage)
    this.session.completionUnread.add(sessionId)
    this.session.publishStatus()
    if (this.remote === undefined) return true
    this.pending.add(sessionId)
    void this.pushMark(sessionId)
    return true
  }

  /**
   * Dismiss a session's unread mark without opening it.
   *
   * The mirror and the live dot are cleared first, then the Host is told so the
   * other devices drop it too.
   */
  clear(sessionId: string): boolean {
    if (sessionId.length === 0) return false
    clearStored(sessionId, this.storage)
    this.observedUnread.delete(sessionId)
    const changed = this.session.completionUnread.delete(sessionId)
    if (changed) this.session.publishStatus()
    if (this.remote !== undefined) void this.clearRemote([sessionId])
    return true
  }

  /** Write one pending mark; keep it pending when the Host is unreachable. */
  private async pushMark(sessionId: string): Promise<void> {
    const remote = this.remote
    if (remote === undefined) {
      this.pending.delete(sessionId)
      return
    }
    const items = await remote.mark(sessionId)
    if (items === undefined) return
    this.pending.delete(sessionId)
    this.apply(items)
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
   * Reconcile with the Host. Safe to call often: runs are serialized, and a
   * failure leaves the local mirror untouched.
   */
  sync(): Promise<void> {
    if (this.remote === undefined) return Promise.resolve()
    this.syncing ??= this.reconcile().finally(() => { this.syncing = undefined })
    return this.syncing
  }

  private async reconcile(): Promise<void> {
    const remote = this.remote
    if (remote === undefined) return
    // Callers normally omit `storage`; resolve the browser one here so the
    // one-time migration flag is written to the same mirror apply() maintains.
    const storage = this.storage ?? defaultStorage()
    // Retry marks the Host has not acknowledged yet before reading.
    for (const sessionId of [...this.pending]) await this.pushMark(sessionId)
    let items = await remote.list()
    if (items === undefined) return

    // One-time migration: before the Host store existed, marks lived only in
    // this browser. Push them up on the first successful sync, then let the Host
    // win forever after, so a clear on another device is not resurrected.
    if (storage?.getItem(UNREAD_SYNCED_KEY) !== '1') {
      const remoteIds = new Set(items.map(item => item.sessionId))
      for (const record of readUnread(storage)) {
        if (!remoteIds.has(record.sessionId)) await remote.mark(record.sessionId)
      }
      storage?.setItem(UNREAD_SYNCED_KEY, '1')
      items = await remote.list() ?? items
    }

    this.apply(items)
  }

  /** Make the live dot set and the local mirror match one authoritative list. */
  apply(items: readonly UnreadRecord[]): void {
    const statuses = this.session.sessionStatus.getSnapshot()
    const current = currentKey(this.session)
    const dead = new Set<string>()
    const live: UnreadRecord[] = []
    let changed = false

    for (const item of items) {
      const status = statuses.get(item.sessionId)
      if (status?.running === true || item.sessionId === current) {
        dead.add(item.sessionId)
        continue
      }
      live.push(item)
      if (!this.session.completionUnread.has(item.sessionId)) {
        this.session.completionUnread.add(item.sessionId)
        changed = true
      }
    }

    // A manual mark the Host no longer has was cleared elsewhere. Only ids in
    // the local mirror are considered: automatic completion dots set by DSH are
    // not part of the mirror and must be left alone.
    const remoteIds = new Set(live.map(item => item.sessionId))
    for (const record of readUnread(this.storage)) {
      if (remoteIds.has(record.sessionId) || this.pending.has(record.sessionId)) continue
      clearStored(record.sessionId, this.storage)
      if (this.session.completionUnread.delete(record.sessionId)) changed = true
    }

    // Keep unacknowledged marks in the mirror so a reload cannot lose them.
    for (const sessionId of this.pending) {
      if (!remoteIds.has(sessionId)) live.push({ sessionId, markedAt: Date.now() })
    }
    writeUnread(live, this.storage)
    if (changed) this.session.publishStatus()
    if (dead.size > 0) void this.clearRemote([...dead])
  }

  /** Clear marks on the Host (running or opened here), then re-apply its list. */
  private async clearRemote(sessionIds: readonly string[]): Promise<void> {
    const remote = this.remote
    if (remote === undefined) return
    const fresh = sessionIds.filter(id => !this.clearing.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) this.clearing.add(id)
    const items = await remote.clear(fresh)
    for (const id of fresh) this.clearing.delete(id)
    if (items !== undefined) this.apply(items)
  }

  /**
   * Follow the session service and drop marks that DSH would drop, on this
   * device and on the Host.
   * @returns a disposer for the subscription.
   */
  watch(): () => void {
    return this.session.sessionStatus.subscribe(() => {
      const statuses = this.session.sessionStatus.getSnapshot()
      const current = currentKey(this.session)
      const drop: string[] = []
      for (const record of readUnread(this.storage)) {
        const resumed = statuses.get(record.sessionId)?.running === true
        if (resumed || record.sessionId === current) {
          clearStored(record.sessionId, this.storage)
          drop.push(record.sessionId)
        }
      }
      if (drop.length > 0) void this.clearRemote(drop)

      // DSH raises the completion dot in the client that observed the turn
      // finish. Mirror that automatic mark to the Host as well, so a phone
      // that was not connected (or was not that Session's view) still sees it.
      const unread = new Set<string>()
      for (const [sessionId, status] of statuses) {
        if (status.completionUnread !== true) continue
        unread.add(sessionId)
        if (status.running === true || sessionId === current) continue
        // Only a transition: a dot still true from an earlier pass was either
        // already tracked or cleared on another device, and re-pushing it
        // every status event would resurrect a clear.
        if (!this.observedUnread.has(sessionId)) this.trackCompletion(sessionId)
      }
      this.observedUnread.clear()
      for (const sessionId of unread) this.observedUnread.add(sessionId)
    })
  }

  /**
   * Persist one automatic completion dot without lighting a second one.
   *
   * Skips ids already in the local mirror (our own Host sync and previous
   * tracks) and ids with an in-flight push, so the 20s sync and the status
   * subscription cannot stampede the Host.
   */
  private trackCompletion(sessionId: string): void {
    if (this.remote === undefined || this.pending.has(sessionId)) return
    if (readUnread(this.storage).some(record => record.sessionId === sessionId)) return
    markStored(sessionId, this.storage)
    this.pending.add(sessionId)
    void this.pushMark(sessionId)
  }
}
