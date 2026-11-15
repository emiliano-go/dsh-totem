/**
 * Custom in-chat view for the `decision_ask` tool.
 *
 * A registered `tool.call.toolview` replaces the generic tool row, so what the
 * judge returned is the row. The card opens by default and shows the prompt it
 * judged, the composite against the accept threshold, every criterion with its
 * meaning and distribution, and the evidence the judge found. While the call is
 * still running the card shows the task instead of a spinner row.
 *
 * @module dsh-totem/client/LayaToolView
 */
import { useEffect, useState } from 'react'
import {
  Answers,
  JsonView,
  LayaGlyph,
  PromptLine,
  ScoreMeter,
  clockLabel,
  installLayaStyles,
  latencyLabel,
  verdictColor,
  type LayaVerdict,
} from './laya-ui.tsx'

/** One content block of a settled tool result. */
interface ContentBlock {
  type?: string
  text?: string
}

/** The phases and block data the tool-view slot supplies, narrowed to what this card reads. */
export interface LayaToolViewProps {
  phase: 'preparing' | 'start' | 'result'
  block: {
    name?: string
    args?: { task?: unknown; answer?: unknown }
    argsRaw?: string
    content?: readonly ContentBlock[]
    isError?: boolean
    error?: { name?: string; message?: string }
    time?: number
    callTime?: number | null
  }
}

/** Concatenate the text blocks of a tool result. */
export function resultText(content: readonly ContentBlock[] | undefined): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('')
}

/** Parse the verdict object the tool returns, or undefined when it is not JSON. */
export function parseVerdict(text: string): LayaVerdict | undefined {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return undefined
  try {
    const value = JSON.parse(trimmed) as unknown
    return typeof value === 'object' && value !== null ? value as LayaVerdict : undefined
  } catch {
    return undefined
  }
}

/** The task text the model passed to the judge, for both states. */
export function taskOf(block: LayaToolViewProps['block']): string {
  const task = block.args?.task
  if (typeof task === 'string' && task.trim().length > 0) return task.trim()
  if (typeof block.argsRaw === 'string') {
    try {
      const parsed = JSON.parse(block.argsRaw) as { task?: unknown }
      if (typeof parsed.task === 'string') return parsed.task.trim()
    } catch {}
  }
  return ''
}

/**
 * Render one `decision_ask` call as a card.
 * @param props - the call phase and its stage-specific block.
 */
