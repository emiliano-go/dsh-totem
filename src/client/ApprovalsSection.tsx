/** Approvals block on the Overview page: review release drafts and act on them. */
import { useEffect, useState } from 'react'
import { approvals, type ApprovalItem, type ApprovalsState } from './approvals.ts'

const HAIRLINE = 'color-mix(in oklab, currentColor 14%, transparent)'
const FIELD = 'color-mix(in oklab, currentColor 5%, transparent)'

const SURFACE = 'color-mix(in oklab, currentColor 4%, transparent)'

const CARD: React.CSSProperties = {
  background: SURFACE,
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const QUEUED_CARD: React.CSSProperties = { ...CARD, opacity: 0.72, borderStyle: 'dashed' }

const MUTED: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
}

const GROUP: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
}

const DRAFT: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }

const ROW: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }

const BUTTON: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 6,
  border: `1px solid ${HAIRLINE}`,
  background: FIELD,
  color: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
}

const PRIMARY: React.CSSProperties = { ...BUTTON, borderColor: 'var(--dsw-alias-accent, #4b8bbe)', background: 'color-mix(in oklab, var(--dsw-alias-accent, #4b8bbe) 18%, transparent)' }

const CHIP: React.CSSProperties = {
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 11,
  border: `1px solid ${HAIRLINE}`,
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
}

