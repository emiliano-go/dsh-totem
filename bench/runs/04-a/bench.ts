/**
 * Local experiment harness: compares eviction policies on synthetic traces that
 * mirror the graded workload (skewed popularity + periodic sequential scans).
 * Run: bun bench.ts
 */
import { createCache, type Cache } from './cache.ts'

// ---------------------------------------------------------------- policies ---

class Lru implements Cache {
  private readonly m = new Map<string, string>()
  constructor(private readonly c: number) {}
  get(k: string): string | undefined {
    const v = this.m.get(k)
    if (v !== undefined) {
      this.m.delete(k)
      this.m.set(k, v)
    }
    return v
  }
  put(k: string, v: string): void {
    if (this.m.has(k)) this.m.delete(k)
    this.m.set(k, v)
    if (this.m.size > this.c) {
      const it = this.m.keys().next()
      if (!it.done) this.m.delete(it.value)
    }
  }
}

/** Bucketed O(1) LFU (frequency counted since start; no aging). */
class Lfu implements Cache {
  private readonly entries = new Map<string, { v: string; f: number }>()
  private readonly buckets = new Map<number, Set<string>>()
  private min = 1
  constructor(private readonly c: number) {}
  private bump(k: string): void {
    const e = this.entries.get(k)!
    const set = this.buckets.get(e.f)!
    set.delete(k)
    if (set.size === 0 && e.f === this.min) this.min++
    e.f++
    let next = this.buckets.get(e.f)
    if (!next) {
      next = new Set()
      this.buckets.set(e.f, next)
    }
    next.add(k)
  }
  get(k: string): string | undefined {
    const e = this.entries.get(k)
    if (!e) return undefined
    this.bump(k)
    return e.v
  }
  put(k: string, v: string): void {
    const e = this.entries.get(k)
    if (e) {
      e.v = v
      this.bump(k)
      return
    }
    while (this.entries.size >= this.c) {
      const set = this.buckets.get(this.min)
      if (!set || set.size === 0) {
        this.min++
        continue
      }
      const victim = set.values().next().value as string
      set.delete(victim)
      this.entries.delete(victim)
      break
    }
    this.entries.set(k, { v, f: 1 })
    let set = this.buckets.get(1)
    if (!set) {
      set = new Set()
      this.buckets.set(1, set)
    }
    set.add(k)
    this.min = 1
  }
}

/** ARC (Megiddo & Modha), implemented straight from the published algorithm. */
class Arc implements Cache {
  private readonly t1 = new Map<string, string>()
  private readonly t2 = new Map<string, string>()
  private readonly b1 = new Map<string, string>()
  private readonly b2 = new Map<string, string>()
  private p = 0
  constructor(private readonly c: number) {}
  private static lruKey<V>(m: Map<string, V>): string | undefined {
    const it = m.keys().next()
    return it.done ? undefined : it.value
  }
  private static moveToMru<V>(from: Map<string, V>, to: Map<string, V>, k: string): void {
    const v = from.get(k)
    from.delete(k)
    if (v !== undefined) to.set(k, v)
  }
  private replace(x: string): void {
    const t1Size = this.t1.size
    if (t1Size > 0 && (t1Size > this.p || (this.b2.has(x) && t1Size === this.p))) {
      const k = Arc.lruKey(this.t1)!
      Arc.moveToMru(this.t1, this.b1, k)
    } else {
      const k = Arc.lruKey(this.t2)
      if (k !== undefined) Arc.moveToMru(this.t2, this.b2, k)
    }
  }
  get(k: string): string | undefined {
    if (this.t1.has(k)) {
      Arc.moveToMru(this.t1, this.t2, k)
      return this.t2.get(k)
    }
    if (this.t2.has(k)) {
      const v = this.t2.get(k)
      this.t2.delete(k)
      this.t2.set(k, v!)
      return v
    }
    return undefined
  }
  put(k: string, v: string): void {
    if (this.t1.has(k)) {
      this.t1.delete(k)
      this.t2.set(k, v)
      return
    }
    if (this.t2.has(k)) {
      this.t2.delete(k)
      this.t2.set(k, v)
      return
    }
    if (this.b1.has(k)) {
      this.p = Math.min(this.c, this.p + Math.max(Math.ceil(this.b2.size / this.b1.size), 1))
      this.replace(k)
      this.b1.delete(k)
      this.t2.set(k, v)
      return
    }
    if (this.b2.has(k)) {
      this.p = Math.max(0, this.p - Math.max(Math.ceil(this.b1.size / this.b2.size), 1))
      this.replace(k)
      this.b2.delete(k)
      this.t2.set(k, v)
      return
    }
    const t1b1 = this.t1.size + this.b1.size
    const total = t1b1 + this.t2.size + this.b2.size
    if (t1b1 >= this.c) {
      if (this.t1.size < this.c) {
        this.b1.delete(Arc.lruKey(this.b1)!)
        this.replace(k)
      } else {
        this.t1.delete(Arc.lruKey(this.t1)!)
      }
    } else if (total >= this.c) {
      if (total >= 2 * this.c) this.b2.delete(Arc.lruKey(this.b2)!)
      this.replace(k)
    }
    this.t1.set(k, v)
  }
}

