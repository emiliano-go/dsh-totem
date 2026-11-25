import { describe, expect, test } from 'bun:test'
import {
  addedLineNumbers,
  addedLineNumbersOf,
  deltaRatio,
  fileDeltas,
  normalizePath,
  parseCobertura,
  parseCoverage,
  parseIstanbul,
  parseLcov,
  uncoveredAddedLines,
} from '../src/coverage-delta.ts'

const DIFF = [
  '--- a/src/queue.py',
  '+++ b/src/queue.py',
  '@@ -10,2 +10,4 @@',
  ' context',
  '+first',
  '+second',
  '-old',
  ' context2',
  '@@ -30,1 +32,2 @@',
  '+third',
  ' tail',
  '--- a/src/idle.py',
  '+++ b/src/idle.py',
  '@@ -1,1 +1,2 @@',
  '+fourth',
  ' x',
].join('\n')

describe('added line mapping', () => {
  test('added lines use new-file coordinates across hunks and files', () => {
    const added = addedLineNumbers(DIFF)
    expect(added.get('src/queue.py')).toEqual([11, 12, 32])
    expect(added.get('src/idle.py')).toEqual([1])
  })

  test('removed lines do not advance the new-file counter and deletions are skipped', () => {
    const added = addedLineNumbers(['--- a/x.py', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-a', '-b'].join('\n'))
    expect(added.size).toBe(0)
  })

  test('separate change diffs merge', () => {
    const added = addedLineNumbersOf([
      { diff: '@@ -1 +1,2 @@\n+a\n+b' },
      { diff: '@@ -5 +5,1 @@\n+c' },
    ])
    expect(added.get('')).toBeUndefined()
    expect(addedLineNumbers('--- a/f\n+++ b/f\n@@ -1 +1,2 @@\n+a\n+b').get('f')).toEqual([1, 2])
  })

  test('paths are normalised against the root and leading slashes', () => {
    expect(normalizePath('/work/proj/src/a.ts', '/work/proj')).toBe('src/a.ts')
    expect(normalizePath('./src/a.ts')).toBe('src/a.ts')
    expect(normalizePath('src\\a.ts')).toBe('src/a.ts')
  })
})

describe('report parsing', () => {
  test('istanbul statement coverage becomes line coverage', () => {
    const report = parseIstanbul({
      '/repo/src/a.ts': {
        statementMap: {
          '0': { start: { line: 1 }, end: { line: 1 } },
          '1': { start: { line: 2 }, end: { line: 3 } },
          '2': { start: { line: 9 }, end: { line: 9 } },
        },
        s: { '0': 1, '1': 0, '2': 3 },
      },
    }, '/repo')
    const file = report.files.get('src/a.ts')
    expect(file?.covered.has(1)).toBe(true)
    expect(file?.executable.has(2)).toBe(true)
    expect(file?.covered.has(2)).toBe(false)
    expect(file?.covered.has(3)).toBe(false)
    expect(file?.covered.has(9)).toBe(true)
  })

  test('lcov records lines and resets between files', () => {
    const report = parseLcov([
      'SF:/repo/src/a.ts',
      'DA:1,1',
      'DA:2,0',
      'end_of_record',
      'SF:/repo/src/b.ts',
      'DA:5,2',
      'end_of_record',
    ].join('\n'), '/repo')
    expect(report.files.get('src/a.ts')?.covered.has(1)).toBe(true)
    expect(report.files.get('src/a.ts')?.covered.has(2)).toBe(false)
    expect(report.files.get('src/b.ts')?.covered.has(5)).toBe(true)
    expect(report.files.size).toBe(2)
  })

  test('cobertura classes become file coverage', () => {
    const xml = '<coverage><packages><package><classes>'
      + '<class filename="src/a.ts"><lines><line number="1" hits="1"/><line number="2" hits="0"/></lines></class>'
      + '</classes></package></packages></coverage>'
    const report = parseCobertura(xml)
    expect(report.files.get('src/a.ts')?.covered.has(1)).toBe(true)
    expect(report.files.get('src/a.ts')?.executable.has(2)).toBe(true)
  })

  test('the parser is chosen by file name', () => {
    expect(parseCoverage('SF:x\nDA:1,1\nend_of_record\n', 'lcov.info').format).toBe('lcov')
    expect(parseCoverage('{}', 'coverage-final.json').format).toBe('istanbul')
    expect(() => parseCoverage('', 'coverage.txt')).toThrow('unknown coverage format')
  })
})

describe('delta computation', () => {
  const report = parseLcov([
    'SF:src/queue.py',
    'DA:11,1',
    'DA:12,0',
    'DA:32,0',
    'end_of_record',
  ].join('\n'))

  test('uncovered added executable lines are reported, covered and unknown ones are not', () => {
    const added = addedLineNumbers(DIFF)
    const uncovered = uncoveredAddedLines(added, report)
    expect(uncovered).toEqual([
      { path: 'src/queue.py', line: 12 },
      { path: 'src/queue.py', line: 32 },
    ])
  })

  test('a file with no report entry contributes nothing', () => {
    const uncovered = uncoveredAddedLines(addedLineNumbers(DIFF), report)
    expect(uncovered.some(entry => entry.path === 'src/idle.py')).toBe(false)
  })

  test('file deltas and ratio count only executable added lines', () => {
    const deltas = fileDeltas(addedLineNumbers(DIFF), report)
    const queue = deltas.find(entry => entry.path === 'src/queue.py')
    expect(queue).toEqual({ path: 'src/queue.py', added: 3, executable: 3, uncovered: 2 })
    expect(deltaRatio(addedLineNumbers(DIFF), report)).toBeCloseTo(1 / 3, 5)
    expect(deltaRatio(new Map([['src/none.py', [1]]]), report)).toBeNull()
  })
})
