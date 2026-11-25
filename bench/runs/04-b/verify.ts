// Verification for cache.ts: semantics, capacity compliance, trace hit rate.
import { createCache } from './cache.ts'

let failures = 0
const check = (name: string, ok: boolean): void => {
  if (!ok) {
    failures++
    console.log(`FAIL ${name}`)
  }
}

// --- semantics -------------------------------------------------------------
{
  const c = createCache(2)
  check('miss returns undefined', c.get('a') === undefined)
  c.put('a', '1')
  check('put then get', c.get('a') === '1')
  c.put('a', '2')
  check('overwrite value', c.get('a') === '2')
  check('still miss on other key', c.get('b') === undefined)
  c.put('b', 'x')
  c.put('c', 'y') // evicts one of a/b
  const survivors = [c.get('a'), c.get('b')].filter(v => v !== undefined).length
  check('capacity 2 keeps at most 2', survivors <= 2)
  check('newest survives', c.get('c') === 'y')
}
{
  const z = createCache(0)
  z.put('a', 'b')
  check('capacity 0 put is a no-op', z.get('a') === undefined)
  const neg = createCache(-3)
  neg.put('a', 'b')
  check('negative capacity behaves as 0', neg.get('a') === undefined)
}
{
  const one = createCache(1)
  for (let i = 0; i < 100; i++) one.put('k' + i, 'v' + i)
  check('capacity 1 last write wins', one.get('k99') === 'v99')
  let resident = 0
  for (let i = 0; i < 100; i++) if (one.get('k' + i) !== undefined) resident++
  check('capacity 1 holds one key', resident === 1)
}
{
  const c = createCache(50)
  for (let i = 0; i < 200; i++) c.put('k' + i, 'v' + i)
  for (let i = 0; i < 200; i++) c.put('k' + i, 'w' + i)
  let upgraded = 0
  let wrong = 0
  for (let i = 0; i < 200; i++) {
    const v = c.get('k' + i)
    if (v === 'w' + i) upgraded++
    else if (v !== undefined) wrong++
  }
  check('no corrupted values after churn', wrong === 0)
  check('rewrites are visible', upgraded > 0)
  const many = createCache(10_000)
  for (let i = 0; i < 20_000; i++) many.put('big' + i, 'v' + i)
  let held = 0
  for (let i = 0; i < 20_000; i++) if (many.get('big' + i) !== undefined) held++
  check('large capacity bound', held === 10_000)
}

// --- capacity under interleaved hits and insertions ------------------------
{
  const cap = 10
  const c = createCache(cap)
  for (let i = 0; i < 200; i++) {
    for (let j = 0; j < 5; j++) c.get('hot' + ((i + j) % 5))
    c.get('hot0')
    c.put('new' + i, 'v' + i)
  }
  let resident = 0
  for (let j = 0; j < 5; j++) if (c.get('hot' + j) !== undefined) resident++
  for (let i = 0; i < 200; i++) if (c.get('new' + i) !== undefined) resident++
  check('interleaved hits keep capacity bound', resident <= cap)
  check('a fresh key is still admitted', resident > 0)
}

// --- capacity sweep --------------------------------------------------------
for (const cap of [1, 2, 3, 7, 10, 100, 1000]) {
  const c = createCache(cap)
  const n = cap * 4
  for (let i = 0; i < n; i++) c.put(`p${i}`, `v${i}`)
  let resident = 0
  for (let i = 0; i < n; i++) if (c.get(`p${i}`) === `v${i}`) resident++
  check(`cap ${cap} resident == cap`, resident === cap)
}

// --- trace hit rate --------------------------------------------------------
const runTrace = (cap: number, phase: boolean, seed: number): { hit: number; hot: number } => {
  const HOT = 6000
  const REQ = 400_000
  const SCAN_EVERY = 25_000
  const SCAN_LEN = 2_000
  const rnd = (s: number): (() => number) => {
    let x = s >>> 0
    return () => {
      x ^= x << 13
      x >>>= 0
      x ^= x >>> 17
      x ^= x << 5
      x >>>= 0
      return x / 4294967296
    }
  }
  const cdf = new Float64Array(HOT)
  let mass = 0
  for (let i = 0; i < HOT; i++) {
    mass += 1 / Math.pow(i + 1, 1.1)
    cdf[i] = mass
  }
  for (let i = 0; i < HOT; i++) cdf[i] /= mass
  const sample = (u: number): number => {
    let lo = 0
    let hi = HOT - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (cdf[mid]! < u) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const cache = createCache(cap)
  const r = rnd(seed)
  let epoch = 0
  let off = -1
  let hits = 0
  let hotHits = 0
  let hotReq = 0
  for (let i = 0; i < REQ; i++) {
    if (i > 0 && i % SCAN_EVERY === 0) {
      off = 0
      epoch++
    }
    let key: string
    let scan = false
    if (off >= 0 && off < SCAN_LEN) {
      key = `scan:${epoch}:${off}`
      off++
      scan = true
    } else {
      off = -1
      let idx = sample(r())
      if (phase && i >= REQ / 2) idx = HOT - 1 - idx
      key = `hot:${idx}`
    }
    const v = cache.get(key)
    if (v === undefined) cache.put(key, key)
    else hits++
    if (!scan) {
      hotReq++
      if (v !== undefined) hotHits++
    }
  }
  return { hit: hits / REQ, hot: hotHits / hotReq }
}

for (const cap of [100, 1000, 5000]) {
  for (const phase of [false, true]) {
    const r = runTrace(cap, phase, phase ? 106 : 0x9e3779b9)
    console.log(
      `cap=${cap} phase=${phase ? 1 : 0} hit_rate=${r.hit.toFixed(4)} hot_hit_rate=${r.hot.toFixed(4)}`,
    )
  }
}

console.log(failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECKS FAILED`)
if (failures > 0) process.exit(1)
