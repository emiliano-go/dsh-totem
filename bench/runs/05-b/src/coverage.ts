/**
 * Extraction coverage for turn distillation.
 *
 * Totem stores one ledger row per extracted source unit. The fingerprint is a
 * content hash, so a changed turn reopens while an unchanged turn is skipped.
 * The extractor version is separate: changing the prompt or parser reopens
 * every turn even when the text is identical.
 */
import { createHash } from 'node:crypto'

export const TURN_EXTRACTOR_VERSION = 'dsh-totem-turn-v2'

export interface CoverageUnit {
  unit_id: string
  fingerprint: string
}

export interface TurnCoverageInput {
  turn?: number
  text: string
  tools: readonly string[]
  changes?: readonly { path: string; tool: string }[]
}

/** Stable one-based unit id, independent of wall-clock time. */
export function turnUnitId(input: TurnCoverageInput): string {
  return input.turn === undefined || !Number.isFinite(input.turn)
    ? 'turn-unknown'
    : `turn-${input.turn}`
}

/** Content fingerprint for one turn's extraction-relevant material. */
export function turnCoverageUnit(input: TurnCoverageInput): CoverageUnit {
  const payload = JSON.stringify({
    text: input.text,
    tools: [...new Set(input.tools)].sort(),
    changes: [...(input.changes ?? [])]
      .map(change => `${change.tool}:${change.path.replaceAll('\\', '/')}`)
      .sort(),
  })
  return {
    unit_id: turnUnitId(input),
    fingerprint: createHash('sha256').update(payload).digest('hex'),
  }
}
