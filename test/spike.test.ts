import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ANGLES, buildBrief, inspectDir, parseCriteria, rank, readMeasurements, renderSpike } from '../src/spike.ts'

const criteria = [
  { name: 'p95_ms', direction: 'min' as const, weight: 1 },
  { name: 'deps', direction: 'min' as const, weight: 1 },
  { name: 'secure', direction: 'pass' as const, weight: 1 },
]

function candidate(id: string, measurements: Record<string, number | boolean>) {
  return { id, angle: ANGLES[0]!, dir: `/tmp/${id}`, elapsedMs: 1000, timedOut: false, files: 2, loc: 20, measurements }
}

describe('criteria validation', () => {
  test('measurable names pass through with default weight', () => {
    const parsed = parseCriteria([{ name: 'p95_ms', direction: 'min' }])
    expect(parsed).toEqual([{ name: 'p95_ms', direction: 'min', weight: 1 }])
  })

  test('prose criteria are rejected', () => {
    expect(() => parseCriteria([{ name: 'feels cleaner', direction: 'min' }])).toThrow()
    expect(() => parseCriteria([{ name: 'Cleaner', direction: 'min' }])).toThrow()
  })

  test('a direction is required and must be known', () => {
    expect(() => parseCriteria([{ name: 'loc' }])).toThrow()
    expect(() => parseCriteria([{ name: 'loc', direction: 'lower' }])).toThrow()
  })

  test('an empty list is rejected', () => {
    expect(() => parseCriteria([])).toThrow()
  })
})

describe('ranking', () => {
  test('the best total wins on two criteria', () => {
    const ranking = rank([
      candidate('c1', { p95_ms: 40, deps: 3, secure: true }),
      candidate('c2', { p95_ms: 10, deps: 3, secure: true }),
      candidate('c3', { p95_ms: 90, deps: 1, secure: true }),
    ], criteria)
    expect(ranking[0]?.id).toBe('c2')
  })

  test('a failed pass criterion disqualifies even the fastest', () => {
    const ranking = rank([
      candidate('fast', { p95_ms: 1, deps: 1, secure: false }),
      candidate('slow', { p95_ms: 500, deps: 4, secure: true }),
    ], criteria)
    expect(ranking[0]?.id).toBe('slow')
    expect(ranking.find(entry => entry.id === 'fast')?.qualified).toBe(false)
  })

  test('a missing measurement disqualifies rather than scoring zero', () => {
    const ranking = rank([
      candidate('silent', { secure: true }),
      candidate('measured', { p95_ms: 200, deps: 9, secure: true }),
    ], criteria)
    expect(ranking.find(entry => entry.id === 'silent')?.qualified).toBe(false)
  })

  test('weights change the winner', () => {
    const weighted = [
      { name: 'p95_ms', direction: 'min' as const, weight: 5 },
      { name: 'deps', direction: 'min' as const, weight: 1 },
    ]
    const ranking = rank([
      candidate('fast-heavy', { p95_ms: 10, deps: 20 }),
      candidate('slow-light', { p95_ms: 90, deps: 1 }),
    ], weighted)
    expect(ranking[0]?.id).toBe('fast-heavy')
  })
})

describe('measurements', () => {
  test('the last JSON object on stdout is used', () => {
    expect(readMeasurements('noise\n{"p95_ms": 42, "note": "ignored"}\n')).toEqual({ p95_ms: 42 })
  })

  test('non-numeric values are dropped', () => {
    expect(readMeasurements('{"a": 1, "b": "x", "c": true}')).toEqual({ a: 1, c: true })
  })

  test('no JSON means no measurements', () => {
    expect(readMeasurements('boom')).toEqual({})
  })
})

describe('the record', () => {
  test('briefs differ by angle and forbid the project', () => {
    const one = buildBrief({ question: 'q', angle: ANGLES[0]!, criteria, dir: '/tmp/a', timeboxMs: 600_000 })
    const two = buildBrief({ question: 'q', angle: ANGLES[1]!, criteria, dir: '/tmp/b', timeboxMs: 600_000 })
    expect(one).not.toBe(two)
    expect(one).toContain('use that absolute path for every file you create')
    expect(one).toContain('10 minutes')
    expect(one).toContain('p95_ms, deps, secure')
  })

  test('a timeout is visible in the rendered table', () => {
    const run = {
      id: 'spike-1',
      question: 'q',
      criteria,
      timeboxMs: 600_000,
      candidates: [
        { id: 'c1', angle: 'a', dir: 'x', elapsedMs: 600_000, timedOut: true, files: 1, loc: 5, measurements: {} },
        { id: 'c2', angle: 'b', dir: 'y', elapsedMs: 60_000, timedOut: false, files: 2, loc: 9, measurements: { p95_ms: 5, deps: 1, secure: true } },
      ],
      ranking: [{ id: 'c2', score: 0, qualified: true, reasons: [] }, { id: 'c1', score: 0, qualified: false, reasons: ['p95_ms: missing'] }],
      winner: 'c2',
    }
    const text = renderSpike(run as never)
    expect(text).toContain('timed out at 10m')
    expect(text).toContain('winner: c2')
  })

  test('directory inspection counts source files and skips docs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spike-inspect-'))
    writeFileSync(join(dir, 'a.ts'), 'let a = 1\nlet b = 2\n')
    writeFileSync(join(dir, 'RESULT.md'), '# result\n')
    const stats = await inspectDir(dir)
    expect(stats).toEqual({ files: 2, loc: 2 })
  })
})
