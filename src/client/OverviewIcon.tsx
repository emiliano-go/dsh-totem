/** Sidebar glyph for the token-usage Overview panel. */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render three ascending bars at the sidebar's requested size.
 * @param props - the sidebar icon share.
 */
export function OverviewIcon({ size = 18 }: PropsRuntime<'sidebar.panellist'>) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="9.5" width="2.6" height="5" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="6.7" y="5.5" width="2.6" height="9" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="11.9" y="1.5" width="2.6" height="13" rx="1" fill="currentColor" />
    </svg>
  )
}