export function ApprovalsSection() {
  const [state, setState] = useState<ApprovalsState>(approvals.getState())
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  // Keys approved in this session, so the card moves groups before the poll catches up.
  const [queuedHere, setQueuedHere] = useState<string[]>([])
  // Skipped cards leave immediately; re-drafted ones stay covered until the new text lands.
  const [hidden, setHidden] = useState<string[]>([])
  const [redrafting, setRedrafting] = useState<Record<string, number>>({})

  useEffect(() => {
    setRedrafting((current) => {
      const next: Record<string, number> = {}
      let changed = false
      for (const [key, attempts] of Object.entries(current)) {
        const item = state.items.find((entry) => entry.key === key)
        if (item && item.attempts <= attempts) next[key] = attempts
        else changed = true
      }
      return changed ? next : current
    })
  }, [state.items])

  useEffect(() => approvals.subscribe(setState), [])

  const enqueue = async (): Promise<void> => {
    if (note.trim().length < 12 || sending) return
    setSending(true)
    try {
      const ok = await approvals.enqueue(note.trim(), link.trim())
      if (ok) {
        setNote('')
        setLink('')
      }
    } finally {
      setSending(false)
    }
  }

  const act = async (key: string, action: 'ok' | 're' | 'no'): Promise<void> => {
    setBusy(key)
    setNotice('')
    const attempts = state.items.find((entry) => entry.key === key)?.attempts ?? 0
    try {
      const ok = await approvals.act(key, action)
      if (ok && action === 'ok') setQueuedHere((keys) => (keys.includes(key) ? keys : [...keys, key]))
      if (ok && action === 'no') setHidden((keys) => (keys.includes(key) ? keys : [...keys, key]))
      if (ok && action === 're') setRedrafting((map) => ({ ...map, [key]: attempts }))
      setNotice(
        ok
          ? action === 'ok'
            ? 'Approved. It moves to the publish queue and goes out in its own time slot.'
            : action === 're'
              ? 'Re-drafted. The new version is above.'
              : 'Skipped.'
          : 'That request failed. The message above has the reason.',
      )
    } finally {
      setBusy('')
    }
  }

  const isQueued = (item: ApprovalItem): boolean => Boolean(item.queued) || queuedHere.includes(item.key)
  const waiting = state.items.filter((item) => !isQueued(item) && !hidden.includes(item.key))
  const scheduled = state.items.filter(isQueued)

  const card = (item: ApprovalItem, locked: boolean) => {
    const spinning = !locked && redrafting[item.key] !== undefined
    return (
    <div key={item.key} style={{ position: 'relative' }}>
      <div style={locked ? QUEUED_CARD : CARD}>
      <div style={{ ...ROW, justifyContent: 'space-between' }}>
        <p style={MUTED}>
          {item.kind === 'features' ? 'Features digest' : 'Release'} · {item.repo}
          {item.attempts > 0 ? ` · re-drafted ${item.attempts}×` : ''}
        </p>
        {locked ? <span style={CHIP}>{busy === item.key ? 'Publishing…' : 'Queued'}</span> : null}
      </div>
      <p style={DRAFT}>{item.tweetText || item.draft}</p>
      {item.lastError ? <p style={{ ...MUTED, color: 'var(--dsw-alias-danger, #d06464)' }}>{item.lastError}</p> : null}
      <div style={ROW}>
        {locked ? (
          <span style={MUTED}>Waiting for its slot. Nothing else to do.</span>
        ) : (
          <>
            <button type="button" style={PRIMARY} disabled={busy === item.key} onClick={() => void act(item.key, 'ok')}>
              Post to X
            </button>
            <button type="button" style={BUTTON} disabled={busy === item.key} onClick={() => void act(item.key, 're')}>
              Re-draft
            </button>
            <button type="button" style={BUTTON} disabled={busy === item.key} onClick={() => void act(item.key, 'no')}>
              Skip
            </button>
          </>
        )}
        <a href={item.url} target="_blank" rel="noreferrer" style={{ ...MUTED, fontSize: 13 }}>
          open source
        </a>
      </div>
      </div>
      {spinning ? (
        <div className="totem-pending-overlay">
          <div className="totem-spinner" />
          <span style={{ ...MUTED, fontSize: 11 }}>Re-drafting</span>
        </div>
      ) : null}
    </div>
    )
  }

  return (
    <section>
      <style>{`
        @keyframes totem-spin { to { transform: rotate(360deg); } }
        .totem-pending-overlay {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(10, 10, 10, 0.55);
          backdrop-filter: blur(2.5px);
        }
        .totem-spinner {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-top-color: #fff;
          animation: totem-spin 0.8s linear infinite;
        }
      `}</style>
      <div style={{ ...ROW, justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Approvals</h2>
        <button type="button" style={BUTTON} onClick={() => void approvals.refresh()}>Refresh</button>
      </div>
      <p style={{ ...MUTED, marginBottom: 10 }}>
        Drafts waiting for a decision. Approving posts to X; the tracker picks the action up within two minutes.
      </p>
      <div style={{ ...CARD, marginBottom: 16 }}>
        <p style={MUTED}>Something you shipped that the tracker does not watch? Write it here and it gets drafted for approval.</p>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What did you make? One or two sentences is enough."
          rows={3}
          style={{ ...BUTTON, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="Link (optional)"
          style={{ ...BUTTON, padding: '7px 10px', fontFamily: 'inherit' }}
        />
        <div style={ROW}>
          <button
            type="button"
            style={PRIMARY}
            disabled={sending || note.trim().length < 12}
            onClick={() => void enqueue()}
          >
            {sending ? 'Drafting…' : 'Draft and queue'}
          </button>
          <span style={MUTED}>{note.trim().length} characters</span>
        </div>
      </div>
      {state.status === 'error' && <p style={{ ...MUTED, color: 'var(--dsw-alias-danger, #d06464)' }}>{state.error}</p>}
      {notice.length > 0 && <p style={MUTED}>{notice}</p>}
      {state.status !== 'error' && state.items.length === 0 && (
        <p style={MUTED}>Nothing waiting. New releases and the features digest land here.</p>
      )}
      {waiting.length > 0 && <p style={GROUP}>Waiting for you</p>}
      {waiting.map((item) => card(item, false))}
      {scheduled.length > 0 && (
        <>
          <p style={{ ...GROUP, marginTop: 16 }}>Queued to publish</p>
          {scheduled.map((item) => card(item, true))}
        </>
      )}
    </section>
  )
}
