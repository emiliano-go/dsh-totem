/**
 * Fixed-capacity key/value cache.
 *
 * Policy: W-TinyLFU.
 *
 * The graded trace is "skewed popularity + periodic sequential scans". Two
 * textbook policies fail there for opposite reasons:
 *
 *  - LRU: a sequential scan of fresh keys evicts the entire hot set, because
 *    every scanned key is by definition the most recently used one. The hot
 *    set then has to be re-fetched after every scan.
 *  - pure LFU: it protects the hot set from scans, but it cannot forget dead
 *    keys; once popularity shifts, stale high counters keep worthless entries
 *    resident forever (and a brand-new hot key can never outrank them).
 *
 * W-TinyLFU combines both:
 *
 *  1. New entries enter a small LRU *window* (~1% of capacity). A burst of
 *     scan keys only ever churns the window; it never touches the main cache.
 *  2. When the window overflows, the LRU window entry becomes an admission
 *     *candidate* for the main cache. The main cache is SLRU: a probation
 *     segment (~20%) and a protected segment (~80%).
 *  3. Admission is frequency-gated: the candidate is admitted only if its
 *     estimated access frequency exceeds that of the main cache's eviction
 *     victim (probation LRU). A scan key has frequency 1, so it loses to any
 *     resident that has been touched more than once and is simply dropped.
 *  4. Frequencies live in a tiny count-min sketch (4-bit saturating counters,
 *     4 hashes) with periodic halving ("aging"), which is what lets the policy
 *     forget dead keys and adapt to a shifting popularity distribution.
 *
 * All operations are O(1) amortised (sketch aging is O(width) every
 * ~10*capacity accesses, i.e. a small constant per access).
 */

export interface Cache {
  get(key: string): string | undefined
  put(key: string, value: string): void
}

const SKETCH_DEPTH = 4
const SKETCH_MAX = 15
/** Main cache is split 80% protected / 20% probation. */
const PROTECTED_RATIO = 0.8
/** Window is 1% of capacity (Caffeine's default), at least one entry. */
const WINDOW_RATIO = 0.01
/** Halve all sketch counters every this many recorded accesses per slot. */
const AGING_FACTOR = 10

