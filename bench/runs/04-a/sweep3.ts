import { createCache, type Cache } from './cache.ts'
function mulberry32(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function zipfSampler(n: number, s: number): (u: number) => number { const cdf = new Float64Array(n); let acc = 0; for (let i = 0; i < n; i++) { acc += 1 / Math.pow(i + 1, s); cdf[i] = acc } for (let i = 0; i < n; i++) cdf[i] /= acc; return (u: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >>> 1; if (cdf[m] < u) lo = m + 1; else hi = m } return lo } }
interface W { cap: number; ops: number; warm: number; hot: number; s: number; every: number; len: number; shift?: number }
const workloads: Array<[string, W]> = [
  ['stationary c512', { cap: 512, ops: 300_000, warm: 60_000, hot: 5_000, s: 1.1, every: 4_000, len: 1_024 }],
  ['stationary c2048', { cap: 2_048, ops: 300_000, warm: 60_000, hot: 20_000, s: 1.1, every: 4_000, len: 2_000 }],
  ['hot-range c256', { cap: 256, ops: 200_000, warm: 40_000, hot: 2_000, s: 0.9, every: 3_000, len: 512 }],
  ['shift c1000', { cap: 1_000, ops: 300_000, warm: 60_000, hot: 10_000, s: 1.0, every: 5_000, len: 2_000, shift: 150_000 }],
]
function run(make: () => Cache, w: W, seed: number) {
  const p = make(); const rand = mulberry32(seed); const hot = zipfSampler(w.hot, w.s)
  let sc = 0, hits = 0, n = 0; const period = w.every + w.len
  for (let i = 0; i < w.ops; i++) {
    let key: string
    if (i % period >= w.every) key = `scan:${sc++}`
    else { const b = hot(rand()); key = `hot:${w.shift !== undefined && i >= w.shift ? b + w.hot : b}` }
    if (i >= w.warm) n++
    if (p.get(key) !== undefined) { if (i >= w.warm) hits++ } else p.put(key, 'v')
  }
  return hits / n
}
const seeds = [1, 2, 3, 4]
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const variants: Array<[string, any]> = [
  ['probation(default)', {}],
  ['minFreq', { victimSelection: 'minFreq' }],
  ['minFreq win2 prot90', { victimSelection: 'minFreq', windowRatio: 0.02, protectedRatio: 0.9 }],
]
for (const [name, cfg] of variants) {
  const out = workloads.map(([, w]) => (mean(seeds.map((s) => run(() => createCache(w.cap, cfg), w, s))) * 100).toFixed(2))
  console.log(name.padEnd(22), out.map((x) => x.padStart(6)).join(' '), ' mean', (out.reduce((a, b) => a + +b, 0) / out.length).toFixed(2))
}
