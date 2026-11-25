// Harness-owned benchmark for the eviction-policy spike.
// Synthetic trace: Zipf-skewed hot set mixed with periodic sequential scans.
// Deterministic; the cache implementation is the only variable.
import { createCache } from './impl.ts'

const CAPACITY = 1000
const HOT_KEYS = 6000
const REQUESTS = 400_000
const SCAN_EVERY = 25_000 // a scan starts every 25k requests
const SCAN_LEN = 2_000 // cold sequential keys, touched once each
const SEED = 0x9e3779b9

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

// Zipf-ish CDF over HOT_KEYS entries, exponent 1.1.
const cdf = new Float64Array(HOT_KEYS)
let mass = 0
for (let i = 0; i < HOT_KEYS; i++) {
  mass += 1 / Math.pow(i + 1, 1.1)
  cdf[i] = mass
}
for (let i = 0; i < HOT_KEYS; i++) cdf[i] /= mass

function sampleHot(u: number): number {
  let lo = 0
  let hi = HOT_KEYS - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (cdf[mid]! < u) lo = mid + 1
    else hi = mid
  }
  return lo
}

const hotKeys: string[] = []
for (let i = 0; i < HOT_KEYS; i++) hotKeys.push(`hot:${i}`)

const keys: string[] = new Array(REQUESTS)
const isScan = new Uint8Array(REQUESTS)
const random = rng(SEED)
let scanEpoch = 0
let scanOffset = -1
for (let i = 0; i < REQUESTS; i++) {
  let takeScan = false
  if (i > 0 && i % SCAN_EVERY === 0) {
    scanOffset = 0
    scanEpoch++
  }
  if (scanOffset >= 0 && scanOffset < SCAN_LEN) {
    takeScan = true
    keys[i] = `scan:${scanEpoch}:${scanOffset}`
    scanOffset++
  } else {
    scanOffset = -1
    keys[i] = hotKeys[sampleHot(random())]!
  }
  if (takeScan) isScan[i] = 1
}

const cache = createCache(CAPACITY)

let hits = 0
let hotHits = 0
let hotRequests = 0
let scans = 0
let decoded = 0
const t0 = performance.now()
for (let i = 0; i < REQUESTS; i++) {
  const key = keys[i]!
  const value = cache.get(key)
  if (value === undefined) {
    cache.put(key, key)
  } else {
    hits++
    if (isScan[i] === 0) hotHits++
    if (value !== key) decoded = 1
  }
  if (isScan[i] === 0) hotRequests++
  else scans++
}
const elapsed = performance.now() - t0

const hotHitRate = hotHits / hotRequests
const hitRate = hits / REQUESTS
const opsPerSec = Math.round(REQUESTS / (elapsed / 1000))

console.log(
  JSON.stringify({
    hit_rate: Number(hitRate.toFixed(5)),
    hot_hit_rate: Number(hotHitRate.toFixed(5)),
    ops_per_sec: opsPerSec,
    scanRequests: scans,
    value_integrity: decoded === 0,
  }),
)
