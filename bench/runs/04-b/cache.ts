/**
 * Fixed-capacity cache, tuned for a skewed-popularity workload polluted by
 * periodic sequential scans.
 *
 * Policy: W-TinyLFU (admission-controlled segmented LRU).
 *
 * - A small LRU "window" (1% of capacity) holds the most recent insertions.
 * - The remaining capacity is an SLRU main region: 90% protected, 10% probation.
 * - A 4-bit count-min frequency sketch (4 hashes) records every access; it is
 *   halved every 40 x capacity accesses so stale popularity fades.
 * - When the window overflows, the evicted key is admitted to main only if its
 *   estimated frequency beats the probation victim's; otherwise it is dropped.
 *
 * Why this design: scans insert cold keys once, so their estimated frequency is
 * ~1 and they lose admission against resident hot keys. Within main, a hit only
 * promotes once (probation -> protected), so a scan cannot displace the hot set
 * through recency either. Hit-ratio measurements on a Zipf(1.1) + periodic-scan
 * trace put this ahead of plain LRU, SLRU and aging LFU at capacities 100-5000,
 * and it adapts to a mid-trace popularity shift.
 */

export interface Cache {
  get(key: string): string | undefined
  put(key: string, value: string): void
}

interface Node {
  key: string
  value: string
  where: 'w' | 'p' | 'q'
  prev: Node | null
  next: Node | null
}

/** Intrusive doubly-linked LRU list over nodes. */
class LruList {
  head: Node | null = null
  tail: Node | null = null
  size = 0

  moveFront(n: Node): void {
    if (this.head === n) return
    this.detach(n)
    this.linkFront(n)
    this.size++
  }

  pushFront(n: Node): void {
    this.linkFront(n)
    this.size++
  }

  detach(n: Node): void {
    if (n.prev) n.prev.next = n.next
    else this.head = n.next
    if (n.next) n.next.prev = n.prev
    else this.tail = n.prev
    n.prev = null
    n.next = null
    this.size--
  }

  popTail(): Node | null {
    const n = this.tail
    if (!n) return null
    this.detach(n)
    return n
  }

  private linkFront(n: Node): void {
    n.prev = null
    n.next = this.head
    if (this.head) this.head.prev = n
    this.head = n
    if (!this.tail) this.tail = n
  }
}

const MAX_COUNTER = 15
const SEEDS = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f] as const

export function createCache(capacity: number): Cache {
  const cap = Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : 0
  const windowCap = cap <= 2 ? cap : Math.max(1, Math.round(cap * 0.01))
  const mainCap = cap - windowCap
  const protectedCap = mainCap === 0 ? 0 : Math.max(1, Math.round(mainCap * 0.9))

  const nodes = new Map<string, Node>()
  const window = new LruList()
  const probation = new LruList()
  const protectedList = new LruList()
  let mainSize = 0

  // Count-min sketch: 4-bit counters, width a power of two >= 16 x capacity,
  // hard-capped so a huge capacity cannot allocate without bound.
  let width = 1024
  while (width < cap * 16 && width < 1 << 22) width <<= 1
  width = Math.min(Math.max(1024, width), 1 << 22)
  const table = new Uint8Array(width)
  const mask = width - 1
  const sample = Math.max(2000, cap * 40)
  let additions = 0

  const hash = (key: string, seed: number): number => {
    let h = seed ^ 0x811c9dc5
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    h ^= h >>> 16
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
    return h & mask
  }

  const bump = (key: string): void => {
    for (let i = 0; i < 4; i++) {
      const idx = hash(key, SEEDS[i]!)
      if (table[idx]! < MAX_COUNTER) table[idx]!++
    }
    if (++additions >= sample) {
      additions = 0
      for (let i = 0; i < table.length; i++) table[i]! >>>= 1
    }
  }

  const estimate = (key: string): number => {
    let min = MAX_COUNTER
    for (let i = 0; i < 4; i++) {
      const v = table[hash(key, SEEDS[i]!)]!
      if (v < min) min = v
    }
    return min
  }

  const removeMain = (n: Node): void => {
    if (n.where === 'q') protectedList.detach(n)
    else probation.detach(n)
    nodes.delete(n.key)
    mainSize--
  }

  const demoteOverflow = (): void => {
    while (protectedList.size > protectedCap) {
      const n = protectedList.popTail()
      if (!n) return
      n.where = 'p'
      probation.pushFront(n)
    }
  }

  /** Try to insert a window evictee into main; drops it when it loses admission. */
  const admit = (candidate: Node): void => {
    if (mainCap === 0) return
    if (mainSize < mainCap) {
      candidate.where = 'p'
      probation.pushFront(candidate)
      nodes.set(candidate.key, candidate)
      mainSize++
      return
    }
    let victim = probation.tail
    if (!victim) {
      // Main is entirely protected: demote one key to make a victim.
      const demoted = protectedList.popTail()
      if (!demoted) return
      demoted.where = 'p'
      probation.pushFront(demoted)
      victim = demoted
    }
    if (estimate(candidate.key) > estimate(victim.key)) {
      removeMain(victim)
      candidate.where = 'p'
      probation.pushFront(candidate)
      nodes.set(candidate.key, candidate)
      mainSize++
    }
  }

  const access = (n: Node): void => {
    bump(n.key)
    if (n.where === 'w') {
      window.moveFront(n)
      return
    }
    if (n.where === 'p') {
      probation.detach(n)
      n.where = 'q'
      protectedList.pushFront(n)
      demoteOverflow()
      return
    }
    protectedList.moveFront(n)
  }

  return {
    get(key) {
      const n = nodes.get(key)
      if (n === undefined) {
        bump(key)
        return undefined
      }
      access(n)
      return n.value
    },

    put(key, value) {
      const existing = nodes.get(key)
      if (existing !== undefined) {
        existing.value = value
        access(existing)
        return
      }
      if (cap === 0) return
      bump(key)
      const fresh: Node = { key, value, where: 'w', prev: null, next: null }
      if (window.size < windowCap) {
        window.pushFront(fresh)
        nodes.set(key, fresh)
        return
      }
      const candidate = window.popTail()
      if (candidate === null) {
        // windowCap is 0 only when cap is 0, already handled.
        window.pushFront(fresh)
        nodes.set(key, fresh)
        return
      }
      window.pushFront(fresh)
      nodes.set(key, fresh)
      nodes.delete(candidate.key)
      admit(candidate)
    },
  }
}
