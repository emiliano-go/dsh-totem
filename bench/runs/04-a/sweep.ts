import { createCache, type Cache } from './cache.ts'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function zipfSampler(n: number, s: number): (u: number) => number {
  const cdf = new Float64Array(n); let acc = 0
  for (let i = 0; i < n; i++) { acc += 1 / Math.pow(i + 1, s); cdf[i] = acc }
  for (let i = 0; i < n; i++) cdf[i] /= acc
  return (u: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >>> 1; if (cdf[m] < u) lo = m + 1; else hi = m } return lo }
}
interface W { cap: number; ops: number; warm: number; hot: number; s: number; every: number; len: number; shift?: number }
const workloads: W[] = [
  { cap: 512, ops: 200_000, warm: 40_000, hot: 5_000, s: 1.1, every: 4_000, len: 1_024 },
  { cap: 2_048, ops: 200_000, warm: 40_000, hot: 20_000, s: 1.1, every: 4_000, len: 2_000 },
  { cap: 256, ops: 150_000, warm: 30_000, hot: 2_000, s: 0.9, every: 3_000, len: 512 },
  { cap: 1_000, ops: 200_000, warm: 40_000, hot: 10_000, s: 1.0, every: 5_000, len: 2_000, shift: 100_000 },
]
function run(make: () => Cache, w: W, seed: number): number {
  const p = make(); const rand = mulberry32(seed); const hot = zipfSampler(w.hot, w.s)
  let sc = 0, hits = 0, n = 0
  const period = w.every + w.len
  for (let i = 0; i < w.ops; i++) {
    let key: string
    if (i % period >= w.every) key = `scan:${sc++}`
    else { const b = hot(rand()); key = `hot:${w.shift !== undefined && i >= w.shift ? b + w.hot : b}` }
    if (i >= w.warm) n++
    const hit = p.get(key)
    if (hit !== undefined) { if (i >= w.warm) hits++ } else p.put(key, 'v')
  }
  return hits / n
}
const variants: Record<string, () => Cache> = {}
// baseline LRU reference
class Lru implements Cache {
  m = new Map<string, string>(); constructor(private c: number) {}
  get(k: string) { const v = this.m.get(k); if (v !== undefined) { this.m.delete(k); this.m.set(k, v) } return v }
  put(k: string, v: string) { if (this.m.has(k)) this.m.delete(k); this.m.set(k, v); if (this.m.size > this.c) { const it = this.m.keys().next(); if (!it.done) this.m.delete(it.value) } }
}
const cfgs: Array<[string, { windowRatio?: number; protectedRatio?: number; agingFactor?: number }]> = []
for (const win of [0.01, 0.02, 0.05])
  for (const prot of [0.8, 0.9, 0.95])
    for (const age of [10, 40])
      cfgs.push([`win${win} prot${prot} age${age}`, { windowRatio: win, protectedRatio: prot, agingFactor: age }])
const seeds = [11, 22]
const table: Array<[string, number[]]> = []
for (const [name, cfg] of cfgs) {
  const vals: number[] = []
  for (const w of workloads) for (const s of seeds) vals.push(run(() => createCache(w.cap, cfg), w, s))
  table.push([name, vals])
}
const lru: number[] = []
for (const w of workloads) for (const s of seeds) lru.push(run(() => new Lru(w.cap), w, s))
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
table.sort((a, b) => mean(b[1]) - mean(a[1]))
console.log('LRU mean', (mean(lru) * 100).toFixed(2))
for (const [name, vals] of table.slice(0, 14)) {
  console.log(name.padEnd(28), 'mean', (mean(vals) * 100).toFixed(3), 'worst', (Math.min(...vals) * 100).toFixed(2), vals.map((v) => (v * 100).toFixed(2)).join(' '))
}
