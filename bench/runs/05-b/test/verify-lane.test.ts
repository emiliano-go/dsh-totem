import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VerifyLane, VerifyStore, toVerifyChanges, ruleCatalog } from '../src/verify-lane.ts'

const LANE = (command = '', disable: string[] = []) => new VerifyLane({
  command: { get: () => command },
  disable: { get: () => disable },
})

const marker = {
  tool: 'edit',
  path: 'src/app.ts',
  input: '{}',
  output: 'ok',
  diff: JSON.stringify([{ oldText: 'const a = 1\n', newText: '<<<<<<< HEAD\nconst a = 1\n=======\nconst a = 2\n>>>>>>> branch\n' }]),
}

describe('verify lane', () => {
  test('turns a patch into a unified diff and keeps the check output', () => {
    const changes = toVerifyChanges({
      session: 's', turn: 1, changes: [marker],
      checks: [{ command: 'bun test', exitCode: 1, output: '2 failed' }],
    })
    expect(changes).toHaveLength(2)
    expect(changes[0].diff).toContain('+<<<<<<< HEAD')
    expect(changes[0].paths).toEqual(['src/app.ts'])
    expect(changes[1]).toMatchObject({ tool: 'bash', input: 'bun test', output: '2 failed' })
  })

  test('reports a merge marker with no command configured', async () => {
    const result = await LANE().run({ session: 's', turn: 1, changes: [marker] })
    expect(result.turn).toBe(1)
    expect(result.command).toBeUndefined()
    expect(result.findings.some(finding => finding.severity === 'high')).toBe(true)
    expect(result.findings.every(finding => finding.source !== 'command')).toBe(true)
  })

  test('honours disabled rules', async () => {
    const enabled = await LANE().run({ session: 's', turn: 1, changes: [marker] })
    const disabled = await LANE('', ['conflict-markers']).run({ session: 's', turn: 1, changes: [marker] })
    expect(disabled.findings.length).toBeLessThan(enabled.findings.length)
    expect(disabled.findings.some(finding => finding.rule.includes('conflict'))).toBe(false)
  })

  test('runs the configured command and reports its failure', async () => {
    const project = mkdtempSync(join(tmpdir(), 'dsh-verify-lane-'))
    const failed = await LANE('exit 3').run({ session: 's', turn: 2, changes: [], project })
    expect(failed.command).toMatchObject({ ran: true, ok: false })
    expect(failed.findings.some(finding => finding.source === 'command')).toBe(true)

    const passed = await LANE('true').run({ session: 's', turn: 3, changes: [], project })
    expect(passed.command).toMatchObject({ ran: true, ok: true })
  })

  test('stores findings by turn, newest last', async () => {
    const store = new VerifyStore()
    const first = await LANE().run({ session: 'a', turn: 1, changes: [marker] })
    const second = await LANE().run({ session: 'a', turn: 2, changes: [] })
    store.add(first)
    store.add(second)
    expect(store.forTurn(1)?.turn).toBe(1)
    expect(store.forTurn(9)).toBeUndefined()
    expect(store.last()?.turn).toBe(2)
  })

  test('exposes the rule catalogue for the settings tab', () => {
    const rules = ruleCatalog()
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0]).toHaveProperty('id')
    expect(rules[0]).toHaveProperty('severity')
  })
})
