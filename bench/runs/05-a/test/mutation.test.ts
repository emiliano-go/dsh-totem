import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyMutant, generateMutants, isMutablePath, killRate } from '../src/mutation.ts'

describe('mutant generation', () => {
  const source = [
    '// a === b in a comment is not a mutant',
    'export function same(a: number, b: number) {',
    '  return a === b',
    '}',
    'export function both(a: boolean, b: boolean) {',
    '  return a && b',
    '}',
  ].join('\n')

  test('flips comparisons and logical operators on code lines only', () => {
    const mutants = generateMutants(source)
    const descriptions = mutants.map(mutant => mutant.description)
    expect(descriptions).toContain('strict equality flipped')
    expect(descriptions).toContain('logical and flipped')
    // The comment line is skipped, and only one mutant per line is produced.
    expect(mutants.every(mutant => !mutant.original.trimStart().startsWith('//'))).toBe(true)
    expect(new Set(mutants.map(mutant => mutant.line)).size).toBe(mutants.length)
  })

  test('the cap bounds the work', () => {
    const mutants = generateMutants('const a = 1 === 1\nconst b = 2 !== 3\nconst c = true && false\n'.repeat(10), { max: 3 })
    expect(mutants).toHaveLength(3)
  })

  test('mutants change behaviour but keep the line shape', () => {
    const [mutant] = generateMutants('  return a === b')
    expect(mutant.mutated).toBe('  return a !== b')
    expect(mutant.original).toBe('  return a === b')
  })

  test('non-code files are refused', () => {
    expect(isMutablePath('src/a.ts')).toBe(true)
    expect(isMutablePath('README.md')).toBe(false)
    expect(isMutablePath('bun.lock')).toBe(false)
  })
})

describe('apply and score', () => {
  test('only the mutated line changes and the rest is byte-identical', () => {
    const source = 'a === b\nkeep me\nc !== d'
    const [mutant] = generateMutants(source)
    const mutated = applyMutant(source, mutant)
    expect(mutated.split('\n')[0]).toBe('a !== b')
    expect(mutated.split('\n').slice(1)).toEqual(['keep me', 'c !== d'])
  })

  test('kill rate counts kills, including the empty case', () => {
    expect(killRate([{ killed: true }, { killed: true }])).toEqual({ total: 2, killed: 2, rate: 1 })
    expect(killRate([{ killed: true }, { killed: false }])).toEqual({ total: 2, killed: 1, rate: 0.5 })
    expect(killRate([])).toEqual({ total: 0, killed: 0, rate: 0 })
  })
})

describe('mutation CLI end to end', () => {
  const fixture = (testBody: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'totem-mut-'))
    writeFileSync(join(dir, 'mod.ts'), 'export function same(a: number, b: number) {\n  return a === b\n}\n')
    writeFileSync(join(dir, 'mod.test.ts'), `import { expect, test } from 'bun:test'\nimport { same } from './mod.ts'\n\ntest('same', () => {\n${testBody}\n})\n`)
    return dir
  }

  const run = (dir: string): { exitCode: number; stdout: string } => {
    const result = Bun.spawnSync({
      cmd: ['bun', 'run', join(import.meta.dir, '..', 'script/mutation.ts'), '--file', 'mod.ts', '--cwd', dir, '--command', 'bun test mod.test.ts', '--json'],
      cwd: dir,
    })
    return { exitCode: result.exitCode, stdout: result.stdout.toString() }
  }

  test('a test that observes the behaviour kills the mutant and the file is restored', () => {
    const dir = fixture('  expect(same(1, 1)).toBe(true)\n  expect(same(1, 2)).toBe(false)')
    const before = readFileSync(join(dir, 'mod.ts'), 'utf8')
    const { exitCode, stdout } = run(dir)
    const report = JSON.parse(stdout) as { total: number; killed: number; rate: number }
    expect(report.total).toBeGreaterThan(0)
    expect(report.killed).toBe(report.total)
    expect(report.rate).toBe(1)
    expect(exitCode).toBe(0)
    expect(readFileSync(join(dir, 'mod.ts'), 'utf8')).toBe(before)
  })

  test('a test that asserts nothing leaves the mutant alive', () => {
    const dir = fixture('  expect(1).toBe(1)')
    const { exitCode, stdout } = run(dir)
    const report = JSON.parse(stdout) as { total: number; killed: number; rate: number }
    expect(report.killed).toBe(0)
    expect(report.rate).toBe(0)
    // Below the gate (default 0) it still exits 0; the report carries the signal.
    expect(exitCode).toBe(0)
  })
})
