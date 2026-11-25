import { describe, expect, test } from 'bun:test'
import { appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openStore } from './store'

const dir = (): string => mkdtempSync(join(tmpdir(), 'own-store-'))

describe('own store invariants', () => {
  test('put/get/delete/reopen', () => {
    const d = dir()
    const store = openStore(d)
    store.put('a', '1')
    store.put('b', '2')
    expect(store.get('a')).toBe('1')
    store.delete('a')
    expect(store.get('a')).toBeUndefined()
    store.close()

    const again = openStore(d)
    expect(again.get('a')).toBeUndefined()
    expect(again.get('b')).toBe('2')
    again.close()
  })

  test('torn tail is skipped and the store stays usable', () => {
    const d = dir()
    const store = openStore(d)
    store.put('kept', 'yes')
    store.close()
    // Snapshot exists and the log was truncated; append a partial record and a
    // dangling fragment as a crash mid-append would leave.
    appendFileSync(join(d, 'log.ndjson'), '{"s":9999,"o":"p","k":"torn","v":"x')
    const reopened = openStore(d)
    expect(reopened.get('kept')).toBe('yes')
    expect(reopened.get('torn')).toBeUndefined()
    reopened.put('after', 'ok')
    reopened.close()

    const final = openStore(d)
    expect(final.get('kept')).toBe('yes')
    expect(final.get('after')).toBe('ok')
    expect(final.get('torn')).toBeUndefined()
    final.close()
  })

  test('compaction across many puts keeps every value', () => {
    const d = dir()
    const store = openStore(d)
    for (let i = 0; i < 3000; i += 1) store.put(`k${i}`, `v${i}`)
    store.close()
    const again = openStore(d)
    for (let i = 0; i < 3000; i += 1) expect(again.get(`k${i}`)).toBe(`v${i}`)
    again.close()
  })
})
