import { mkdirSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openStore } from './store.ts'
const work = mkdtempSync(join(tmpdir(), 'bench-'))
const value = JSON.stringify({ pad: 'x'.repeat(64) })
const measure = (count: number) => {
  const dir = join(work, `n${count}`); mkdirSync(dir, { recursive: true })
  const s = openStore(dir)
  const ds: number[] = []
  const t0 = performance.now()
  for (let i = 0; i < count; i++) { const a = performance.now(); s.put(`k${i}`, value); ds.push(performance.now() - a) }
  const total = performance.now() - t0
  s.close(); ds.sort((a, b) => a - b)
  return { puts: count, bytes: statSync(join(dir, 'data.log')).size, p50: ds[count >> 1]!, p99: ds[Math.floor(count * 0.99)]!, max: ds[count - 1]!, pps: count / (total / 1000) }
}
for (const n of [1000, 5000, 50000]) {
  const r = measure(n)
  console.log(JSON.stringify({ n, logBytes: r.bytes, p50_ms: +r.p50.toFixed(4), p99_ms: +r.p99.toFixed(4), max_ms: +r.max.toFixed(4), puts_per_sec: Math.round(r.pps) }))
}
// reopen: exactly 1 MiB and 8 MiB of log
for (const target of [1 << 20, 8 << 20]) {
  const dir = join(work, `reopen-${target}`); mkdirSync(dir, { recursive: true })
  const s = openStore(dir)
  let i = 0
  while (statSync(join(dir, 'data.log')).size < target) { s.put(`k${i}`, value); i++ }
  s.close()
  const t0 = performance.now(); const r = openStore(dir); const ms = performance.now() - t0
  let hits = 0; for (let j = 0; j < i; j += Math.max(1, i >> 10)) if (r.get(`k${j}`) !== undefined) hits++
  r.close()
  console.log(JSON.stringify({ reopen_log_mib: +(statSync(join(dir, 'data.log')).size / 1048576).toFixed(2), keys: i, reopen_ms: +ms.toFixed(2), sampled_hits: hits }))
}
