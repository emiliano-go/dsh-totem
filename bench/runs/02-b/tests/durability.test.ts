import { describe, expect, mock, test } from 'bun:test'

const ENTRY = process.env.STORE_ENTRY
if (ENTRY === undefined) throw new Error('STORE_ENTRY must point at the solution store.ts')

// A crashable filesystem: writes land in a page cache, only fsync moves them to
// disk, and a crash discards the cache. SIGKILL cannot test durability because
// the real page cache outlives the process; this can.
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

describe('durability under simulated power loss', () => {
  test('every acknowledged write survives a crash that discards unflushed data', async () => {
    const { openStore } = await import(ENTRY as string)
    const dir = `/virtual/${Date.now()}`
    const store = await openStore(dir)
    const acked: string[] = []
    for (let index = 0; index < 50; index += 1) {
      await store.put(`k${index}`, `v${index}`)
      acked.push(`k${index}`)
    }
    crash()

    const reopened = await openStore(dir)
    const missing = acked.filter(key => reopened.get(key) === undefined)
    expect({ missing: missing.length, sample: missing.slice(0, 3) }).toEqual({ missing: 0, sample: [] })
    await reopened.close()
  })
})
