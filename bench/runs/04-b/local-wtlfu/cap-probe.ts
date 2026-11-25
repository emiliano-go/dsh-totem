import { createCache } from './impl.ts'
// Capacity compliance: after inserting 4*cap distinct keys, at most cap may be resident.
for (const cap of [1, 2, 3, 7, 10, 100, 1000]) {
  const c = createCache(cap)
  const n = cap * 4
  for (let i = 0; i < n; i++) c.put(`k${i}`, `v${i}`)
  let resident = 0
  for (let i = 0; i < n; i++) if (c.get(`k${i}`) === `v${i}`) resident++
  // second sweep forces recency churn then checks integrity of values
  for (let i = 0; i < n; i++) if (c.get(`k${i}`) !== undefined && c.get(`k${i}`) !== `v${i}`) resident = -999
  const p = createCache(cap)
  for (let i = 0; i < n; i++) p.put(`k${i}`, `v${i}`)
  for (let i = 0; i < n; i++) p.put(`k${i}`, `w${i}`)
  let upgraded = 0
  for (let i = 0; i < n; i++) { const v = p.get(`k${i}`); if (v === `w${i}`) upgraded++; else if (v !== undefined) resident = -999 }
  const zero = createCache(0)
  zero.put('a', 'b')
  console.log(`cap=${cap} resident=${resident} upgraded=${upgraded} cap0_get=${zero.get('a')}`)
}
