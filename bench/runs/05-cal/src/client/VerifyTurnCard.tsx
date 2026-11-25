/**
 * In-chat card for the deterministic verify lane, one per completed turn.
 *
 * Wiring only: the Host already ran the rules at turn end. The card lists what
 * fired, where, and which lane saw it. No model, no decision — a warning.
 *
 * @module dsh-totem/client/VerifyTurnCard
 */
import { useEffect, useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { turnNumberOf, turnStatusOf } from './turn.ts'
import type { VerifyResult } from './verify-card.ts'

/** Face injected into the card. */
export interface VerifyTurnCardFace {
  lookupTurn: (turn: number) => Promise<VerifyResult | null>
}

/** Props supplied by the turn tail slot plus the injected lookup. */
export type VerifyTurnCardProps = { turn: number | { turn?: number }; seq?: number } & InjectFace<VerifyTurnCardFace>

const HIGH = 'var(--dsw-alias-state-error-primary, #e5534b)'
const MEDIUM = 'var(--dsw-alias-state-warning-primary, #d29922)'
const MUTED = 'var(--dsw-alias-text-secondary, #9a9a9a)'
const BORDER = 'var(--dsw-alias-border, #333)'

function severityColor(severity: string): string {
  return severity === 'high' ? HIGH : MEDIUM
}

/** One finding row: rule chip, path, detail. */
function FindingRow({ finding }: { finding: VerifyResult['findings'][number] }) {
  return (
    <li style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0' }}>
      <span
        style={{
          flex: '0 0 auto',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 11,
          color: severityColor(finding.severity),
        }}
      >
        {finding.rule}
      </span>
      <span style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}>
        {finding.path === undefined || finding.path.length === 0 ? '' : <code style={{ fontSize: 11 }}>{finding.path} </code>}
        {finding.detail}
      </span>
      <span style={{ flex: '0 0 auto', fontSize: 10, color: MUTED }}>{finding.source ?? finding.tool ?? ''}</span>
    </li>
  )
}

/**
 * A turn's deterministic findings; renders nothing when the lane recorded no
 * result (for example a turn with no tool calls, or a plugin restart).
 */
export function VerifyTurnCard({ turn, lookupTurn }: VerifyTurnCardProps) {
  const number = turnNumberOf(turn)
  const status = turnStatusOf(turn)
  const [result, setResult] = useState<VerifyResult | null | undefined>(undefined)

  useEffect(() => {
    if (number === undefined) return
    let active = true
    void lookupTurn(number).then((loaded) => { if (active) setResult(loaded) })
    return () => { active = false }
    // A closed turn is final; only an open one is worth re-asking.
  }, [number, status, lookupTurn])

  // A clean turn stays quiet: the card is a warning surface, not a badge.
  if (result === undefined || result === null) return null
  if (result.findings.length === 0 && result.command === undefined) return null
  const { findings } = result
  const high = findings.filter(finding => finding.severity === 'high').length
  const mutated = result.command !== undefined

  return (
    <section
      aria-label="Deterministic verification"
      style={{
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${high > 0 ? HIGH : BORDER}`,
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <header style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: findings.length === 0 ? 0 : 4 }}>
        <strong style={{ fontSize: 12 }}>Verification</strong>
        <span style={{ color: MUTED }}>
          {findings.length === 0 ? 'clean' : `${findings.length} finding${findings.length === 1 ? '' : 's'}${high > 0 ? ` (${high} high)` : ''}`}
          {' · '}
          {result.ms} ms
          {mutated ? ` · command ${result.command?.ok === true ? 'passed' : 'failed'}` : ''}
        </span>
      </header>
      {findings.length === 0
        ? null
        : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {findings.map((finding, index) => (
                <FindingRow key={`${finding.rule}:${finding.path ?? ''}:${index}`} finding={finding} />
              ))}
            </ul>
          )}
    </section>
  )
}
