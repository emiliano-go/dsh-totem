import { describe, expect, test } from 'bun:test'
import { ExploreGate, failureSignature, isInspection, MUTATING_TOOLS } from '../src/explore.ts'

describe('what counts as trying something', () => {
  test('reading commands are not experiments', () => {
    expect(isInspection('ls -la')).toBe(true)
    expect(isInspection('git diff --stat')).toBe(true)
    expect(isInspection('rg "foo" src')).toBe(true)
    expect(isInspection('ls && cat package.json')).toBe(true)
  })

  test('running something new is an experiment', () => {
    expect(isInspection('bun -e "console.log(1)"')).toBe(false)
    expect(isInspection('curl http://localhost:8080/health')).toBe(false)
    expect(isInspection('python3 - <<PY\nprint(1)\nPY')).toBe(false)
  })

  test('a compound command is an experiment if any part is', () => {
    expect(isInspection('ls && bun test')).toBe(false)
    expect(isInspection('git status; curl http://x')).toBe(false)
  })

  test('mutating file tools are the guarded set', () => {
    expect([...MUTATING_TOOLS].sort()).toEqual(['apply_patch', 'edit', 'write'])
  })
})

describe('failure signatures', () => {
  test('the same bug with different numbers has the same signature', () => {
    const a = failureSignature({ exitCode: 1, output: 'expected 2 to be 3' })
    const b = failureSignature({ exitCode: 1, output: 'expected 7 to be 9' })
    expect(a).toBe(b)
  })

  test('different bugs do not collide', () => {
    expect(failureSignature({ exitCode: 1, output: 'cannot find module x' }))
      .not.toBe(failureSignature({ exitCode: 1, output: 'timeout after 30s' }))
  })

  test('an empty output falls back to the exit code and command', () => {
    expect(failureSignature({ exitCode: 2, command: 'bun test' })).toBe('exit 2: bun test')
  })

  test('paths are normalised', () => {
    const a = failureSignature({ exitCode: 1, output: 'error in /repo/src/a.ts' })
    const b = failureSignature({ exitCode: 1, output: 'error in /other/src/b.ts' })
    expect(a).toBe(b)
    expect(a).toContain('<file>')
  })
})

describe('the stuck gate', () => {
  test('a fresh session may edit', () => {
    const gate = new ExploreGate()
    expect(gate.blocked('s1')).toBeUndefined()
  })

  test('one failure is not stuck', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    expect(gate.blocked('s1')).toBeUndefined()
  })

  test('the same failure twice with nothing new tried blocks editing', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 20)
    expect(gate.blocked('s1')).toContain('[explore gate]')
  })

  test('a genuinely new command since the failure unblocks editing', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 20)
    expect(gate.recordCommand('s1', 'curl http://localhost:8080', 30)).toBe(true)
    expect(gate.blocked('s1')).toBeUndefined()
  })

  test('re-running a command already seen does not count as a probe', () => {
    const gate = new ExploreGate()
    gate.recordCommand('s1', 'curl http://localhost:8080', 5)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 20)
    expect(gate.recordCommand('s1', 'curl http://localhost:8080', 30)).toBe(false)
    expect(gate.blocked('s1')).toBeDefined()
  })

  test('inspection commands never clear the block', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 20)
    expect(gate.recordCommand('s1', 'cat src/a.ts', 30)).toBe(false)
    expect(gate.blocked('s1')).toBeDefined()
  })

  test('different failures are not a loop yet', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'cannot find module x' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'timeout after 30s' }, 20)
    expect(gate.blocked('s1')).toBeUndefined()
  })

  test('a pass clears the history', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 20)
    gate.recordCheck('s1', { exitCode: 0 }, 30)
    expect(gate.blocked('s1')).toBeUndefined()
  })

  test('sessions are independent', () => {
    const gate = new ExploreGate()
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 10)
    gate.recordCheck('s1', { exitCode: 1, output: 'boom' }, 20)
    expect(gate.blocked('s2')).toBeUndefined()
  })
})