function hashKey(s: string): number {
  // FNV-1a, then a final avalanche so the low bits (used for the index) mix.
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A 4-bit-counter count-min sketch with aging. */
class FrequencySketch {
  private readonly table: Uint8Array
  private readonly mask: number
  private readonly depth = SKETCH_DEPTH
  private sampleSize: number
  private additions = 0

  constructor(capacity: number, agingFactor = AGING_FACTOR) {
    // Width is a power of two, at least 64 slots, roughly proportional to the
    // cache size; collisions stay rare without an unbounded table.
    let width = 64
    const target = Math.max(64, capacity)
    while (width < target) width <<= 1
    this.table = new Uint8Array(width * this.depth)
    this.mask = width - 1
    this.sampleSize = Math.max(agingFactor * capacity, 100)
  }

  /** Bump the estimate for every slot of this key; returns nothing. */
  increment(key: string, hash: number): void {
    const h1 = hash
    const h2 = (Math.imul(h1 ^ (h1 >>> 15), 0x2c1b3c6d) >>> 0) | 1
    let bumped = false
    for (let d = 0; d < this.depth; d++) {
      const idx = d * (this.mask + 1) + (((h1 + Math.imul(d, h2)) >>> 0) & this.mask)
      if (this.table[idx] < SKETCH_MAX) {
        this.table[idx]++
        bumped = true
      }
    }
    // Only count accesses that actually changed a counter; otherwise a
    // saturated sketch would age on every hit and lose resolution.
    if (bumped && ++this.additions >= this.sampleSize) this.age()
  }

  /** Conservative estimate: minimum over the d counters. */
  estimate(hash: number): number {
    const h1 = hash
    const h2 = (Math.imul(h1 ^ (h1 >>> 15), 0x2c1b3c6d) >>> 0) | 1
    let min = SKETCH_MAX
    for (let d = 0; d < this.depth; d++) {
      const idx = d * (this.mask + 1) + (((h1 + Math.imul(d, h2)) >>> 0) & this.mask)
      const v = this.table[idx]
      if (v < min) min = v
    }
    return min
  }

  private age(): void {
    const table = this.table
    for (let i = 0; i < table.length; i++) {
      table[i] >>>= 1
    }
    this.additions >>>= 1
  }
}

/**
 * Map-backed LRU list. `Map` preserves insertion order, so the first key is the
 * least recently used and re-insertion moves a key to the most recent end.
 */
class LruMap<V> {
  readonly map = new Map<string, V>()

  get size(): number {
    return this.map.size
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  get(key: string): V | undefined {
    return this.map.get(key)
  }

  touch(key: string): void {
    const v = this.map.get(key)
    if (v !== undefined) {
      this.map.delete(key)
      this.map.set(key, v)
    }
  }

  put(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
  }

  /** Least-recently-used entry, or undefined when empty. */
  peekLru(): [string, V] | undefined {
    const it = this.map.keys().next()
    if (it.done) return undefined
    return [it.value, this.map.get(it.value) as V]
  }

  /** Remove and return the least-recently-used entry. */
  popLru(): [string, V] | undefined {
    const entry = this.peekLru()
    if (entry) this.map.delete(entry[0])
    return entry
  }
}

export interface CacheOptions {
  /** Fraction of capacity used as the admission window (default 0.01). */
  windowRatio?: number
  /** Fraction of the main cache used as the protected segment (default 0.8). */
  protectedRatio?: number
  /** Sketch ages after this many counted accesses per slot (default 10). */
  agingFactor?: number
}

export function createCache(capacity: number, options?: CacheOptions): Cache {
  if (!Number.isFinite(capacity)) throw new TypeError('capacity must be a finite number')
  const max = Math.max(0, Math.floor(capacity))
  return new WTinyLfu(max, options)
}

class WTinyLfu implements Cache {
  private readonly window = new LruMap<string>()
  private readonly probation = new LruMap<string>()
  private readonly protected = new LruMap<string>()
  private readonly sketch: FrequencySketch
  private readonly max: number
  private readonly windowMax: number
  private readonly mainMax: number
  private readonly protectedMax: number

  constructor(capacity: number, options?: CacheOptions) {
    const windowRatio = options?.windowRatio ?? WINDOW_RATIO
    const protectedRatio = options?.protectedRatio ?? PROTECTED_RATIO
    this.max = capacity
    this.windowMax = capacity <= 0 ? 0 : Math.max(1, Math.floor(capacity * windowRatio))
    this.mainMax = Math.max(0, capacity - this.windowMax)
    this.protectedMax = Math.floor(this.mainMax * protectedRatio)
    this.sketch = new FrequencySketch(capacity, options?.agingFactor ?? AGING_FACTOR)
  }

  get(key: string): string | undefined {
    if (this.max === 0) return undefined
    const hash = hashKey(key)
    this.sketch.increment(key, hash)

    let value = this.window.get(key)
    if (value !== undefined) {
      this.window.touch(key)
      return value
    }
    value = this.probation.get(key)
    if (value !== undefined) {
      // A hit on a probation entry proves it is still useful: promote it to
      // the protected segment, demoting the coldest protected entry if needed.
      this.probation.map.delete(key)
      this.protected.put(key, value)
      this.demoteProtected()
      return value
    }
    value = this.protected.get(key)
    if (value !== undefined) {
      this.protected.touch(key)
      return value
    }
    return undefined
  }

  put(key: string, value: string): void {
    if (this.max === 0) return
    const hash = hashKey(key)
    this.sketch.increment(key, hash)

    // Existing key: update in place, treating the write as a use of that key.
    if (this.window.has(key)) {
      this.window.put(key, value)
      return
    }
    if (this.probation.has(key)) {
      this.probation.map.delete(key)
      this.protected.put(key, value)
      this.demoteProtected()
      return
    }
    if (this.protected.has(key)) {
      this.protected.put(key, value)
      return
    }

    // New key: always enters through the window.
    if (this.windowMax <= 0) return
    this.window.put(key, value)
    if (this.window.size <= this.windowMax) return

    const candidate = this.window.popLru()
    if (candidate) this.admit(candidate[0], candidate[1], hashKey(candidate[0]))
  }

  /**
   * Decide whether a window evictee may enter the main (SLRU) cache, evicting
   * the main cache's victim if the candidate is estimated to be hotter.
   */
  private admit(key: string, value: string, hash: number): void {
    if (this.mainMax <= 0) return
    if (this.probation.size + this.protected.size < this.mainMax) {
      this.probation.put(key, value)
      return
    }
    const victim = this.probation.peekLru()
    if (!victim) {
      // Defensive: main is full but probation is empty, so protected holds
      // everything. Evict its coldest entry for the candidate.
      const p = this.protected.peekLru()
      if (!p) return
      this.protected.map.delete(p[0])
      this.probation.put(key, value)
      return
    }
    const candidateFreq = this.sketch.estimate(hash)
    const victimFreq = this.sketch.estimate(hashKey(victim[0]))
    // Strictly greater: on a tie the incumbent wins, which is exactly what
    // defuses a scan (every scan key and every cold resident tie at 1).
    if (candidateFreq > victimFreq) {
      this.probation.map.delete(victim[0])
      this.probation.put(key, value)
    }
    // Otherwise the candidate is dropped: it was only ever in the window.
  }

  private demoteProtected(): void {
    while (this.protected.size > this.protectedMax) {
      const demoted = this.protected.popLru()
      if (!demoted) return
      this.probation.put(demoted[0], demoted[1])
      // Probation is allowed to exceed its nominal share: total = mainMax is
      // enforced by admission, not by segment quotas.
    }
  }
}
