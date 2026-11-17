import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UNREAD_MAX_AGE_MS, UNREAD_MAX_MARKS, UnreadStore } from '../src/unread.ts'

function store(): UnreadStore {
  return new UnreadStore(join(mkdtempSync(join(tmpdir(), 'dsh-totem-unread-')), 'unread.json'))
}

describe('host unread store', () => {
  test('marks are listed newest first and survive a new instance', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'dsh-totem-unread-')), 'unread.json')
    const first = new UnreadStore(path)
    await first.mark('a', 1_000)
    await first.mark('b', 2_000)
    expect((await first.list(2_000)).map(item => item.sessionId)).toEqual(['b', 'a'])

    // A reload (new store over the same file) keeps the marks.
    const second = new UnreadStore(path)
    expect((await second.list(2_000)).map(item => item.sessionId)).toEqual(['b', 'a'])
  })

  test('re-marking refreshes the timestamp instead of duplicating', async () => {
    const store1 = store()
    await store1.mark('a', 1_000)
    await store1.mark('a', 5_000)
    const items = await store1.list(5_000)
    expect(items).toHaveLength(1)
    expect(items[0].markedAt).toBe(5_000)
  })

  test('clear removes only the requested ids', async () => {
    const store1 = store()
    await store1.mark('a', 1_000)
    await store1.mark('b', 1_000)
    const items = await store1.clear(['a'], 1_000)
    expect(items.map(item => item.sessionId)).toEqual(['b'])
    expect(await store1.clear([], 1_000)).toHaveLength(1)
  })

  test('expired marks are not returned', async () => {
    const store1 = store()
    await store1.mark('old', 1_000)
    await store1.mark('new', 1_000 + UNREAD_MAX_AGE_MS - 1)
    expect((await store1.list(1_000 + UNREAD_MAX_AGE_MS + 1)).map(item => item.sessionId)).toEqual(['new'])
    expect(await store1.list(1_000 + UNREAD_MAX_AGE_MS * 3)).toEqual([])
  })

  test('invalid ids are ignored and the document is capped', async () => {
    const store1 = store()
    await store1.mark('', 1_000)
    await store1.mark(42, 1_000)
    expect(await store1.list(1_000)).toEqual([])

    for (let index = 0; index < UNREAD_MAX_MARKS + 10; index += 1) {
      await store1.mark(`s${index}`, 1_000 + index)
    }
    const items = await store1.list(1_000 + UNREAD_MAX_MARKS + 10)
    expect(items).toHaveLength(UNREAD_MAX_MARKS)
    expect(items[0].sessionId).toBe(`s${UNREAD_MAX_MARKS + 9}`)
  })
})
