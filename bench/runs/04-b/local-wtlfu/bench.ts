// Parameterized local benchmark (same shape as the spike harness, env-tunable).
import { createCache } from './impl.ts'

const CAP = Number(process.env.CAP ?? 1000)
const HOT = Number(process.env.HOT ?? 6000)
const REQ = Number(process.env.REQ ?? 400_000)
const SCAN_EVERY = Number(process.env.SCAN_EVERY ?? 25_000)
const SCAN_LEN = Number(process.env.SCAN_LEN ?? 2_000)
const SEED = Number(process.env.SEED ?? 0x9e3779b9)
const PHASE = Number(process.env.PHASE ?? 0) // 1 = popularity shifts halfway

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

const cdfs: Float64Array[] = []
for (let phase = 0; phase < 2; phase++) {
  const cdf = new Float64Array(HOT)
  let mass = 0
  for (let i = 0; i < HOT; i++) {
    mass += 1 / Math.pow(i + 1, 1.1)
    cdf[i] = mass
  }
  for (let i = 0; i < HOT; i++) cdf[i] /= mass
  cdfs.push(cdf)
}
const sampleHot = (u: number, cdf: Float64Array): number => {
  let lo = 0
  let hi = HOT - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (cdf[mid]! < u) lo = mid + 1
    else hi = mid
  }
  return lo
}

const keys: string[] = new Array(REQ)
const isScan = new Uint8Array(REQ)
const random = rng(SEED)
let epoch = 0
let off = -1
for (let i = 0; i < REQ; i++) {
  if (i > 0 && i % SCAN_EVERY === 0) {
    off = 0
    epoch++
  }
  if (off >= 0 && off < SCAN_LEN) {
    keys[i] = `scan:${epoch}:${off}`
    off++
  } else {
    off = -1
    let idx = sampleHot(random(), cdfs[PHASE === 1 && i >= REQ / 2 ? 1 : 0]!)
    if (PHASE === 1 && i >= REQ / 2) idx = HOT - 1 - idx
    keys[i] = `hot:${idx}`
  }
  if (off >= 0) isScan[i] = 1
}

const cache = createCache(CAP)
let hits = 0
let hotHits = 0
let hotReq = 0
let bad = 0
let firstHalfHits = 0
let firstHalfReq = 0
let secondHalfHits = 0
let secondHalfReq = 0
const t0 = performance.now()
for (let i = 0; i < REQ; i++) {
  const key = keys[i]!
  const value = cache.get(key)
  if (value === undefined) {
    cache.put(key, key)
    if (value !== undefined) bad++
  } else {
    hits++
    if (value !== key) bad++
    if (i < REQ / 2) firstHalfHits++
    else secondHalfHits++
  }
  if (i < REQ / 2) firstHalfReq++
  else secondHalfReq++
  if (isScan[i] === 0) {
    hotReq++
    if (value !== undefined) hotHits++
  }
}
const elapsed = performance.now() - t0
console.log(
  JSON.stringify({
    cap: CAP,
    hit_rate: Number((hits / REQ).toFixed(5)),
    hot_hit_rate: Number((hotHits / hotReq).toFixed(5)),
    h1: Number((firstHalfHits / firstHalfReq).toFixed(5)),
    h2: Number((secondHalfHits / secondHalfReq).toFixed(5)),
    ops_per_sec: Math.round(REQ / (elapsed / 1000)),
    integrity: bad === 0,
  }),
)
