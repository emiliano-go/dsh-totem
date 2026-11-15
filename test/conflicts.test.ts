import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConflictInbox, conflictKey, toRecord } from '../src/conflicts.ts'
import type { TotemService } from '../src/service.ts'

const detected = {
  itemA: 'aaaaaaaa-1111',
  itemB: 'bbbbbbbb-2222',
  claimA: 'Retries stop after three attempts.',
  claimB: 'Retries are unbounded.',
  condition: 'retry count',
  resolutionOptions: ['keep-a', 'keep-b'],
  recommended: 'keep-a',
}

function homed(): void {
  const home = mkdtempSync(join(tmpdir(), 'dsh-totem-conflicts-'))
  process.env.DSH_HOME = home
}

function fakeTotem(calls: { name: string; args: Record<string, unknown> }[], fail = false): TotemService {
  return {
    async call(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      if (fail) throw new Error('server down')
      return { ok: true }
    },
  } as unknown as TotemService
}

describe('conflict records', () => {
  test('normalises a detected conflict', () => {
    const record = toRecord('/repo', 'cccccccc-3333', detected, '2026-01-01T00:00:00.000Z')
    expect(record).toMatchObject({
      project: '/repo',
      memoryId: 'cccccccc-3333',
      itemA: 'aaaaaaaa-1111',
      itemB: 'bbbbbbbb-2222',
      condition: 'retry count',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(record?.options).toEqual(['keep-a', 'keep-b'])
  })

  test('rejects a conflict without both sides', () => {
    expect(toRecord('/repo', 'x', { itemA: 'a' })).toBeUndefined()
  })

  test('the same pair has one identity regardless of order', () => {
    const left = toRecord('/r', 'm', detected)!
    const right = toRecord('/r', 'm', { ...detected, itemA: detected.itemB, itemB: detected.itemA })!
    expect(conflictKey(left)).toBe(conflictKey(right))
  })
})

describe('conflict inbox', () => {
  test('records once per pair and lists newest first', async () => {
    homed()
    const inbox = new ConflictInbox()
    expect(await inbox.record('/repo', 'm1', [detected])).toBe(1)
    expect(await inbox.record('/repo', 'm1', [detected])).toBe(0)
    expect(await inbox.record('/repo', 'm1', [{ ...detected, itemB: 'dddddddd-4444' }])).toBe(1)
    const items = await inbox.list('/repo')
    expect(items).toHaveLength(2)
    expect(items[0].createdAt >= items[1].createdAt).toBe(true)
  })

  test('filters by project and hides resolved entries', async () => {
    homed()
    const inbox = new ConflictInbox()
    await inbox.record('/one', 'm1', [detected])
    await inbox.record('/two', 'm2', [{ ...detected, itemB: 'eeeeeeee-5555' }])
    expect(await inbox.list('/one')).toHaveLength(1)
    const [first] = await inbox.list('/one')
    const resolved = await inbox.resolve(first.id, 'keep-a', fakeTotem([]))
    expect(resolved?.resolution).toBe('keep-a')
    expect(await inbox.list('/one')).toHaveLength(0)
    expect(await inbox.list('/one', true)).toHaveLength(1)
  })

  test('keep-a relates the pair and supersedes the losing side', async () => {
    homed()
    const inbox = new ConflictInbox()
    await inbox.record('/repo', 'm1', [detected])
    const [record] = await inbox.list('/repo')
    const calls: { name: string; args: Record<string, unknown> }[] = []
    await inbox.resolve(record.id, 'keep-a', fakeTotem(calls))
    expect(calls.map(call => call.name)).toEqual(['memory_relate_tool', 'memory_update_tool'])
    expect(calls[0].args).toMatchObject({ from_id: detected.itemA, to_id: detected.itemB, kind: 'contradicts' })
    expect(calls[1].args).toMatchObject({ id: detected.itemB, status: 'superseded' })
  })

  test('resolving with both keeps both memories', async () => {
    homed()
    const inbox = new ConflictInbox()
    await inbox.record('/repo', 'm1', [detected])
    const [record] = await inbox.list('/repo')
    const calls: { name: string; args: Record<string, unknown> }[] = []
    await inbox.resolve(record.id, 'both', fakeTotem(calls))
    expect(calls.map(call => call.name)).toEqual(['memory_relate_tool'])
  })

  test('a failed write leaves the conflict open', async () => {
    homed()
    const inbox = new ConflictInbox()
    await inbox.record('/repo', 'm1', [detected])
    const [record] = await inbox.list('/repo')
    expect(await inbox.resolve(record.id, 'keep-b', fakeTotem([], true))).toBeUndefined()
    expect(await inbox.list('/repo')).toHaveLength(1)
  })
})
