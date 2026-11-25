// Real-disk throughput + latency: same shape as the hidden test (2000 writes,
// concurrency 32) but on the repository filesystem inside this run directory.
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { openStore } from './store.ts'

const WRITES = Number(process.env.WRITES ?? 2000)
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 32)
const dir = join(import.meta.dir, '.bench-throughput')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })

const store = await openStore(dir)
const latencies: number[] = []
let next = 0
const started = performance.now()
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const index = next++
      if (index >= WRITES) return
      const t0 = performance.now()
      await store.put(`k${index}`, `value-${index}-${'x'.repeat(48)}`)
      latencies.push(performance.now() - t0)
    }
  }),
)
const elapsed = performance.now() - started
await store.close()

latencies.sort((a, b) => a - b)
const pct = (p: number): number => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] as number
const reopenStart = performance.now()
const reopened = await openStore(dir)
const reopenMs = performance.now() - reopenStart
let lost = 0
for (let i = 0; i < WRITES; i += 1) if (reopened.get(`k${i}`) === undefined) lost += 1
await reopened.close()

const du = Bun.spawnSync(['du', '-h', join(dir, 'log')])
console.log(JSON.stringify({
  writes: WRITES,
  concurrency: CONCURRENCY,
  elapsedMs: Math.round(elapsed),
  putsPerSecond: Math.round(WRITES / (elapsed / 1000)),
  p50: +pct(0.5).toFixed(2),
  p99: +pct(0.99).toFixed(2),
  max: +latencies[latencies.length - 1]!.toFixed(2),
  reopenMs: +reopenMs.toFixed(2),
  lostAfterReopen: lost,
  logSize: du.stdout.toString().trim(),
}))
rmSync(dir, { recursive: true, force: true })
