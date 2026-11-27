import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MAX_APPROACHES, MIN_APPROACHES, buildBrief, harnessFileName, measurementCommand, parseFailCount, parsePassCount, inspectDir, parseCriteria, rank, readMeasurements, renderSpike, resolveHarness, runCommand, runSpike } from '../src/spike.ts'

const criteria = [
  { name: 'p95_ms', direction: 'min' as const, weight: 1 },
  { name: 'deps', direction: 'min' as const, weight: 1 },
  { name: 'secure', direction: 'pass' as const, weight: 1 },
]

function candidate(id: string, measurements: Record<string, number | boolean>) {
  return { id, approach: 'the simplest thing', dir: `/tmp/${id}`, elapsedMs: 1000, timedOut: false, files: 2, loc: 20, measurements }
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

  test('a non-zero count proves a pass criterion', () => {
    const ranking = rank([
      candidate('fast', { p95_ms: 1, deps: 1, secure: 2 }),
      candidate('slow', { p95_ms: 500, deps: 4, secure: true }),
    ], criteria)
    expect(ranking[0]?.id).toBe('fast')
    expect(ranking.every(entry => entry.qualified)).toBe(true)
  })

  test('a zero count fails a pass criterion', () => {
    const ranking = rank([candidate('none', { p95_ms: 1, deps: 1, secure: 0 })], criteria)
    expect(ranking[0]?.qualified).toBe(false)
  })

  test('a failed pass criterion disqualifies even the fastest', () => {
    const ranking = rank([
      candidate('fast', { p95_ms: 1, deps: 1, secure: false }),
      candidate('slow', { p95_ms: 500, deps: 4, secure: true }),
    ], criteria)
    expect(ranking[0]?.id).toBe('slow')
    expect(ranking.find(entry => entry.id === 'fast')?.qualified).toBe(false)
  })

  test('identical measurements score identically instead of being split by order', () => {
    const ranking = rank([
      candidate('c1', { p95_ms: 10, deps: 3, secure: true }),
      candidate('c2', { p95_ms: 10, deps: 3, secure: true }),
      candidate('c3', { p95_ms: 10, deps: 3, secure: true }),
    ], criteria)
    expect(new Set(ranking.map(entry => entry.score)).size).toBe(1)
  })

  test('a large win outweighs a tiny one', () => {
    const magnitude = [
      { name: 'wall_ms', direction: 'min' as const, weight: 1 },
      { name: 'p99_ms', direction: 'min' as const, weight: 1 },
    ]
    const ranking = rank([
      // 8x faster on wall, 0.7% slower on p99.
      candidate('fast', { wall_ms: 1250, p99_ms: 50.79 }),
      candidate('slow', { wall_ms: 10_000, p99_ms: 50.45 }),
    ], magnitude)
    expect(ranking[0]?.id).toBe('fast')
  })

  test('a clear win scores strictly higher, not merely first by luck', () => {
    const ranking = rank([
      candidate('slow-first', { p95_ms: 100, deps: 1, secure: true }),
      candidate('fast-second', { p95_ms: 5, deps: 1, secure: true }),
    ], criteria)
    expect(ranking[0]?.id).toBe('fast-second')
    expect(ranking[0]!.score).toBeGreaterThan(ranking[1]!.score)
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

  test('an indented object is still a measurement', () => {
    expect(readMeasurements('{\n  "recall5": 1,\n  "p95_ms": 0.07,\n  "indexed": 20000\n}\n')).toEqual({
      recall5: 1,
      p95_ms: 0.07,
      indexed: 20000,
    })
  })

  test('an object printed after noise is found', () => {
    expect(readMeasurements('building index...\ndone\n{"p95_ms": 3}')).toEqual({ p95_ms: 3 })
  })

  test('nested objects do not confuse the scan', () => {
    expect(readMeasurements('{"a": 1, "detail": {"b": 2}, "c": 3}')).toEqual({ a: 1, c: 3 })
  })

  test('no JSON means no measurements', () => {
    expect(readMeasurements('boom')).toEqual({})
  })
})

describe('the measurement runner', () => {
  test('captures stdout from a command run in the directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spike-run-'))
    const out = await runCommand('echo \'{"p95_ms": 12}\'', dir, 5_000)
    expect(readMeasurements(out)).toEqual({ p95_ms: 12 })
  })

  test('a command that outlives its budget is killed instead of hanging the run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spike-run-'))
    const started = Date.now()
    const out = await runCommand('sleep 30', dir, 300)
    expect(out).toBe('')
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})