export function LayaToolView(props: LayaToolViewProps) {
  const [open, setOpen] = useState(true)
  useEffect(() => { installLayaStyles() }, [])

  const running = props.phase !== 'result'
  const task = taskOf(props.block)

  if (running) {
    return (
      <section className="laya-card" aria-label="Laya is judging this task">
        <div className="laya-head" data-static="true">
          <span className="laya-tile"><LayaGlyph /></span>
          <span className="laya-titles">
            <span className="laya-title">Laya is judging…</span>
            <span className="laya-stat">
              <span className="laya-numbers">
                <span>{task.length > 0 ? task.slice(0, 140) : 'advisory judge'}</span>
              </span>
            </span>
          </span>
        </div>
      </section>
    )
  }

  const failed = props.block.isError === true
  const text = resultText(props.block.content)
  const verdict = failed ? undefined : parseVerdict(text)
  const answers = verdict?.answers ?? {}
  const answerCount = Object.keys(answers).length
  const label = verdict?.verdict ?? (failed ? 'error' : 'unknown')
  const composite = typeof verdict?.composite === 'number' ? verdict.composite : undefined
  const margin = typeof verdict?.margin === 'number'
    ? `${verdict.margin >= 0 ? '+' : ''}${verdict.margin.toFixed(3)}`
    : ''
  const elapsed = typeof props.block.time === 'number' && typeof props.block.callTime === 'number'
    ? latencyLabel(props.block.time - props.block.callTime)
    : ''
  const vetoes = verdict?.vetoes ?? []
  const missing = verdict?.missing ?? []
  const findings = verdict?.findings ?? []
  const paths = verdict?.paths ?? []

  return (
    <section className="laya-card" aria-label="Laya judge result">
      <button
        type="button"
        className="laya-head"
        aria-expanded={open}
        aria-label={open ? 'Hide the judge result' : 'Show the judge result'}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className="laya-tile"><LayaGlyph /></span>
        <span className="laya-titles">
          <span className="laya-title">
            {failed ? 'Laya judge failed' : verdict === undefined ? 'Laya judge result' : 'Advisory judgement'}
          </span>
          <span className="laya-stat">
            <span className="laya-numbers">
              {verdict?.authoritative === false ? <span>advisory</span> : null}
              <span style={{ color: verdictColor(label), fontWeight: 600 }}>{label}</span>
              {composite === undefined ? null : <span>{`composite ${composite.toFixed(3)}`}</span>}
              {margin.length === 0 ? null : <span>margin {margin}</span>}
              {answerCount === 0 ? null : <span>{`${answerCount} answers`}</span>}
              {vetoes.length === 0 ? null : <span>{vetoes.join(', ')}</span>}
              {verdict?.reviewOnly === true ? <span>review only</span> : null}
              {elapsed.length === 0 ? null : <span>{elapsed}</span>}
              <span>{clockLabel(new Date(typeof props.block.time === 'number' ? props.block.time : Date.now()).toISOString())}</span>
            </span>
            <span className="laya-hint">{open ? 'Hide details' : 'Show details'}</span>
          </span>
        </span>
      </button>
      {open
        ? (
          <div className="laya-detail">
            {failed
              ? <div style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{props.block.error?.message ?? (text.slice(0, 400) || 'the judge call failed')}</div>
              : null}
            <PromptLine text={task} />
            {failed ? null : <ScoreMeter value={composite} threshold={verdict?.threshold} />}
            {failed
              ? null
              : vetoes.length > 0 && answerCount === 0
                ? <div className="laya-meaning">The deterministic verify lane blocked this before the judge was asked.</div>
                : <Answers answers={answers} />}
            {missing.length === 0
              ? null
              : <div>Missing criteria: <span className="laya-conf">{missing.join(', ')}</span></div>}
            {(verdict?.failures ?? []).length === 0
              ? null
              : (
                <div>
                  Failed criteria:{' '}
                  <span className="laya-conf">
                    {(verdict?.failures ?? []).map(failure => failure.key ?? failure.message ?? '?').join(', ')}
                  </span>
                </div>
              )}
            {vetoes.length === 0 ? null : <div>Vetoes: <span className="laya-conf">{vetoes.join(', ')}</span></div>}
            {findings.length === 0
              ? null
              : (
                <div className="laya-detailRow">
                  {findings.map((finding, index) => (
                    <span key={index} className="laya-tag" data-error={finding.severity === 'high'}>
                      {finding.rule ?? 'finding'}{finding.path === undefined ? '' : ` · ${finding.path}`}
                    </span>
                  ))}
                </div>
              )}
            {paths.length === 0
              ? null
              : <div>Files judged: <span className="laya-conf">{paths.slice(0, 8).join(' · ')}</span></div>}
            {verdict?.reviewOnly === true
              ? (
                <div className="laya-meaning">
                  No corrective message was sent: the judge reached this without evidence of a real
                  problem (marginal margin or answers under the confidence floor). Set
                  <code> layaSteerOnReview </code> to enforce it.
                </div>
              )
              : null}
            {verdict?.note === undefined ? null : <div className="laya-meaning">{verdict.note}</div>}
            <details>
              <summary style={{ cursor: 'pointer' }}>Raw response</summary>
              <div style={{ marginTop: 6 }}>
                <JsonView value={verdict ?? { result: text.slice(0, 2000) }} />
              </div>
            </details>
          </div>
        )
        : null}
      <button type="button" className="laya-toggle" onClick={() => { setOpen(value => !value) }}>
        <span>{open ? 'Hide details' : `Show what Laya returned${answerCount > 0 ? ` (${answerCount} answers)` : ''}`}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d={open ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  )
}
