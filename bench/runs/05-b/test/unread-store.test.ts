import { describe, expect, test } from 'bun:test'
import {
  UNREAD_KEY,
  clearStored,
  isStoredUnread,
  markStored,
  readUnread,
  withMark,
  withoutMark,
  writeUnread,
  type StorageLike,
} from '../src/client/unread-store.ts'

function fakeStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(UNREAD_KEY, initial)
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
  }
}

describe('unread store', () => {
  test('an empty or corrupt store reads as no marks', () => {
    expect(readUnread(fakeStorage())).toEqual([])
    expect(readUnread(fakeStorage('not json'))).toEqual([])
    expect(readUnread(fakeStorage('{"a":1}'))).toEqual([])
    expect(readUnread(undefined)).toEqual([])
  })

  test('marks round-trip newest first and deduplicate', () => {
    const storage = fakeStorage()
    markStored('a', storage)
    markStored('b', storage)
    markStored('a', storage)
    const records = readUnread(storage)
    expect(records.map(record => record.sessionId)).toEqual(['a', 'b'])
    expect(isStoredUnread('a', storage)).toBe(true)
    expect(isStoredUnread('c', storage)).toBe(false)
  })

  test('clearing removes only that session', () => {
    const storage = fakeStorage()
    markStored('a', storage)
    markStored('b', storage)
    clearStored('a', storage)
    expect(readUnread(storage).map(record => record.sessionId)).toEqual(['b'])
  })

  test('records older than the retention window are dropped', () => {
    const old = Date.now() - 40 * 24 * 60 * 60 * 1000
    const storage = fakeStorage(JSON.stringify([{ sessionId: 'old', markedAt: old }, { sessionId: 'new', markedAt: Date.now() }]))
    expect(readUnread(storage).map(record => record.sessionId)).toEqual(['new'])
  })

  test('invalid entries are skipped rather than failing the read', () => {
    const storage = fakeStorage(JSON.stringify([{ sessionId: 1 }, { markedAt: 1 }, { sessionId: 'ok', markedAt: Date.now() }]))
    expect(readUnread(storage).map(record => record.sessionId)).toEqual(['ok'])
  })

  test('pure helpers keep order and never mutate the input', () => {
    const base = [{ sessionId: 'a', markedAt: 1 }]
    const added = withMark(base, 'b', 2)
    expect(added.map(record => record.sessionId)).toEqual(['b', 'a'])
    expect(base).toHaveLength(1)
    expect(withoutMark(added, 'b').map(record => record.sessionId)).toEqual(['a'])
    const storage = fakeStorage()
    writeUnread(added, storage)
    expect(JSON.parse(storage.data.get(UNREAD_KEY) ?? '[]')).toHaveLength(2)
  })
})