describe('the harness-owned benchmark', () => {
  test('a contract is stated in the brief and the worker is told not to bench itself', () => {
    const brief = buildBrief({
      question: 'q',
      approach: 'the simplest thing',
      criteria,
      dir: '/tmp/a',
      timeboxMs: 600_000,
      contract: 'export function run(x: number): number',
      harnessed: true,
    })
    expect(brief).toContain('export function run(x: number): number')
    expect(brief).toContain('restored before measuring')
    expect(brief).not.toContain('bun run bench.ts`')
  })

  test('without a contract the measuring command is still described', () => {
    const brief = buildBrief({ question: 'q', approach: 'the simplest thing', criteria, dir: '/tmp/a', timeboxMs: 600_000, measure: 'bun run bench.ts' })
    expect(brief).toContain('bun run bench.ts')
  })

  test('a run says whether its numbers are comparable', () => {
    const run = {
      id: 'spike-x',
      question: 'q',
      criteria,
      timeboxMs: 600_000,
      comparable: false,
      candidates: [{ id: 'c1', approach: 'a', dir: 'x', elapsedMs: 1, timedOut: false, files: 1, loc: 1, measurements: {} }],
      ranking: [{ id: 'c1', score: 0, qualified: true, reasons: [] }],
      winner: 'c1',
    }
    expect(renderSpike(run as never)).toContain('may measure different workloads')
  })
})

describe('the caller proposes the approaches', () => {
  test('fewer than three approaches is rejected before anything runs', async () => {
    await expect(runSpike({}, { question: 'q', criteria, approaches: ['only one'], parent: {} })).rejects.toThrow()
  })

  test('a bound disqualifies without needing a direction', () => {
    const bounded = [
      { name: 'peak_in_flight', direction: 'pass' as const, weight: 1, atMost: 8 },
      { name: 'wall_ms', direction: 'min' as const, weight: 1 },
    ]
    const ranking = rank([
      { id: 'pool8', approach: 'a', dir: 'x', elapsedMs: 1, timedOut: false, files: 1, loc: 1, measurements: { peak_in_flight: 8, wall_ms: 1250 } },
      { id: 'pool16', approach: 'b', dir: 'y', elapsedMs: 1, timedOut: false, files: 1, loc: 1, measurements: { peak_in_flight: 16, wall_ms: 650 } },
    ], bounded)
    expect(ranking[0]?.id).toBe('pool8')
    expect(ranking.find(entry => entry.id === 'pool16')?.qualified).toBe(false)
  })

  test('loc and deps are criteria like any other', () => {
    const sizing = [
      { name: 'loc', direction: 'min' as const, weight: 1 },
      { name: 'deps', direction: 'min' as const, weight: 1 },
    ]
    const ranking = rank([
      { id: 'big', approach: 'a', dir: 'x', elapsedMs: 1, timedOut: false, files: 1, loc: 400, measurements: { loc: 400, deps: 2 } },
      { id: 'small', approach: 'b', dir: 'y', elapsedMs: 1, timedOut: false, files: 1, loc: 120, measurements: { loc: 120, deps: 0 } },
    ], sizing)
    expect(ranking[0]?.id).toBe('small')
  })

  test('constants are exported for the caller contract', () => {
    expect(MIN_APPROACHES).toBe(3)
    expect(MAX_APPROACHES).toBe(5)
  })
})

