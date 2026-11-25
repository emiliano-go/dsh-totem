import { describe, expect, test } from 'bun:test'
import { evaluateTurn, GATE_PROMPT } from '../src/verify-gate.ts'

describe('verification gate', () => {
  test('a turn that changed nothing is free to end', () => {
    expect(evaluateTurn({ changes: [], checks: [] })).toEqual({ reason: 'no-change', block: false })
  })

  test('a passing check after the last edit ends the turn', () => {
    const verdict = evaluateTurn({
      changes: [{ tool: 'edit', path: 'src/a.ts', seq: 1 }],
      checks: [{ command: 'bun test', exitCode: 0, seq: 2 }],
    })
    expect(verdict.reason).toBe('verified')
    expect(verdict.block).toBe(false)
  })

  test('an edit with no check afterwards is blocked and names the command', () => {
    const verdict = evaluateTurn({
      changes: [{ tool: 'write', path: 'src/a.ts', seq: 2 }],
      checks: [{ command: 'bun test', exitCode: 0, seq: 1 }],
      command: 'bun test',
    })
    expect(verdict.reason).toBe('unchecked')
    expect(verdict.block).toBe(true)
    expect(verdict.message).toContain('`bun test`')
  })

  test('the most recent verdict decides: green then red is red', () => {
    const verdict = evaluateTurn({
      changes: [{ tool: 'edit', path: 'src/a.ts', seq: 1 }],
      checks: [
        { command: 'bun test', exitCode: 0, seq: 2 },
        { command: 'bun test', exitCode: 1, output: 'expected 2', seq: 3 },
      ],
    })
    expect(verdict.reason).toBe('failing')
    expect(verdict.block).toBe(true)
    expect(verdict.command).toBe('bun test')
  })

  test('red then green is green', () => {
    const verdict = evaluateTurn({
      changes: [{ tool: 'edit', path: 'src/a.ts', seq: 1 }],
      checks: [
        { command: 'bun test', exitCode: 1, seq: 2 },
        { command: 'bun test', exitCode: 0, seq: 3 },
      ],
    })
    expect(verdict.reason).toBe('verified')
  })

  test('the message quotes a capped failing tail', () => {
    const verdict = evaluateTurn({
      changes: [{ tool: 'edit', path: 'src/a.ts', seq: 1 }],
      checks: [{ command: 'bun test', exitCode: 2, output: 'x'.repeat(10_000), seq: 2 }],
    })
    expect(verdict.reason).toBe('failing')
    expect(verdict.message?.length).toBeLessThan(2_000)
    expect(verdict.message).toContain('exit 2')
  })

  test('several files are summarised without flooding the message', () => {
    const verdict = evaluateTurn({
      changes: [
        { tool: 'edit', path: 'a.ts', seq: 1 },
        { tool: 'edit', path: 'b.ts', seq: 2 },
        { tool: 'edit', path: 'c.ts', seq: 3 },
        { tool: 'edit', path: 'd.ts', seq: 4 },
      ],
      checks: [],
    })
    expect(verdict.message).toContain('4 files')
    expect(verdict.message).toContain('…')
    expect(verdict.message).toContain('a.ts, b.ts, c.ts')
    expect(verdict.message).not.toContain('d.ts')
  })

  test('without a configured command it asks for the project check', () => {
    const verdict = evaluateTurn({ changes: [{ tool: 'edit', path: 'a.ts', seq: 1 }], checks: [] })
    expect(verdict.message).toContain('the project’s test or verify command')
  })

  test('the prompt states the rule before the first violation', () => {
    expect(GATE_PROMPT).toContain('Verification gate')
    expect(GATE_PROMPT).toContain('hypothesis')
    expect(GATE_PROMPT).toContain('exit status')
  })
})
