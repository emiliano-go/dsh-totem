/** Assistant settings section: memory browser, candidates, reminders, watches, notifications. */
import { useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AssistantFace, AssistantState, AssistantTab, LayaLocalizeResult } from './assistant-controller.ts'

const TABS: { id: AssistantTab; label: string }[] = [
  { id: 'memory', label: 'Memory' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'watches', label: 'Watches' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'laya', label: 'Laya' },
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
  const [narrow, setNarrow] = useState<{
    task: string
    diff: string
    loading: boolean
    error: string | null
    result: LayaLocalizeResult | null
  }>({ task: '', diff: '', loading: false, error: null, result: null })
  const [laya, setLaya] = useState({
    passThreshold: String(state.config.layaPassThreshold ?? 0.65),
    reviewBand: String(state.config.layaReviewBand ?? 0.05),
    vetoThreshold: String(state.config.layaVetoThreshold ?? 0.5),
    confidenceFloor: String(state.config.layaConfidenceFloor ?? 0),
    calibrationFile: state.config.layaCalibrationFile ?? '',
    maxRetries: String(state.config.layaMaxRetries ?? 1),
    timeoutMs: String(state.config.layaTimeoutMs ?? 60000),
    stepChecks: state.config.layaStepChecks ?? 'veto',
    stepCadence: state.config.layaStepCadence ?? 'turn',
    stepMaxFeedback: String(state.config.layaStepMaxFeedback ?? 2),
    verifyCommand: state.config.layaVerifyCommand ?? '',
    verifyExternal: state.config.layaVerifyExternal ?? 'off',
    verifyDisable: (state.config.layaVerifyDisable ?? []).join(', '),
    model: state.config.layaModel ?? '',
    device: state.config.layaDevice ?? 'auto',
    questionsFile: state.config.layaQuestionsFile ?? '',
  })
  const configKey = JSON.stringify(state.config)
  useEffect(() => {
    setDraft({
      ntfyUrl: state.config.ntfyUrl ?? 'https://ntfy.sh',
      ntfyTopic: state.config.ntfyTopic ?? '',
      ntfyToken: state.config.ntfyToken ?? '',
      telegramBotToken: state.config.telegramBotToken ?? '',
      telegramChatId: state.config.telegramChatId ?? '',
    })
    setLaya({
      passThreshold: String(state.config.layaPassThreshold ?? 0.65),
    reviewBand: String(state.config.layaReviewBand ?? 0.05),
    vetoThreshold: String(state.config.layaVetoThreshold ?? 0.5),
    confidenceFloor: String(state.config.layaConfidenceFloor ?? 0),
    calibrationFile: state.config.layaCalibrationFile ?? '',
      maxRetries: String(state.config.layaMaxRetries ?? 1),
      timeoutMs: String(state.config.layaTimeoutMs ?? 60000),
      stepChecks: state.config.layaStepChecks ?? 'veto',
      stepCadence: state.config.layaStepCadence ?? 'turn',
      stepMaxFeedback: String(state.config.layaStepMaxFeedback ?? 2),
      verifyCommand: state.config.layaVerifyCommand ?? '',
      verifyExternal: state.config.layaVerifyExternal ?? 'off',
      verifyDisable: (state.config.layaVerifyDisable ?? []).join(', '),
      model: state.config.layaModel ?? '',
      device: state.config.layaDevice ?? 'auto',
      questionsFile: state.config.layaQuestionsFile ?? '',
    })
  }, [configKey])

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

      {state.tab === 'laya'
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={MUTED}>The judge runs on finished turns at the configured threshold; the verify lane and step checks run before it. The composer switch starts/stops the server.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Pass threshold</span>
                <input style={FIELD} value={laya.passThreshold} onChange={event => { setLaya({ ...laya, passThreshold: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 140 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Retries / turn</span>
                <input style={FIELD} value={laya.maxRetries} onChange={event => { setLaya({ ...laya, maxRetries: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 170 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Request timeout (ms)</span>
                <input style={FIELD} value={laya.timeoutMs} onChange={event => { setLaya({ ...laya, timeoutMs: event.target.value }) }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Review band</span>
                <input style={FIELD} value={laya.reviewBand} onChange={event => { setLaya({ ...laya, reviewBand: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Veto threshold</span>
                <input style={FIELD} value={laya.vetoThreshold} onChange={event => { setLaya({ ...laya, vetoThreshold: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Confidence floor</span>
                <input style={FIELD} value={laya.confidenceFloor} onChange={event => { setLaya({ ...laya, confidenceFloor: event.target.value }) }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Step checks</span>
                <select style={FIELD} value={laya.stepChecks} onChange={event => { setLaya({ ...laya, stepChecks: event.target.value }) }}>
                  <option value="off">off</option>
                  <option value="veto">veto</option>
                  <option value="full">full</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Step cadence</span>
                <select style={FIELD} value={laya.stepCadence} onChange={event => { setLaya({ ...laya, stepCadence: event.target.value }) }}>
                  <option value="turn">turn</option>
                  <option value="tool">tool</option>
                  <option value="both">both</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Step feedback cap</span>
                <input style={FIELD} value={laya.stepMaxFeedback} onChange={event => { setLaya({ ...laya, stepMaxFeedback: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 150 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>External scanners</span>
                <select style={FIELD} value={laya.verifyExternal} onChange={event => { setLaya({ ...laya, verifyExternal: event.target.value }) }}>
                  <option value="off">off</option>
                  <option value="auto">auto</option>
                  <option value="on">on</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Verify command (optional)</span>
              <input style={FIELD} placeholder="pytest -q" value={laya.verifyCommand} onChange={event => { setLaya({ ...laya, verifyCommand: event.target.value }) }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Disabled rules (comma-separated)</span>
              <input style={FIELD} placeholder="external-semgrep, test-weakened" value={laya.verifyDisable} onChange={event => { setLaya({ ...laya, verifyDisable: event.target.value }) }} />
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 170 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Device</span>
                <select style={FIELD} value={laya.device} onChange={event => { setLaya({ ...laya, device: event.target.value }) }}>
                  <option value="auto">Auto (GPU first)</option>
                  <option value="cuda">CUDA / NVIDIA GPU</option>
                  <option value="mps">MPS / Apple GPU</option>
                  <option value="cpu">CPU / RAM</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Model path</span>
                <input style={FIELD} value={laya.model} onChange={event => { setLaya({ ...laya, model: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Questions file (optional)</span>
                <input style={FIELD} value={laya.questionsFile} onChange={event => { setLaya({ ...laya, questionsFile: event.target.value }) }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Calibration file (optional)</span>
                <input style={FIELD} placeholder=".encoder/decision.calibration.json" value={laya.calibrationFile} onChange={event => { setLaya({ ...laya, calibrationFile: event.target.value }) }} />
              </label>
            </div>
            <div style={ROW_ACTIONS}>
              <Button
                variant="primary"
                disabled={state.writing}
                onClick={() => {
                  props.saveLaya({
                    layaPassThreshold: Number(laya.passThreshold),
                    layaReviewBand: Number(laya.reviewBand),
                    layaVetoThreshold: Number(laya.vetoThreshold),
                    layaConfidenceFloor: Number(laya.confidenceFloor),
                    layaCalibrationFile: laya.calibrationFile,
                    layaMaxRetries: Number(laya.maxRetries),
                    layaTimeoutMs: Number(laya.timeoutMs),
                    layaStepChecks: laya.stepChecks,
                    layaStepCadence: laya.stepCadence,
                    layaStepMaxFeedback: Number(laya.stepMaxFeedback),
                    layaVerifyCommand: laya.verifyCommand,
                    layaVerifyExternal: laya.verifyExternal,
                    layaVerifyDisable: laya.verifyDisable.split(',').map(value => value.trim()).filter(Boolean),
                    layaModel: laya.model,
                    layaDevice: laya.device,
                    layaQuestionsFile: laya.questionsFile,
                  })
                }}
              >
                Save Laya settings
              </Button>
            </div>
            <div style={{ ...CARD, gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 13 }}>Narrow a diff</strong>
                <span style={MUTED}>Manual hunk ranking; never gates or steers.</span>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Task / bug description</span>
                <input
                  style={FIELD}
                  placeholder="What is wrong, or what should the change do?"
                  value={narrow.task}
                  onChange={event => { setNarrow({ ...narrow, task: event.target.value }) }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Unified diff</span>
                <textarea
                  style={{ ...FIELD, minHeight: 150, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  placeholder="Paste a unified diff, or load the last recorded turn diff."
                  value={narrow.diff}
                  onChange={event => { setNarrow({ ...narrow, diff: event.target.value }) }}
                />
              </label>
              <div style={ROW_ACTIONS}>
                <Button
                  variant="primary"
                  disabled={narrow.loading || narrow.task.trim().length === 0 || narrow.diff.trim().length === 0}
                  onClick={() => {
                    setNarrow({ ...narrow, loading: true, error: null, result: null })
                    void props.localize(narrow.task, narrow.diff)
                      .then(result => { setNarrow(current => ({ ...current, loading: false, result })) })
                      .catch((error: unknown) => {
                        setNarrow(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }))
                      })
                  }}
                >
                  {narrow.loading ? 'Ranking…' : 'Rank hunks'}
                </Button>
                <Button
                  variant="outline"
                  disabled={narrow.loading}
                  onClick={() => {
                    setNarrow({ ...narrow, loading: true, error: null, result: null })
                    void props.lastDiff()
                      .then(last => {
                        if (last === null) throw new Error('No recorded turn changes yet; paste a diff or enable Laya for one turn.')
                        setNarrow(current => ({ ...current, loading: false, task: last.task, diff: last.diff }))
                      })
                      .catch((error: unknown) => {
                        setNarrow(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }))
                      })
                  }}
                >
                  Use last turn diff
                </Button>
              </div>
              {narrow.error !== null ? <p style={{ ...MUTED, color: 'var(--dsw-alias-text-danger, #e06c75)' }}>{narrow.error}</p> : null}
              {narrow.result !== null
                ? narrow.result.hunks.length === 0
                  ? <p style={MUTED}>No hunks found in that diff.</p>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <p style={MUTED}>
                        {narrow.result.top === null ? 'No top hunk.' : `Top hunk: ${narrow.result.top}`}
                        {` · ${narrow.result.ms} ms`}
                      </p>
                      {narrow.result.hunks.map(hunk => (
                        <div key={hunk.index} style={{ borderTop: '1px solid var(--dsw-alias-border, #333)', paddingTop: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: 'monospace' }}>{hunk.header}</span>
                            <span>{Math.round(hunk.score * 1000) / 10}%</span>
                          </div>
                          <div style={{ ...MUTED, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {hunk.added.slice(0, 3).join('\n') || '(no added lines)'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                : null}
            </div>
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
    </div>
  )
}