describe('the protected oracle', () => {
  test('a candidate cannot replace the script that judges it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spike-oracle-'))
    const oraclePath = join(dir, 'oracle.ts')
    await Bun.write(oraclePath, 'console.log("2 passed, 0 failed")\n')
    const fake = {
      subagents: {
        async startActivation(spec: { request: { cwd: string } }) {
          await Bun.write(join(spec.request.cwd, 'oracle.ts'), 'console.log("99 passed")\n')
          return { async result() { return { output: [], stopReason: 'done' } }, async dispose() {} }
        },
      },
    }
    const run = await runSpike(fake as never, {
      question: 'q',
      criteria: [{ name: 'loc', direction: 'min', weight: 1 }],
      approaches: ['a', 'b', 'c'],
      measure: 'echo "{\"loc\": 1}"',
      verify: 'bun oracle.ts',
      verifyFile: oraclePath,
      workspace: join(tmpdir(), `spike-oracle-ws-${Date.now()}`),
    })
    expect(run.candidates.every(candidate => candidate.measurements?.verify_passed === 2)).toBe(true)
  })
})

describe('refinement rounds', () => {
  test('the oracle failures come back as feedback for the next round', async () => {
    const prompts: string[] = []
    const fake = {
      subagents: {
        async startActivation(spec: { request: { prompt: { text: string }[]; cwd: string } }) {
          prompts.push(spec.request.prompt[0].text)
          const round = prompts.length <= 3 ? 1 : 2
          const dir = spec.request.cwd
          await Bun.write(join(dir, 'impl.ts'), `1 passed\n${round === 1 ? 2 : 0} failed\n`)
          return {
            async result() { return { output: [], stopReason: 'done' } },
            async dispose() {},
          }
        },
      },
    }
    const run = await runSpike(fake as never, {
      question: 'q',
      criteria: [{ name: 'loc', direction: 'min', weight: 1 }],
      approaches: ['a', 'b', 'c'],
      measure: 'echo "{\"loc\": 10}"',
      verify: 'cat impl.ts',
      rounds: 2,
      workspace: join(tmpdir(), `spike-rounds-${Date.now()}`),
    })
    expect(run.candidates.length).toBe(6)
    expect(prompts.length).toBe(6)
    const secondRound = prompts.slice(3)
    expect(secondRound.every(prompt => prompt.includes('Feedback from the previous round'))).toBe(true)
    expect(secondRound[0]).toContain('2 failed')
  })
})

describe('a sound oracle', () => {
  test('reads the failure count so the next round has feedback', () => {
    expect(parseFailCount('14 failed, 115 passed')).toBe(14)
    expect(parseFailCount('119 passing')).toBe(0)
  })

  test('reads the pass count from the usual test-runner shapes', () => {
    expect(parsePassCount('12 passed, 3 failed')).toBe(12)
    expect(parsePassCount('ok 7 tests')).toBe(7)
    expect(parsePassCount('5 passing (120ms)')).toBe(5)
    expect(parsePassCount('nothing useful')).toBeUndefined()
  })

})

