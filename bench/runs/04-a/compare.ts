import { createCache, type Cache } from './cache.ts'
function mulberry32(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function zipfSampler(n: number, s: number): (u: number) => number { const cdf = new Float64Array(n); let acc = 0; for (let i = 0; i < n; i++) { acc += 1 / Math.pow(i + 1, s); cdf[i] = acc } for (let i = 0; i < n; i++) cdf[i] /= acc; return (u: number) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >>> 1; if (cdf[m] < u) lo = m + 1; else hi = m } return lo } }
class Lru implements Cache { m = new Map<string,string>(); constructor(private c: number) {} get(k: string) { const v = this.m.get(k); if (v !== undefined) { this.m.delete(k); this.m.set(k, v) } return v } put(k: string, v: string) { if (this.m.has(k)) this.m.delete(k); this.m.set(k, v); if (this.m.size > this.c) { const it = this.m.keys().next(); if (!it.done) this.m.delete(it.value) } } }
class Arc implements Cache {
  t1 = new Map<string,string>(); t2 = new Map<string,string>(); b1 = new Map<string,string>(); b2 = new Map<string,string>(); p = 0
  constructor(private c: number) {}
  private static lk<V>(m: Map<string,V>) { const it = m.keys().next(); return it.done ? undefined : it.value }
  private static mv<V>(a: Map<string,V>, b: Map<string,V>, k: string) { const v = a.get(k); a.delete(k); if (v !== undefined) b.set(k, v) }
  private rep(x: string) { const n = this.t1.size; if (n > 0 && (n > this.p || (this.b2.has(x) && n === this.p))) { Arc.mv(this.t1, this.b1, Arc.lk(this.t1)!) } else { const k = Arc.lk(this.t2); if (k !== undefined) Arc.mv(this.t2, this.b2, k) } }
  get(k: string) { if (this.t1.has(k)) { Arc.mv(this.t1, this.t2, k); return this.t2.get(k) } if (this.t2.has(k)) { const v = this.t2.get(k)!; this.t2.delete(k); this.t2.set(k, v); return v } return undefined }
  put(k: string, v: string) {
    if (this.t1.has(k)) { this.t1.delete(k); this.t2.set(k, v); return }
    if (this.t2.has(k)) { this.t2.delete(k); this.t2.set(k, v); return }
    if (this.b1.has(k)) { this.p = Math.min(this.c, this.p + Math.max(Math.ceil(this.b2.size / this.b1.size), 1)); this.rep(k); this.b1.delete(k); this.t2.set(k, v); return }
    if (this.b2.has(k)) { this.p = Math.max(0, this.p - Math.max(Math.ceil(this.b1.size / this.b2.size), 1)); this.rep(k); this.b2.delete(k); this.t2.set(k, v); return }
    const tb = this.t1.size + this.b1.size; const total = tb + this.t2.size + this.b2.size
    if (tb >= this.c) { if (this.t1.size < this.c) { this.b1.delete(Arc.lk(this.b1)!); this.rep(k) } else { this.t1.delete(Arc.lk(this.t1)!) } }
    else if (total >= this.c) { if (total >= 2 * this.c) this.b2.delete(Arc.lk(this.b2)!); this.rep(k) }
    this.t1.set(k, v)
  }
}
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
const seeds = [1, 2, 3]
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
console.log('policy'.padEnd(16), workloads.map(([n]) => n.padEnd(18)).join(''), 'mean')
const pols: Array<[string, () => Cache]> = [
  ['W-TinyLFU', () => createCache(0)],
]
for (const [wname, w] of workloads) {
  const out: string[] = []
  const mk: Array<[string, (c: number) => Cache]> = [
    ['LRU', (c) => new Lru(c)],
    ['ARC', (c) => new Arc(c)],
    ['W-TinyLFU', (c) => createCache(c)],
  ]
  const vals: Record<string, number[]> = {}
  for (const [name, f] of mk) { vals[name] = seeds.map((s) => run(() => f(w.cap), w, s)); }
  for (const [name] of mk) out.push(`${name} ${(mean(vals[name])*100).toFixed(2)}%`.padEnd(18))
  console.log(wname.padEnd(16), out.join(''))
}
// throughput
const w = workloads[1][1]; const c = createCache(w.cap); const rand = mulberry32(7); const hot = zipfSampler(w.hot, w.s)
const t0 = performance.now()
for (let i = 0; i < 1_000_000; i++) { const k = `hot:${hot(rand())}`; if (c.get(k) === undefined) c.put(k, 'v') }
const dt = performance.now() - t0
console.log(`\nthroughput: 1,000,000 mixed ops in ${dt.toFixed(0)} ms = ${(1e6 / dt * 1000 / 1e6).toFixed(2)} Mops/s`)
