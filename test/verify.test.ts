import { expect, test } from 'bun:test'
import { verifyAnswer, verifyChanges, executionEvidence } from '../src/verify.ts'

test('built-in lane vetoes secrets, injection, destructive commands, and silent swallows', () => {
  const findings = verifyChanges([
    { tool: 'write', input: 'const apiKey = "sk-live-abcdefgh12345678"\n', output: '', paths: ['src/a.ts'] },
    { tool: 'write', input: 'db.query("SELECT * FROM users WHERE id = " + userId)\n', output: '', paths: ['src/b.ts'] },
    { tool: 'bash', input: 'rm -rf /', output: '' },
    { tool: 'edit', input: 'try { x() } catch (e) {}', output: '', paths: ['src/c.ts'] },
    { tool: 'edit', input: 'if (x = 0) { y() }', output: '', paths: ['src/d.ts'] },
  ])
  const rules = findings.findings.map(finding => finding.rule)
  expect(rules).toContain('secret-hardcoded')
  expect(rules).toContain('sql-or-code-injection')
  expect(rules).toContain('destructive-command')
  expect(rules).toContain('silent-swallow')
  expect(rules).toContain('assignment-in-condition')
  expect(findings.veto).toBe(true)
})

test('test weakening and failing execution evidence veto', () => {
  const weakened = verifyChanges([{
    tool: 'edit',
    input: 'tests/a.test.ts',
    output: '',
    paths: ['tests/a.test.ts'],
    diff: '+ pass\n- assert.equal(result, 2)\n',
  }])
  expect(weakened.findings.some(finding => finding.rule === 'test-weakened')).toBe(true)

  const evidence = executionEvidence([{ tool: 'bash', input: 'pytest', output: '2 failed, 3 passed' }])
  expect(evidence[0]).toMatchObject({ kind: 'tests', status: 'fail' })
  const later = executionEvidence([
    { tool: 'bash', input: 'pytest', output: '2 failed' },
    { tool: 'bash', input: 'pytest', output: '5 passed' },
  ])
  expect(later[0]).toMatchObject({ kind: 'tests', status: 'pass' })
})

test('unsafe advice is vetoed; clean changes pass', () => {
  expect(verifyAnswer('You can disable TLS verification for this request.').veto).toBe(true)
  expect(verifyChanges([{ tool: 'edit', input: 'return a + b', output: '', paths: ['src/math.ts'] }]).veto).toBe(false)
})

test('repo-wide formatting and bulk rewrites are scope creep', () => {
  const formatter = verifyChanges([{ tool: 'bash', input: 'npx prettier --write .', output: 'reformatted 30 files' }])
  expect(formatter.findings.some(finding => finding.rule === 'scope-unrelated')).toBe(true)
  expect(formatter.veto).toBe(true)

  const bulk = verifyChanges([{ tool: 'write', input: 'filePath=src/user.ts rewrote 400 lines into a repository pattern', output: '', paths: ['src/user.ts'] }])
  expect(bulk.findings.some(finding => finding.rule === 'scope-unrelated')).toBe(true)

  const good = verifyChanges([{ tool: 'write', input: 'filePath=src/parser.ts rewrote into 5 helpers', output: '', paths: ['src/parser.ts'] }])
  expect(good.findings.some(finding => finding.rule === 'scope-unrelated')).toBe(false)
})
