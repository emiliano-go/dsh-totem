/** Assistant settings section: memory browser, candidates, reminders, watches, notifications. */
import { useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AssistantFace, AssistantState, AssistantTab } from './assistant-controller.ts'

const TABS: { id: AssistantTab; label: string }[] = [
  { id: 'memory', label: 'Memory' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'watches', label: 'Watches' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'verify', label: 'Verify' },
  { id: 'server', label: 'Server' },
]

const FIELD: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border, #3a3a3a)',
  background: 'var(--dsw-alias-bg-secondary, transparent)',
  color: 'inherit',
  fontSize: 13,
  boxSizing: 'border-box',
}

const MUTED: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
}

const CARD: React.CSSProperties = {
  border: '1px solid var(--dsw-alias-border, #333)',
  borderRadius: 8,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const ROW_ACTIONS: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }

/** Framework-derived props for the Assistant section. */
export type AssistantSectionProps = PropsRuntime<'settings.section'> & InjectFace<AssistantFace>

/**
 * Render the assistant settings section.
 * @param props - The section snapshot and its staged actions.
 */
export function AssistantSection(props: AssistantSectionProps) {
  const state = props.useAssistant(snapshot => snapshot)
  const [draft, setDraft] = useState({
    ntfyUrl: state.config.ntfyUrl ?? 'https://ntfy.sh',
    ntfyTopic: state.config.ntfyTopic ?? '',
    ntfyToken: state.config.ntfyToken ?? '',
    telegramBotToken: state.config.telegramBotToken ?? '',
    telegramChatId: state.config.telegramChatId ?? '',
  })
  const [watch, setWatch] = useState({ kind: 'page', url: '', condition: '', interval: '15' })
  const [verifyDraft, setVerifyDraft] = useState({ command: state.verifyCommand, disable: state.verifyDisable })
  const [confirmRestart, setConfirmRestart] = useState(false)
  useEffect(() => {
    setVerifyDraft({ command: state.verifyCommand, disable: state.verifyDisable })
  }, [state.verifyCommand, state.verifyDisable])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <Button
            key={tab.id}
            variant={state.tab === tab.id ? 'primary' : 'ghost'}
            onClick={() => { props.setTab(tab.id) }}
          >
            {tab.label}
          </Button>
        ))}
        <Button variant="ghost" onClick={props.refresh} disabled={state.status === 'loading'}>Refresh</Button>
      </div>

      {state.error === null ? null : <p style={{ ...MUTED, color: 'var(--dsw-alias-text-error, #e5484d)' }} role="status">{state.error}</p>}
      {state.notice === null ? null : <p style={MUTED} role="status">{state.notice}</p>}

      {state.tab === 'memory'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                style={{ ...FIELD, flex: '1 1 320px' }}
                value={state.project}
                placeholder="Project path (absolute)"
                onChange={event => { props.setProject(event.target.value) }}
              />
              <input
                style={{ ...FIELD, flex: '1 1 220px' }}
                value={state.query}
                placeholder="Search memory…"
                onChange={event => { props.setQuery(event.target.value) }}
                onKeyDown={event => { if (event.key === 'Enter') props.search() }}
              />
              <Button variant="outline" onClick={props.search} disabled={state.status === 'loading'}>Search</Button>
            </div>
            <p style={MUTED}>Searches the selected project's Totem store. Leave the query empty to list recent memories.</p>
            {state.memories.length === 0
              ? <p style={MUTED}>{state.status === 'loading' ? 'Loading…' : 'No memories.'}</p>
              : state.memories.map((item, index) => (
                <div key={item.id ?? `${index}`} style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {item.type === undefined ? '' : `[${item.type}] `}{item.title ?? item.id ?? ''}
                  </div>
                  <div style={{ fontSize: 13 }}>{item.statement ?? ''}</div>
                  {item.tags === undefined || item.tags.length === 0 ? null : <p style={MUTED}>{item.tags.join(' · ')}</p>}
                </div>
              ))}
          </div>
        )
        : null}

      {state.tab === 'candidates'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={MUTED}>Memories distilled from completed turns, waiting for approval. Approved items are written to the project's Totem store.</p>
            {state.candidates.length === 0
              ? <p style={MUTED}>{state.status === 'loading' ? 'Loading…' : 'No pending candidates.'}</p>
              : state.candidates.map(candidate => (
                <div key={candidate.id} style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>[{candidate.type}] {candidate.title}</div>
                  <div style={{ fontSize: 13 }}>{candidate.statement}</div>
                  <p style={MUTED}>{candidate.project} · {candidate.tags.join(' · ')}</p>
                  <div style={ROW_ACTIONS}>
                    <Button variant="primary" onClick={() => { props.approve(candidate.id) }} disabled={state.writing}>Approve</Button>
                    <Button variant="ghost" onClick={() => { props.reject(candidate.id) }} disabled={state.writing}>Reject</Button>
                  </div>
                </div>
              ))}
          </div>
        )
        : null}

      {state.tab === 'conflicts'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={MUTED}>Contradictions detected when a memory was written. Resolving one records a contradiction between the pair and, when you keep a side, supersedes the other memory.</p>
            {state.conflictSummary === null
              ? null
              : (
                <p style={MUTED}>
                  {state.conflictSummary.total} memories · {state.conflictSummary.durable} durable ·{' '}
                  {state.conflictSummary.staleItems} with stale evidence ({Math.round(state.conflictSummary.staleRatio * 100)}%)
                </p>
              )}
            {state.conflicts.length === 0
              ? <p style={MUTED}>{state.status === 'loading' ? 'Loading…' : 'No open conflicts.'}</p>
              : state.conflicts.map(conflict => (
                <div key={conflict.id} style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{conflict.condition || 'Conflicting claims'}</div>
                  <div style={{ fontSize: 13 }}>A: {conflict.claimA || conflict.itemA}</div>
                  <div style={{ fontSize: 13 }}>B: {conflict.claimB || conflict.itemB}</div>
                  <p style={MUTED}>{conflict.itemA.slice(0, 8)} · {conflict.itemB.slice(0, 8)} · {new Date(conflict.createdAt).toLocaleString()}</p>
                  <div style={ROW_ACTIONS}>
                    <Button variant="primary" onClick={() => { props.resolveConflict(conflict.id, 'keep-a') }} disabled={state.writing}>Keep A</Button>
                    <Button variant="primary" onClick={() => { props.resolveConflict(conflict.id, 'keep-b') }} disabled={state.writing}>Keep B</Button>
                    <Button variant="ghost" onClick={() => { props.resolveConflict(conflict.id, 'both') }} disabled={state.writing}>Keep both</Button>
                  </div>
                </div>
              ))}
          </div>
        )
        : null}

      {state.tab === 'reminders'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.reminders.length === 0
              ? <p style={MUTED}>{state.status === 'loading' ? 'Loading…' : 'No pending reminders. Ask the agent to remind you.'}</p>
              : state.reminders.map(reminder => (
                <div key={reminder.id} style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{reminder.text}</div>
                  <p style={MUTED}>{new Date(reminder.nextAt).toLocaleString()} · {reminder.recurrence}</p>
                  <div style={ROW_ACTIONS}>
                    <Button variant="outline" onClick={() => { props.snooze(reminder.id, 10) }} disabled={state.writing}>Snooze 10m</Button>
                    <Button variant="ghost" onClick={() => { props.doneReminder(reminder.id) }} disabled={state.writing}>Done</Button>
                    <Button variant="ghost" onClick={() => { props.cancelReminder(reminder.id) }} disabled={state.writing}>Cancel</Button>
                  </div>
                </div>
              ))}
          </div>
        )
        : null}

      {state.tab === 'watches'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...CARD, gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Add a watch</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  style={{ ...FIELD, width: 160 }}
                  value={watch.kind}
                  onChange={event => { setWatch({ ...watch, kind: event.target.value }) }}
                >
                  <option value="page">Page changes</option>
                  <option value="rss">Feed items</option>
                  <option value="condition">Condition</option>
                </select>
                <input style={{ ...FIELD, flex: '1 1 280px' }} placeholder="https://…" value={watch.url} onChange={event => { setWatch({ ...watch, url: event.target.value }) }} />
                <input style={{ ...FIELD, width: 110 }} placeholder="minutes" value={watch.interval} onChange={event => { setWatch({ ...watch, interval: event.target.value }) }} />
              </div>
              {watch.kind === 'condition'
                ? <input style={FIELD} placeholder="Condition (answered YES/NO)" value={watch.condition} onChange={event => { setWatch({ ...watch, condition: event.target.value }) }} />
                : null}
              <div>
                <Button
                  variant="primary"
                  disabled={state.writing || watch.url.trim().length === 0}
                  onClick={() => {
                    props.addWatch(watch)
                    setWatch({ kind: 'page', url: '', condition: '', interval: '15' })
                  }}
                >
                  Add watch
                </Button>
              </div>
            </div>
            {state.watches.length === 0
              ? <p style={MUTED}>{state.status === 'loading' ? 'Loading…' : 'No watches.'}</p>
              : state.watches.map(item => (
                <div key={item.id} style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.kind} · {item.url}</div>
                  <p style={MUTED}>
                    every {item.intervalMinutes}m · {item.active ? 'active' : 'stopped'}
                    {item.lastResult === undefined ? '' : ` · ${item.lastResult}`}
                    {item.condition === undefined ? '' : ` · ${item.condition}`}
                  </p>
                  <div style={ROW_ACTIONS}>
                    <Button variant="outline" onClick={() => { props.runWatch(item.id) }} disabled={state.writing}>Run now</Button>
                    {item.active ? <Button variant="ghost" onClick={() => { props.cancelWatch(item.id) }} disabled={state.writing}>Stop</Button> : null}
                  </div>
                </div>
              ))}
          </div>
        )
        : null}

      {state.tab === 'notifications'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={MUTED}>Reminders and watches deliver through ntfy and/or Telegram. Leave a channel empty to disable it.</p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>ntfy URL</span>
              <input style={FIELD} value={draft.ntfyUrl} onChange={event => { setDraft({ ...draft, ntfyUrl: event.target.value }) }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>ntfy topic</span>
              <input style={FIELD} value={draft.ntfyTopic} onChange={event => { setDraft({ ...draft, ntfyTopic: event.target.value }) }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>ntfy token (optional)</span>
              <input style={FIELD} type="password" value={draft.ntfyToken} onChange={event => { setDraft({ ...draft, ntfyToken: event.target.value }) }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Telegram bot token</span>
              <input style={FIELD} type="password" value={draft.telegramBotToken} onChange={event => { setDraft({ ...draft, telegramBotToken: event.target.value }) }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Telegram chat id</span>
              <input style={FIELD} value={draft.telegramChatId} onChange={event => { setDraft({ ...draft, telegramChatId: event.target.value }) }} />
            </label>
            <div style={ROW_ACTIONS}>
              <Button variant="primary" onClick={() => { props.saveConfig(draft) }} disabled={state.writing}>Save</Button>
              <Button variant="outline" onClick={props.testNotification} disabled={state.writing}>Send test</Button>
            </div>
          </div>
        )
        : null}

      {state.tab === 'verify'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={MUTED}>
              Deterministic rules run at the end of every turn and warn only: a finding is reported in the
              turn card, never enforced. No model is involved.
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Verify command (optional, run once per turn)</span>
              <input
                style={FIELD}
                value={verifyDraft.command}
                placeholder="e.g. bun test"
                onChange={event => { setVerifyDraft({ ...verifyDraft, command: event.target.value }) }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Disabled rules (comma separated ids)</span>
              <input
                style={FIELD}
                value={verifyDraft.disable}
                placeholder="e.g. debug-breakpoint"
                onChange={event => { setVerifyDraft({ ...verifyDraft, disable: event.target.value }) }}
              />
            </label>
            <div style={ROW_ACTIONS}>
              <Button variant="primary" onClick={() => { props.saveVerify(verifyDraft.command, verifyDraft.disable) }} disabled={state.writing}>Save</Button>
            </div>
            <p style={MUTED}>{state.verifyRules.length} rule(s) active.</p>
            {state.verifyRules.map(rule => (
              <div key={rule.id} style={CARD}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  <code style={{ fontSize: 12 }}>{rule.id}</code> · <span style={{ fontSize: 11, color: rule.severity === 'high' ? 'var(--dsw-alias-state-error-primary, #e5484d)' : 'var(--dsw-alias-text-secondary, #9a9a9a)' }}>{rule.severity}</span>
                </div>
                <div style={{ fontSize: 13 }}>{rule.description}</div>
              </div>
            ))}
          </div>
        )
        : null}

      {state.tab === 'server'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={MUTED}>
              Restarts the DSH host that serves this page. The session survives and this page reloads
              as soon as the replacement answers. A restart pressed during a turn waits for that turn
              to finish, so nothing is cut in half.
            </p>
            <div style={CARD}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Host</span>
              <span style={MUTED}>
                pid {state.host?.pid ?? '—'} · {state.host?.busy === true ? 'a turn is running' : 'idle'}
              </span>
              <span style={MUTED}>
                launcher: {state.host?.launcher ?? 'not found (set restartCommand)'}
              </span>
            </div>
            <div style={{ ...ROW_ACTIONS, alignItems: 'stretch' }}>
              <Button
                variant="primary"
                style={{ minHeight: 44, flex: '1 1 220px' }}
                disabled={state.restarting || state.host?.launcher === null}
                onClick={() => {
                  if (confirmRestart) {
                    setConfirmRestart(false)
                    props.restartServer()
                    return
                  }
                  setConfirmRestart(true)
                }}
              >
                {state.restarting
                  ? state.restartMessage ?? 'Restarting…'
                  : confirmRestart ? 'Tap again to restart' : 'Restart DSH server'}
              </Button>
              {confirmRestart && !state.restarting
                ? (
                  <Button
                    variant="ghost"
                    style={{ minHeight: 44 }}
                    onClick={() => { setConfirmRestart(false) }}
                  >
                    Cancel
                  </Button>
                )
                : null}
            </div>
            {confirmRestart && !state.restarting
              ? <p style={MUTED}>The page disconnects for a few seconds and reloads itself.</p>
              : null}
            {state.restartMessage !== null && !state.restarting
              ? <p style={MUTED}>{state.restartMessage}</p>
              : null}
          </div>
        )
        : null}
    </div>
  )
}