describe('the measurement command', () => {
  test('a harnessed run uses the caller runner, not bun', () => {
    expect(measurementCommand({ harnessed: true, runner: 'python3 bench.py' })).toBe('python3 bench.py')
  })

  test('a harnessed run without a runner defaults to bun', () => {
    expect(measurementCommand({ harnessed: true })).toBe('bun run bench.ts')
  })

  test('the interpreter is inferred from a python or shell harness', () => {
    expect(measurementCommand({ harnessed: true, harness: 'bench.py' })).toBe('python3 bench.py')
    expect(measurementCommand({ harnessed: true, harness: 'bench.sh' })).toBe('bash bench.sh')
  })

  test('a bash harness is started with bash, not bun', () => {
    expect(measurementCommand({ harnessed: true, harness: '#!/usr/bin/env bash\necho hi\n' })).toBe('bash bench.sh')
    expect(measurementCommand({ harnessed: true, harness: '#!/usr/bin/env python3\nprint(1)\n' })).toBe('python3 bench.py')
  })

  test('the harness file is named for the runner', () => {
    expect(harnessFileName('python3 bench.py')).toBe('bench.py')
    expect(harnessFileName('bash bench.sh')).toBe('bench.sh')
    expect(harnessFileName('bun run bench.ts')).toBe('bench.ts')
    expect(harnessFileName(undefined)).toBe('bench.ts')
  })

  test('an unharnessed run uses the measure command', () => {
    expect(measurementCommand({ harnessed: false, measure: 'bun run bench.ts' })).toBe('bun run bench.ts')
    expect(measurementCommand({ harnessed: false })).toBeUndefined()
  })
})

describe('harness files', () => {
  test('inline source passes through unchanged', async () => {
    expect(await resolveHarness('echo hi')).toBe('echo hi')
    expect(await resolveHarness(undefined)).toBeUndefined()
  })

  test('a file: path is read from disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spike-harness-'))
    const path = join(dir, 'bench.ts')
    writeFileSync(path, 'console.log(1)\n')
    expect(await resolveHarness(`file:${path}`)).toBe('console.log(1)\n')
  })

  test('file: without a path is rejected', async () => {
    await expect(resolveHarness('file:   ')).rejects.toThrow()
  })
})

describe('the record', () => {
  test('briefs differ by approach and forbid the rest of the project', () => {
    const one = buildBrief({ question: 'q', approach: 'the simplest thing', criteria, dir: '/tmp/a', timeboxMs: 600_000 })
    const two = buildBrief({ question: 'q', approach: 'the unconventional one', criteria, dir: '/tmp/b', timeboxMs: 600_000 })
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
      comparable: true,
      repeats: 1,
      pareto: ['c2'],
      verdict: 'winner',
      candidates: [
        { id: 'c1', approach: 'a', dir: 'x', elapsedMs: 600_000, timedOut: true, files: 1, loc: 5, measurements: {} },
        { id: 'c2', approach: 'b', dir: 'y', elapsedMs: 60_000, timedOut: false, files: 2, loc: 9, measurements: { p95_ms: 5, deps: 1, secure: true } },
      ],
      ranking: [{ id: 'c2', score: 0, qualified: true, reasons: [] }, { id: 'c1', score: 0, qualified: false, reasons: ['p95_ms: missing'] }],
      winner: 'c2',
    }
    const text = renderSpike(run as never)
    expect(text).toContain('timed out at 10m')
    expect(text).toContain('winner: c2')
  })

  test('the rendered record carries the numbers behind the scores', () => {
    const run = {
      id: 'spike-m',
      question: 'q',
      criteria,
      timeboxMs: 600_000,
      comparable: true,
      repeats: 3,
      pareto: ['c1'],
      verdict: 'winner',
      winner: 'c1',
      candidates: [{
        id: 'c1', approach: 'a', dir: 'x', elapsedMs: 1000, timedOut: false, files: 1, loc: 1,
        measurements: { p95_ms: 12.345, deps: 2, secure: true },
        spread: { p95_ms: { min: 11.1, max: 13.9, median: 12.345 } },
      }],
      ranking: [{ id: 'c1', score: 1, qualified: true, reasons: [] }],
    }
    const text = renderSpike(run as never)
    expect(text).toContain('median over 3 runs')
    expect(text).toContain('p95_ms 12.345 [11.1')
  })

  test('directory inspection counts source files and skips docs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spike-inspect-'))
    writeFileSync(join(dir, 'a.ts'), 'let a = 1\nlet b = 2\n')
    writeFileSync(join(dir, 'RESULT.md'), '# result\n')
    const stats = await inspectDir(dir)
    expect(stats).toEqual({ files: 2, loc: 2, deps: 0 })
  })
})
