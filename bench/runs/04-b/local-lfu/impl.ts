// Local candidate: exact bucketed LFU with per-frequency recency and periodic aging.
export interface Cache {
  get(key: string): string | undefined
  put(key: string, value: string): void
}

interface Entry {
  key: string
  value: string
  freq: number
  prev: Entry | null
  next: Entry | null
}

interface Bucket {
  head: Entry | null
  tail: Entry | null
}

export function createCache(capacity: number): Cache {
  const entries = new Map<string, Entry>()
  let buckets = new Map<number, Bucket>()
  let minFreq = 1
  let ticks = 0
  const ageEvery = Math.max(4000, capacity * 10)

  const detach = (e: Entry): void => {
    if (e.prev) e.prev.next = e.next
    if (e.next) e.next.prev = e.prev
    if (e.prev === null && e.next === null) {
      // may be the bucket's only entry; handled by caller via tail cleanup
    }
    e.prev = null
    e.next = null
  }

  const removeFromBucket = (e: Entry): void => {
    const b = buckets.get(e.freq)
    if (!b) return
    if (b.head === e) b.head = e.next
    if (b.tail === e) b.tail = e.prev
    if (e.prev) e.prev.next = e.next
    if (e.next) e.next.prev = e.prev
    e.prev = null
    e.next = null
    if (b.head === null) {
      buckets.delete(e.freq)
      if (e.freq === minFreq) minFreq = e.freq + 1
    }
  }

  const pushFront = (e: Entry, freq: number): void => {
    e.freq = freq
    let b = buckets.get(freq)
    if (!b) {
      b = { head: null, tail: null }
      buckets.set(freq, b)
    }
    e.prev = null
    e.next = b.head
    if (b.head) b.head.prev = e
    b.head = e
    if (!b.tail) b.tail = e
    if (freq < minFreq) minFreq = freq
  }

  const evictOne = (): void => {
    let b = buckets.get(minFreq)
    while (!b) {
      minFreq++
      b = buckets.get(minFreq)
    }
    const victim = b.tail
    if (!victim) return
    removeFromBucket(victim)
    entries.delete(victim.key)
  }

  const age = (): void => {
    const old = [...entries.values()]
    buckets = new Map()
    for (const e of old) {
      e.prev = null
      e.next = null
      const nf = e.freq > 2 ? Math.floor(e.freq / 2) : 1
      pushFront(e, nf)
    }
    minFreq = 1
  }

  return {
    get(key) {
      const e = entries.get(key)
      if (!e) return undefined
      const nextFreq = e.freq + 1
      removeFromBucket(e)
      pushFront(e, nextFreq)
      if (++ticks >= ageEvery) {
        ticks = 0
        age()
      }
      return e.value
    },
    put(key, value) {
      const e = entries.get(key)
      if (e) {
        e.value = value
        const nextFreq = e.freq + 1
        removeFromBucket(e)
        pushFront(e, nextFreq)
        return
      }
      if (capacity <= 0) return
      if (entries.size >= capacity) evictOne()
      const fresh: Entry = { key, value, freq: 1, prev: null, next: null }
      entries.set(key, fresh)
      pushFront(fresh, 1)
      if (++ticks >= ageEvery) {
        ticks = 0
        age()
      }
    },
  }
}
