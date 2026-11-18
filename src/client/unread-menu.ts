/**
 * "Mark as unread" as a native session menu action.
 *
 * The action used to live in the row's hover strip, which is hidden entirely on
 * touch (`@media (hover:none)` drops non-pinned quick actions), so the button
 * effectively did not exist on phones or tablets. The `...` menu is rendered on
 * every input modality, so the action belongs there.
 *
 * Pure decision logic, kept out of the component so it is testable without a
 * browser: the caller supplies the live status lookups and the marker.
 *
 * @module dsh-totem/client/unread-menu
 */

/** One session status entry as published by the `uiSession` service. */
export interface UnreadStatusLike {
  running?: boolean
  completionUnread?: boolean
}

/** The menu action shape the context-menu registry accepts. */
export interface UnreadMenuAction {
  id: string
  label: string
  icon?: { key: string }
  run: () => void
}

/** Registry surface this contribution needs, structurally typed. */
export interface ContextMenusLike {
  register: (contribution: {
    id: string
    target: 'session'
    order: number
    observe?: (target: { sessionId: string; displayTitle: string }) => readonly unknown[]
    resolve: (target: { sessionId: string; displayTitle: string }) => readonly UnreadMenuAction[]
  }) => () => void
}

/** Live lookups the action resolves against when the menu opens. */
export interface UnreadMenuDeps {
  /** Whether this session is the one currently open in the main view. */
  isCurrent: (sessionId: string) => boolean
  /** Current status for a session, when known. */
  statusOf: (sessionId: string) => UnreadStatusLike | undefined
  /** Re-add the session to the completion-unread set. */
  mark: (sessionId: string) => boolean
  /** Clear the session's unread mark without opening it. */
  clear: (sessionId: string) => boolean
}

/** Menu order: after fork (300), before the session-id separator (450). */
export const UNREAD_MENU_ORDER = 350

/**
 * Resolve the actions for one captured session target.
 *
 * The open session would have its mark cleared immediately, so it gets no
 * action. An already-unread session gets the inverse action — "Mark as read"
 * dismisses the dot without opening the session — so the `...` menu always
 * exposes an unread control for every other row.
 */
export function unreadMenuActions(
  target: { sessionId: string; displayTitle?: string },
  deps: UnreadMenuDeps,
): UnreadMenuAction[] {
  const { sessionId } = target
  if (sessionId.length === 0) return []
  if (deps.isCurrent(sessionId)) return []
  const status = deps.statusOf(sessionId)
  if (status?.completionUnread === true) {
    return [{
      id: 'totem-read',
      label: 'Mark as read',
      icon: { key: 'totem.unread' },
      run: () => { deps.clear(sessionId) },
    }]
  }
  return [{
    id: 'totem-unread',
    label: 'Mark as unread',
    icon: { key: 'totem.unread' },
    run: () => { deps.mark(sessionId) },
  }]
}
