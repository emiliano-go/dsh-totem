/**
 * In-chat card for the Laya judge, one per completed turn.
 *
 * The card sits in the turn tail — the block the Harness renders before a
 * turn's action row — rather than among the 28px message icon actions, so it
 * gets the same full-width treatment as the native changed-files card and is
 * never hidden behind a hover reveal. Every recorded call for the turn is
 * listed: deterministic vetoes, step checks, and the final decision.
 *
 * @module dsh-totem/client/LayaTurnCard
 */
import { useEffect, useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { callKindLabel, changedPaths, type LayaCall } from './laya-calls.ts'
import { turnNumberOf, turnStatusOf } from './turn.ts'
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
} from './laya-ui.tsx'

/** Face injected into the card. */
export interface LayaTurnCardFace {
  lookupTurn: (turn: number) => Promise<LayaCall[]>
  lookupDetail: (id: number) => Promise<LayaCall | undefined>
}

/** Props supplied by the turn tail slot plus the injected lookup. */
export type LayaTurnCardProps = { turn: number | { turn?: number }; seq?: number } & InjectFace<LayaTurnCardFace>



/** One call rendered as a native-style row with an expandable detail block. */
function CallRow({ call, defaultOpen, loadDetail }: {
  call: LayaCall
  defaultOpen?: boolean
  loadDetail: (id: number) => Promise<LayaCall | undefined>
}) {
  const [open, setOpen] = useState(defaultOpen === true)
  const [detail, setDetail] = useState<LayaCall | undefined>(undefined)
  // The list response is slim, so the request state arrives on first expand.
  useEffect(() => {
    if (!open || detail !== undefined) return
    let active = true
    void loadDetail(call.id).then((loaded) => { if (active && loaded !== undefined) setDetail(loaded) })
    return () => { active = false }
  }, [open, detail, call.id, loadDetail])
  const full = detail ?? call
  const composite = call.composite === null ? 'n/a' : call.composite.toFixed(3)
  const margin = call.margin === null ? '' : `margin ${call.margin >= 0 ? '+' : ''}${call.margin.toFixed(3)}`
  const elapsed = latencyLabel(call.ms)
  const paths = changedPaths(call.state)
  return (
    <li>
      <button
        type="button"
        className="laya-row"
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className="laya-rowMain">
          <span className="laya-kind">{callKindLabel(call.kind)}</span>
          <span className="laya-verdict" data-v={call.verdict}>{call.verdict}</span>
          {call.error === undefined ? null : <span className="laya-kind" style={{ color: 'var(--dsw-alias-state-error-primary)' }}>error</span>}
          {call.vetoes.length === 0 ? null : <span className="laya-kind">{call.vetoes.join(', ')}</span>}
          {call.reviewOnly === true ? <span className="laya-kind">review only</span> : null}
        </span>
        <span className="laya-counts">
          <span>{composite}</span>
          {margin.length === 0 ? null : <span>{margin}</span>}
          {elapsed.length === 0 ? null : <span>{elapsed}</span>}
          <span>{clockLabel(call.ts)}</span>
        </span>
      </button>
      {open
        ? (
          <div className="laya-detail">
            {call.error === undefined ? null : <div style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{call.error}</div>}
            <PromptLine text={call.task} />
            {paths.length === 0
              ? null
              : (
                <div>
                  Checked after <span className="laya-conf">{paths.join(' · ')}</span>
                </div>
              )}
            <ScoreMeter value={call.composite} threshold={call.threshold} />
            {call.vetoes.length > 0 && Object.keys(call.answers).length === 0
              ? <div className="laya-meaning">The deterministic verify lane blocked this before the judge was asked.</div>
              : <Answers answers={call.answers} />}
            {call.missing.length === 0 ? null : <div>Missing criteria: <span className="laya-conf">{call.missing.join(', ')}</span></div>}
            {call.vetoes.length === 0 ? null : <div>Vetoes: <span className="laya-conf">{call.vetoes.join(', ')}</span></div>}
            {call.reviewOnly === true
              ? (
                <div className="laya-meaning">
                  No corrective message was sent: this review is marginal or below the confidence
                  floor, so it is advisory. Set <code>layaSteerOnReview</code> to enforce it.
                </div>
              )
              : null}
            {call.usage === undefined
              ? null
              : (
                <div>
                  Tokens:{' '}
                  <span className="laya-conf">
                    {[
                      call.usage.input_tokens === undefined ? '' : `in ${call.usage.input_tokens}`,
                      call.usage.output_tokens === undefined ? '' : `out ${call.usage.output_tokens}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            {call.findings.length === 0
              ? null
              : (
                <div className="laya-detailRow">
                  {call.findings.map((finding, index) => (
                    <span key={index} className="laya-tag" data-error={finding.severity === 'high'}>
                      {finding.rule}{finding.path === undefined ? '' : ` · ${finding.path}`}
                    </span>
                  ))}
                </div>
              )}
            <details>
              <summary style={{ cursor: 'pointer' }}>Request / response</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {full.state === undefined && full.questions === undefined
                  ? <div className="laya-meaning">Request state is loading…</div>
                  : <JsonView value={{ state: full.state, questions: full.questions }} />}
                <JsonView value={{
                  answers: call.answers,
                  verdict: call.verdict,
                  composite: call.composite,
                  margin: call.margin,
                  missing: call.missing,
                  usage: call.usage,
                }} />
              </div>
            </details>
          </div>
        )
        : null}
    </li>
  )
}

/**
 * Poll for the turn's judge calls and render them as one card.
 *
 * The final decision is recorded while the turn is stopping, which can land
 * after this block first renders, so the card keeps polling briefly instead of
 * freezing on a half-written list.
 */
export function LayaTurnCard(props: LayaTurnCardProps) {
  const [calls, setCalls] = useState<LayaCall[]>([])
  const [open, setOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { installLayaStyles() }, [])

  const turn = turnNumberOf(props.turn)
  // A closed turn cannot gain calls: the judge runs before `turn/end`. Only an
  // open turn is worth retrying, and only a few times.
  const turnOpen = turnStatusOf(props.turn) === 'open'
  const maxTries = turnOpen ? 3 : 0

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const tick = async (): Promise<void> => {
      const found = turn === undefined ? [] : await props.lookupTurn(turn)
      if (!active) return
      if (found.length > 0) setCalls(found)
      const settled = found.some(call => call.authoritative)
      if (!settled && tries < maxTries) {
        tries += 1
        timer = setTimeout(() => { void tick() }, 800)
      }
    }
    void tick()
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [turn, maxTries, props.lookupTurn])

  if (turn === undefined || calls.length === 0) return null
  const decision = [...calls].reverse().find(call => call.authoritative) ?? calls[calls.length - 1]
  // An advisory-only turn has no gate decision; saying so in the header keeps a
  // judge opinion from reading like a failed turn.
  const advisoryOnly = calls.every(call => !call.authoritative)
  const composite = decision.composite === null ? 'n/a' : decision.composite.toFixed(3)
  const margin = decision.margin === null ? '' : `${decision.margin >= 0 ? '+' : ''}${decision.margin.toFixed(3)}`
  const visible = showAll ? calls : calls.slice(0, 3)
  const hidden = calls.length - visible.length
  const title = calls.length === 1
    ? 'Laya judged this turn'
    : `Laya judged this turn ${calls.length} times`
  return (
    <section className="laya-card" aria-label="Laya judge results for this turn">
      <button
        type="button"
        className="laya-head"
        aria-expanded={open}
        aria-label={open ? 'Hide Laya judge results' : 'Show Laya judge results'}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className="laya-tile"><LayaGlyph /></span>
        <span className="laya-titles">
          <span className="laya-title">{title}</span>
          <span className="laya-stat">
            <span className="laya-numbers">
              {advisoryOnly ? <span>advisory</span> : null}
              <span style={{ color: verdictColor(decision.verdict), fontWeight: 600 }}>{decision.verdict}</span>
              <span>{`composite ${composite}`}</span>
              {margin.length === 0 ? null : <span>margin {margin}</span>}
              {decision.vetoes.length === 0 ? null : <span>{decision.vetoes.join(', ')}</span>}
            </span>
            <span className="laya-hint">{open ? 'Hide details' : 'Show details'}</span>
          </span>
        </span>
      </button>
      {open
        ? (
          <>
            <ul className="laya-list">
              {visible.map(call => (
                <CallRow
                  key={call.id}
                  call={call}
                  defaultOpen={call.authoritative}
                  loadDetail={props.lookupDetail}
                />
              ))}
            </ul>
            {hidden > 0 || showAll
              ? (
                <button type="button" className="laya-toggle" onClick={() => { setShowAll(value => !value) }}>
                  <span>{showAll ? 'Show fewer' : `All ${calls.length} calls`}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d={showAll ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
              : null}
          </>
        )
        : null}
    </section>
  )
}
