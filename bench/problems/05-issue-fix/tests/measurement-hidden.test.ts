import { describe, expect, test } from 'bun:test'
import { rank, readMeasurements } from '../src/spike.ts'

const candidate = (id: string, measurements: Record<string, number | boolean>) => ({
  id,
  approach: 'a',
  dir: '/tmp/x',
  elapsedMs: 1,
  timedOut: false,
  files: 1,
  loc: 1,
  measurements,
})

const pass = [{ name: 'indexed', direction: 'pass' as const, weight: 1 }]

describe('measurement parsing and pass semantics', () => {
  test('an indented JSON object is still a measurement', () => {
    expect(readMeasurements('{\n  "recall5": 1,\n  "p95_ms": 0.07\n}\n')).toEqual({ recall5: 1, p95_ms: 0.07 })
  })

  test('an object printed after program noise is found', () => {
    expect(readMeasurements('indexing...\ndone\n{"p95_ms": 3}')).toEqual({ p95_ms: 3 })
  })

  test('a non-zero count proves a pass criterion', () => {
    const ranking = rank([candidate('c1', { indexed: 20_000 })], pass)
    expect(ranking[0]?.qualified).toBe(true)
  })

  test('a zero count fails a pass criterion', () => {
    const ranking = rank([candidate('c1', { indexed: 0 })], pass)
    expect(ranking[0]?.qualified).toBe(false)
  })

  test('a candidate that measured nothing is still disqualified', () => {
    const ranking = rank([candidate('c1', {})], pass)
    expect(ranking[0]?.qualified).toBe(false)
  })
})