// ---------------------------------------------------------------- workload ---

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Zipf(s) sampler over `n` keys via a precomputed CDF. */
function zipfSampler(n: number, s: number): (u: number) => number {
  const cdf = new Float64Array(n)
  let acc = 0
  for (let i = 0; i < n; i++) {
    acc += 1 / Math.pow(i + 1, s)
    cdf[i] = acc
  }
  for (let i = 0; i < n; i++) cdf[i] /= acc
  return (u: number) => {
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (cdf[mid] < u) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}

interface Workload {
  capacity: number
  ops: number
  warmup: number
  hotKeys: number
  zipfS: number
  scanEvery: number
  scanLen: number
  /** keyspace for scans; 'disjoint' never overlaps hot keys */
  scanMode: 'disjoint' | 'hot-range'
  /** when set, popularity moves to a fresh key set halfway through */
  shiftAt?: number
  seed: number
}

interface Result {
  hitRate: number
  hits: number
  gets: number
}

function run(policy: Cache, w: Workload): Result {
  const rand = mulberry32(w.seed)
  const hot = zipfSampler(w.hotKeys, w.zipfS)
  let scanCursor = 0
  let hits = 0
  let gets = 0
  const period = w.scanLen > 0 ? w.scanEvery + w.scanLen : Number.MAX_SAFE_INTEGER
  for (let i = 0; i < w.ops; i++) {
    let key: string
    const inScan = w.scanLen > 0 && i % period >= w.scanEvery
    if (inScan) {
      // sequential scan: consecutive fresh keys, each touched once
      const offset = w.scanMode === 'disjoint' ? scanCursor++ : scanCursor++ % Math.max(1, Math.floor(w.hotKeys / 4))
      key = w.scanMode === 'disjoint' ? `scan:${offset}` : `hot:${offset}`
    } else {
      const shifted = w.shiftAt !== undefined && i >= w.shiftAt
      const base = hot(rand())
      key = `hot:${shifted ? base + w.hotKeys : base}`
    }
    gets++
    const hit = policy.get(key)
    if (hit !== undefined) {
      if (i >= w.warmup) hits++
    } else {
      policy.put(key, `v:${key}`)
    }
  }
  const measured = w.ops - w.warmup
  return { hitRate: hits / measured, hits, gets: measured }
}

// ------------------------------------------------------------------- main ---

const policies: Record<string, (c: number) => Cache> = {
  'LRU': (c) => new Lru(c),
  'LFU': (c) => new Lfu(c),
  'ARC': (c) => new Arc(c),
  'WTLFU win1%': (c) => createCache(c, { windowRatio: 0.01 }),
  'WTLFU win5%': (c) => createCache(c, { windowRatio: 0.05 }),
  'WTLFU win10%': (c) => createCache(c, { windowRatio: 0.1 }),
  'WTLFU prot50%': (c) => createCache(c, { windowRatio: 0.01, protectedRatio: 0.5 }),
}

const workloads: Workload[] = [
  { capacity: 512, ops: 300_000, warmup: 60_000, hotKeys: 5_000, zipfS: 1.1, scanEvery: 4_000, scanLen: 1_024, scanMode: 'disjoint', seed: 1 },
  { capacity: 2_048, ops: 300_000, warmup: 60_000, hotKeys: 20_000, zipfS: 1.1, scanEvery: 4_000, scanLen: 2_000, scanMode: 'disjoint', seed: 2 },
  { capacity: 256, ops: 200_000, warmup: 40_000, hotKeys: 2_000, zipfS: 0.9, scanEvery: 3_000, scanLen: 512, scanMode: 'hot-range', seed: 3 },
  { capacity: 1_000, ops: 300_000, warmup: 60_000, hotKeys: 10_000, zipfS: 1.0, scanEvery: 5_000, scanLen: 2_000, scanMode: 'disjoint', shiftAt: 150_000, seed: 4 },
]

for (const w of workloads) {
  console.log(
    `\ncapacity=${w.capacity} hot=${w.hotKeys} zipf=${w.zipfS} scan=${w.scanMode}/${w.scanLen}every${w.scanEvery}` +
      (w.shiftAt ? ' [POPULARITY SHIFT]' : ''),
  )
  const rows: Array<[string, Result]> = []
  for (const [name, make] of Object.entries(policies)) {
    rows.push([name, run(make(w.capacity), w)])
  }
  rows.sort((a, b) => b[1].hitRate - a[1].hitRate)
  for (const [name, r] of rows) {
    console.log(`  ${name.padEnd(16)} hit ${(r.hitRate * 100).toFixed(2)}%  (${r.hits}/${r.gets})`)
  }
}
