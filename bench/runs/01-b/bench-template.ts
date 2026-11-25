// Shared benchmark for the crash-safe append store spike.
// Written as bench.ts next to each candidate's impl.ts and run with `bun bench.ts`.
// Prints one JSON object with the criterion keys.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const here = import.meta.dir
const implPath = join(here, 'impl.ts')
const round = (n: number, d = 3): number => Number(n.toFixed(d))

// A child that imports the candidate (outside any node:fs mock) and loops puts.
const crashWriter = `
const { openStore } = await import(process.env.SPIKE_IMPL)
const dir = process.argv[2]
const store = await openStore(dir)
for (let i = 0; ; i += 1) {
  await store.put('c' + i, 'v' + i + ':' + 'x'.repeat(48))
  console.log('ACK c' + i)
}
`
// The deterministic durability test: page cache discarded on "power loss".
const durabilityTest = `
import { describe, expect, mock, test } from 'bun:test'
const ENTRY = process.env.SPIKE_IMPL
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
  closeSync(handle: number): void { handles.delete(handle) },
  readFileSync(path: string): string {
    if (!disk.has(path)) throw Object.assign(new Error('ENOENT: ' + path), { code: 'ENOENT' })
    return disk.get(path)
  },
  writeFileSync(path: string, data: string): void { cache.set(path, String(data)) },
  renameSync(from: string, to: string): void {
    disk.set(to, current(from)); disk.delete(from); cache.delete(from)
  },
  existsSync(path: string): boolean { return disk.has(path) },
  mkdirSync(): void {},
}))
const crash = (): void => { cache.clear(); handles.clear() }
describe('durability', () => {
  test('acked writes survive a cache-discarding crash', async () => {
    const { openStore } = await import(ENTRY)
    const dir = '/virtual/' + Date.now()
    const store = await openStore(dir)
    const acked: string[] = []
    for (let i = 0; i < 40; i += 1) { await store.put('k' + i, 'v' + i); acked.push('k' + i) }
    crash()
    const reopened = await openStore(dir)
    const missing = acked.filter(key => reopened.get(key) === undefined)
    expect(missing).toEqual([])
  })
})
`

const work = mkdtempSync(join(tmpdir(), 'spike-store-'))
const result: Record<string, number> = {}
let failed = false
const fail = (error: unknown): void => {
  failed = true
  result.error = 1
  console.error('BENCH ERROR', error)
}

try {
  const { openStore } = await import(implPath)
  const N = 4000
  // ---- write path: p99 and throughput over the same run ----
  const dir = join(work, 'perf')
  mkdirSync(dir, { recursive: true })
  const store = await openStore(dir)
  const durations: number[] = []
  const started = performance.now()
  for (let i = 0; i < N; i += 1) {
    const t = performance.now()
    await store.put(`k${i}`, `{"i":${i},"pad":"${'x'.repeat(72)}"}`)
    durations.push(performance.now() - t)
  }
  const total = performance.now() - started
  durations.sort((a, b) => a - b)
  result.p99_ms = round(durations[Math.min(N - 1, Math.floor(N * 0.99))] ?? 0)
  result.puts_per_sec = round(N / (total / 1000), 1)
  await store.close()

  // ---- reopen: replay cost over ~1 MiB of log/snapshot ----
  const t0 = performance.now()
  const reopened = await openStore(dir)
  result.reopen_ms = round(performance.now() - t0)
  const reopenMissing = Array.from({ length: N }, (_, i) => `k${i}`).filter(k => reopened.get(k) === undefined).length
  result.reopen_missing = reopenMissing

  // ---- deletes survive reopen and are not partially applied ----
  for (let i = 0; i < N; i += 97) await reopened.delete(`k${i}`)
  await reopened.close()
  const afterDelete = await openStore(dir)
  let deleteErrors = 0
  for (let i = 0; i < N; i += 1) {
    const present = afterDelete.get(`k${i}`) !== undefined
    if (i % 97 === 0 ? present : !present) deleteErrors += 1
  }
  await afterDelete.close()
  result.delete_errors = deleteErrors

  // ---- SIGKILL crash: every acknowledged write must be present ----
  const crashDir = join(work, 'crash')
  mkdirSync(crashDir, { recursive: true })
  const writerFile = join(here, '__crash_writer.ts')
  writeFileSync(writerFile, crashWriter)
  const proc = Bun.spawn(['bun', writerFile, crashDir], {
    env: { ...process.env, SPIKE_IMPL: implPath },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  let acked = ''
  const reader = (async () => {
    const decoder = proc.stdout.getReader()
    for (;;) {
      const { done, value } = await decoder.read()
      if (done) break
      acked += new TextDecoder().decode(value)
    }
  })()
  await Bun.sleep(300)
  proc.kill('SIGKILL')
  await proc.exited
  await reader
  const keys = acked.split('\n').filter(line => line.startsWith('ACK ')).map(line => line.slice(4))
  result.crash_acked = keys.length
  const reCrashed = await openStore(crashDir)
  result.crash_missing = keys.filter(key => reCrashed.get(key) === undefined).length
  await reCrashed.close()

  // ---- deterministic power-loss test (cache discarded, only fsync survives) ----
  const durFile = join(here, '__durability.test.ts')
  writeFileSync(durFile, durabilityTest)
  const durProc = Bun.spawn(['bun', 'test', durFile], {
    env: { ...process.env, SPIKE_IMPL: implPath },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const durExit = await durProc.exited
  result.unsynced_missing = durExit === 0 ? 0 : 1
} catch (error) {
  fail(error)
}

try { rmSync(work, { recursive: true, force: true }) } catch {}
console.log(JSON.stringify(result))
if (failed) process.exit(1)
