/**
 * "Mark as unread" row action for the session list.
 *
 * DSH shows a green "done" dot on a session whose turn finished while it was not
 * the main view. That dot lives in the browser's `uiSession` service, which
 * clears it when the session is opened. There is no built-in way to put it back,
 * so this registers an action in the same hover strip as archive and pin and
 * re-adds the session to the completion-unread set.
 *
 * The set is client-side and in-memory: the mark lasts for the page's lifetime,
 * exactly like the dot it restores.
 *
 * @module dsh-totem/SessionUnreadAction
 */

/** Session status as published by the `uiSession` service. */
export interface SessionStatus {
  running?: boolean
  completionUnread?: boolean
}

/** Props supplied by the session row action slot. */
export interface SessionUnreadActionProps {
  /** Session the row represents; the slot passes it for every action. */
  sessionId?: string
  /** Row title, unused but part of the slot's occurrence props. */
  displayTitle?: string
  /** Restore the green "done" dot by re-marking the session unread. */
  markUnread?: (sessionId: string) => void
  /** Whether this row is the session currently open in the main view. */
  isCurrent?: (sessionId: string) => boolean
  /** Root hook over the session status map. */
  useSessionStatus?: (selector: (statuses: Map<string, SessionStatus>) => SessionStatus | undefined) => SessionStatus | undefined
}

const CSS_ID = 'dsh-totem-session-unread-css'

/** Install the action's stylesheet once per document. */
export function installSessionUnreadStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(CSS_ID) !== null) return
  const style = document.createElement('style')
  style.id = CSS_ID
  style.textContent = `
.totem-unread-action{display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.totem-unread-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.totem-unread-action:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color)}
`
  document.head.append(style)
}

function noStatus(): undefined {
  return undefined
}

/**
 * One row action: visible for a finished session that is not already unread.
 *
 * A running session cannot be unread (it is producing output right now), and one
 * that already carries the dot has nothing to restore, so both render nothing.
 */
export function SessionUnreadAction(props: SessionUnreadActionProps) {
  const { sessionId, markUnread } = props
  // The hook has to run on every render even when the id is missing, so the
  // guard lives in the selector rather than before the call.
  const useStatus = props.useSessionStatus ?? noStatus
  const status = useStatus(statuses => (sessionId === undefined ? undefined : statuses.get(sessionId)))
  if (sessionId === undefined || markUnread === undefined) return null
  // Marking the open session would be cleared by DSH's own reconcile, so the row
  // offers nothing there.
  if (props.isCurrent?.(sessionId) === true) return null
  if (status?.running === true) return null
  if (status?.completionUnread === true) return null
  return (
    <button
      type="button"
      className="totem-unread-action"
      title="Mark as unread"
      aria-label="Mark as unread"
      onClick={(event: { preventDefault?: () => void; stopPropagation?: () => void }) => {
        event.preventDefault?.()
        event.stopPropagation?.()
        markUnread(sessionId)
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2.2" fill="currentColor" />
      </svg>
    </button>
  )
}
