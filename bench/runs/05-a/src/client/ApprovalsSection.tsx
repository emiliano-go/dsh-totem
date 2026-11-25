/** Approvals block on the Overview page: review release drafts and act on them. */
import { useEffect, useState } from 'react'
import { approvals, type ApprovalsState } from './approvals.ts'

const CARD: React.CSSProperties = {
  border: '1px solid var(--dsw-alias-border, #333)',
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const MUTED: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
}

const DRAFT: React.CSSProperties = { margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }

const ROW: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }

const BUTTON: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border, #3a3a3a)',
  background: 'var(--dsw-alias-bg-secondary, transparent)',
  color: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
}

const PRIMARY: React.CSSProperties = { ...BUTTON, borderColor: 'var(--dsw-alias-accent, #4b8bbe)' }

export function ApprovalsSection() {
  const [state, setState] = useState<ApprovalsState>(approvals.getState())
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [sending, setSending] = useState(false)

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
    try {
      await approvals.act(key, action)
    } finally {
      setBusy('')
    }
  }

  return (
    <section>
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
      {state.status !== 'error' && state.items.length === 0 && (
        <p style={MUTED}>Nothing waiting. New releases and the daily features digest land here.</p>
      )}
      {state.items.map((item) => (
        <div key={item.key} style={CARD}>
          <p style={MUTED}>
            {item.kind === 'features' ? 'Features digest' : 'Release'} · {item.repo}
            {item.attempts > 0 ? ` · re-drafted ${item.attempts}×` : ''}
          </p>
          <p style={DRAFT}>{item.draft}</p>
          {item.lastError ? <p style={{ ...MUTED, color: 'var(--dsw-alias-danger, #d06464)' }}>{item.lastError}</p> : null}
          <div style={ROW}>
            <button type="button" style={PRIMARY} disabled={busy === item.key} onClick={() => void act(item.key, 'ok')}>
              Post to X
            </button>
            <button type="button" style={BUTTON} disabled={busy === item.key} onClick={() => void act(item.key, 're')}>
              Re-draft
            </button>
            <button type="button" style={BUTTON} disabled={busy === item.key} onClick={() => void act(item.key, 'no')}>
              Skip
            </button>
            <a href={item.url} target="_blank" rel="noreferrer" style={{ ...MUTED, fontSize: 13 }}>
              open source
            </a>
          </div>
        </div>
      ))}
    </section>
  )
}
