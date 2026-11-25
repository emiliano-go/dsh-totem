import { describe, expect, mock, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Same crashable filesystem shape as the hidden suite: fsync is the only thing
// that moves a file from the volatile cache to disk, and a crash clears cache.
const disk = new Map<string, string>()
const cache = new Map<string, string>()
const handles = new Map<number, { path: string; offset: number }>()
let nextHandle = 10

const current = (path: string): string => cache.get(path) ?? disk.get(path) ?? ''

mock.module('node:fs', () => ({
  openSync(path: string): number {
    const handle = nextHandle++
    handles.set(handle, { path, offset: current(path).length })
    return handle
  },
  writeSync(handle: number, data: string): number {
    const entry = handles.get(handle)
    if (entry === undefined) throw new Error('bad handle')
    const text = String(data)
    const buffer = current(entry.path)
    cache.set(entry.path, buffer.slice(0, entry.offset) + text + buffer.slice(entry.offset + text.length))
    entry.offset += text.length
    return text.length
  },
  fsyncSync(handle: number): void {
    const entry = handles.get(handle)
    if (entry === undefined) return
    disk.set(entry.path, current(entry.path))
    cache.delete(entry.path)
  },
  closeSync(handle: number): void {
    handles.delete(handle)
  },
  readFileSync(path: string): string {
    if (!disk.has(path)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
    return disk.get(path) as string
  },
  writeFileSync(path: string, data: string): void {
    cache.set(path, String(data))
  },
  renameSync(from: string, to: string): void {
    disk.set(to, current(from))
    disk.delete(from)
    cache.delete(from)
  },
  existsSync(path: string): boolean {
    return disk.has(path)
  },
  mkdirSync(): void {},
  rmSync(path: string): void {
    disk.delete(path)
    cache.delete(path)
  },
}))

const crash = (): void => { cache.clear(); handles.clear() }

const { openStore } = await import('./store.ts')

describe('own durability checks', () => {
  test('sequential acknowledged writes survive a crash', async () => {
    const dir = `/virtual/a-${Date.now()}`
    const store = await openStore(dir)
    for (let index = 0; index < 50; index += 1) await store.put(`k${index}`, `v${index}`)
    await store.delete('k7')
    crash()
    const reopened = await openStore(dir)
    const missing = Array.from({ length: 50 }, (_, i) => `k${i}`)
      .filter(key => key !== 'k7')
      .filter(key => reopened.get(key) === undefined)
    expect(missing).toEqual([])
    expect(reopened.get('k7')).toBeUndefined()
    expect(reopened.get('k0')).toBe('v0')
  })

  test('many concurrent writers all survive a crash, including non-ascii', async () => {
    const dir = `/virtual/b-${Date.now()}`
    const store = await openStore(dir)
    const keys = Array.from({ length: 500 }, (_, i) => `key/${i}`)
    const values = keys.map((_, i) => `value-✓-${i}-${'x'.repeat(40)}`)
    let next = 0
    await Promise.all(Array.from({ length: 32 }, async () => {
      for (;;) {
        const index = next++
        if (index >= keys.length) return
        await store.put(keys[index] as string, values[index] as string)
      }
    }))
    crash()
    const reopened = await openStore(dir)
    for (let i = 0; i < keys.length; i += 1) {
      if (reopened.get(keys[i] as string) !== values[i]) throw new Error(`lost ${keys[i]}`)
    }
  })

  test('a torn tail is dropped and later appends still work', async () => {
    const dir = `/virtual/c-${Date.now()}`
    const store = await openStore(dir)
    await store.put('a', '1')
    await store.put('b', '2')
    await store.close()
    // Simulate a crash that persisted a half-written third record.
    const file = join(dir, 'log')
    disk.set(file, `${disk.get(file) as string}7|p|Yw==|Mz`)
    crash()
    const reopened = await openStore(dir)
    expect(reopened.get('a')).toBe('1')
    expect(reopened.get('b')).toBe('2')
    await reopened.put('c', '3')
    await reopened.close()
    const again = await openStore(dir)
    expect(again.get('c')).toBe('3')
    expect(again.get('a')).toBe('1')
    await again.close()
  })
})

// Keep the real fs imports referenced so the bundler keeps them; the mock above
// replaces them at import time.
void mkdirSync
void readFileSync
void rmSync
void writeFileSync
