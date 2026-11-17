/**
 * Menu icon for the "Mark as unread" session action.
 *
 * Registered under the `contextMenu.icon` keyed slot as `totem.unread`; the
 * Menu renderer resolves `icon: { key: 'totem.unread' }` through it. The glyph
 * reuses the old row button's mark (outlined circle with a filled centre).
 *
 * @module dsh-totem/client/SessionUnreadIcon
 */

/** Keyed icon rendered in the session "..." menu. */
export function SessionUnreadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </svg>
  )
}
