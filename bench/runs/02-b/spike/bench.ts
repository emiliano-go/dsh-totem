// Spike harness: durable-store throughput. Node- and Bun-compatible, no test framework.
// Imports ./impl.ts (the candidate) and prints one JSON object per criterion.
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const WRITES = 2000
const CONCURRENCY = 32
const VALUE = (i: number) => `value-${i}-${'x'.repeat(48)}`

type Store = {
  put(key: string, value: string): Promise<void> | void
  get(key: string): string | undefined
  delete(key: string): Promise<void> | void
  close(): Promise<void> | void
}

const root = mkdtempSync(join(process.cwd(), '.spin-'))
const { openStore } = (await import('./impl.ts')) as {
  openStore(path: string): Promise<Store> | Store
}

const result: Record<string, number> = {}

// ---- semantics: overwrite, delete, reopen -----------------------------------
const semDir = join(root, 'sem')
mkdirSync(semDir, { recursive: true })
let semantics = 1
try {
  let s = await openStore(semDir)
  await s.put('a', '1'); await s.put('b', '2'); await s.put('a', '3')
  await s.delete('b')
  await s.delete('missing')
  await s.close()
  s = await openStore(semDir)
  const ok = s.get('a') === '3' && s.get('b') === undefined
  await s.put('c', '4')
  await s.close()
  s = await openStore(semDir)
  semantics = ok && s.get('c') === '4' && s.get('a') === '3' ? 1 : 0
  await s.close()
} catch {
  semantics = 0
}
result.semantics_pass = semantics

// ---- throughput at concurrency 32 (durable ack latency) --------------------
const thrDir = join(root, 'thr')
mkdirSync(thrDir, { recursive: true })
const store = await openStore(thrDir)
const latencies: number[] = new Array(WRITES)
let next = 0
const started = performance.now()
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const index = next++
      if (index >= WRITES) return
      const t0 = performance.now()
      await store.put(`k${index}`, VALUE(index))
      latencies[index] = performance.now() - t0
    }
  }),
)
const elapsedMs = performance.now() - started
result.puts_per_second = Math.round(WRITES / (elapsedMs / 1000))
const sorted = latencies.slice().sort((a, b) => a - b)
result.p99_ms = +sorted[Math.floor(WRITES * 0.99)].toFixed(3)
result.p50_ms = +sorted[WRITES >> 1].toFixed(3)

// ---- reopen cost over the produced data ------------------------------------
const tReopen = performance.now()
const reopened = await openStore(thrDir)
result.reopen_ms = +(performance.now() - tReopen).toFixed(3)
let hits = 0
for (let i = 0; i < WRITES; i += 97) if (reopened.get(`k${i}`) === VALUE(i)) hits++
result.reopen_sample_hits = hits
await reopened.close()
await store.close()

rmSync(root, { recursive: true, force: true })
process.stdout.write(JSON.stringify(result) + '\n')
process.exit(0)
