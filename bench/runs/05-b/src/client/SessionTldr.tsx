/**
 * Hover-card TLDR for one session.
 *
 * Registered under `sidebar.session.row.hover`, which the workspace browser
 * renders inside the session hover card after the path and relative time. The
 * component mounts only while that card is open, so the read costs nothing
 * until the user actually hovers.
 *
 * @module dsh-totem/client/SessionTldr
 */
import { useEffect, useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionTldr as SessionTldrValue } from './tldr.ts'

/** Face injected into the hover card. */
export interface SessionTldrFace {
  load: (sessionId: string) => Promise<SessionTldrValue | undefined>
}

/** Props supplied by the hover slot plus the injected reader. */
export type SessionTldrProps = { sessionId: string } & InjectFace<SessionTldrFace>

const WRAP = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginTop: 6,
  maxWidth: '100%',
} as const

const LABEL = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  // The session hover card is always dark, so it cannot inherit the page's
  // theme colors: those resolve to the sidebar's muted label and disappear.
  color: '#aab0b5',
} as const

const TEXT = {
  fontSize: 12,
  lineHeight: 1.5,
  color: '#d6dade',
  overflowWrap: 'break-word',
} as const

/**
 * Render the stored summary, or nothing while it is absent.
 * @param props - session id from the slot plus the lazy loader.
 * @returns the TLDR block or null.
 */
export function SessionTldr(props: SessionTldrProps) {
  const [value, setValue] = useState<SessionTldrValue | undefined>(undefined)
  useEffect(() => {
    let live = true
    void props.load(props.sessionId).then((next) => {
      if (live) setValue(next)
    })
    return () => { live = false }
  }, [props.sessionId])
  if (value === undefined) return null
  return (
    <div style={WRAP} data-totem-tldr="">
      <span style={LABEL}>TLDR</span>
      <span style={TEXT}>{value.tldr}</span>
    </div>
  )
}
