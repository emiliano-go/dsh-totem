import { expect, test } from 'bun:test'
import {
  TURN_EXTRACTOR_VERSION,
  turnCoverageUnit,
  turnUnitId,
} from '../src/coverage.ts'

test('turn coverage is stable across tool order', () => {
  const first = turnCoverageUnit({
    turn: 3,
    text: 'Same turn',
    tools: ['edit', 'bash'],
    changes: [{ tool: 'edit', path: 'src/a.ts' }],
  })
  const second = turnCoverageUnit({
    turn: 3,
    text: 'Same turn',
    tools: ['bash', 'edit', 'edit'],
    changes: [{ tool: 'edit', path: 'src/a.ts' }],
  })
  expect(first.unit_id).toBe('turn-3')
  expect(first.fingerprint).toBe(second.fingerprint)
})

test('turn coverage changes when the turn or content changes', () => {
  const base = turnCoverageUnit({ turn: 1, text: 'first', tools: ['read'] })
  const changedText = turnCoverageUnit({ turn: 1, text: 'second', tools: ['read'] })
  const changedTurn = turnCoverageUnit({ turn: 2, text: 'first', tools: ['read'] })
  expect(base.fingerprint).not.toBe(changedText.fingerprint)
  expect(base.unit_id).not.toBe(changedTurn.unit_id)
})

test('unknown turns still get a stable unit and version', () => {
  const unit = turnCoverageUnit({ text: 'x', tools: [] })
  expect(unit.unit_id).toBe(turnUnitId({ text: 'x', tools: [] }))
  expect(unit.unit_id).toBe('turn-unknown')
  expect(TURN_EXTRACTOR_VERSION).toContain('turn')
})
