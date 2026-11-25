import { createCache } from './store.ts'
const CAP = 1000, REQ = 400_000
const c = createCache(CAP)
let hits = 0
const t0 = performance.now()
for (let i = 0; i < REQ; i++) {
  const k = `k${i % 3000}`
  if (c.get(k) === undefined) c.put(k, k)
  else hits++
}
const ms = performance.now() - t0
console.log(JSON.stringify({ hit_rate: +(hits/REQ).toFixed(4), ops_per_sec: Math.round(REQ/(ms/1000)), ms: +ms.toFixed(1) }))
