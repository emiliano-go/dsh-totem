// Local candidate: W-TinyLFU (window LRU + SLRU main + count-min admission).
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

class LRU {
  head: Node | null = null
  tail: Node | null = null
  size = 0
  moveFront(n: Node): void {
    if (this.head === n) return
    this.detach(n)
    n.next = this.head
    if (this.head) this.head.prev = n
    this.head = n
    if (!this.tail) this.tail = n
    this.size++
  }
  pushFront(n: Node): void {
    n.prev = null
    n.next = this.head
    if (this.head) this.head.prev = n
    this.head = n
    if (!this.tail) this.tail = n
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
}

export function createCache(capacity: number): Cache {
  const cap = Math.max(0, Math.floor(capacity))
  const windowCap = cap <= 2 ? cap : Math.max(1, Math.round(cap * 0.01))
  const mainCap = cap - windowCap
  const protectedCap = mainCap === 0 ? 0 : Math.max(1, Math.round(mainCap * 0.8))

  const map = new Map<string, Node>()
  const window = new LRU()
  const probation = new LRU()
  const protectedLru = new LRU()
  let mainSize = 0

  let width = 16
  while (width < cap * 8 && width < 1 << 22) width <<= 1
  width = Math.max(16, width)
  const table = new Uint8Array(width)
  const mask = width - 1
  let additions = 0
  const sample = Math.max(1000, cap * 10)
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
  const seeds = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f]
  const bump = (key: string): void => {
    for (let i = 0; i < 4; i++) {
      const idx = hash(key, seeds[i]!)
      if (table[idx]! < 15) table[idx]!++
    }
    if (++additions >= sample) {
      additions = 0
      for (let i = 0; i < table.length; i++) table[i]! >>>= 1
    }
  }
  const estimate = (key: string): number => {
    let min = 15
    for (let i = 0; i < 4; i++) {
      const v = table[hash(key, seeds[i]!)]!
      if (v < min) min = v
    }
    return min
  }

  const removeMain = (n: Node): void => {
    if (n.where === 'q') protectedLru.detach(n)
    else probation.detach(n)
    map.delete(n.key)
    mainSize--
  }

  const demote = (): void => {
    while (protectedLru.size > protectedCap) {
      const n = protectedLru.popTail()
      if (!n) return
      n.where = 'p'
      probation.pushFront(n)
    }
  }

  const admit = (candidate: Node): void => {
    if (mainCap === 0) return
    if (mainSize < mainCap) {
      candidate.where = 'p'
      probation.pushFront(candidate)
      map.set(candidate.key, candidate)
      mainSize++
      return
    }
    let victim = probation.tail
    if (!victim) {
      const d = protectedLru.popTail()
      if (!d) return
      d.where = 'p'
      probation.pushFront(d)
      victim = d
    }
    if (estimate(candidate.key) > estimate(victim.key)) {
      removeMain(victim)
      candidate.where = 'p'
      probation.pushFront(candidate)
      map.set(candidate.key, candidate)
      mainSize++
    }
  }

  const access = (n: Node): void => {
    bump(n.key)
    if (n.where === 'w') {
      window.moveFront(n)
    } else if (n.where === 'p') {
      probation.detach(n)
      n.where = 'q'
      protectedLru.pushFront(n)
      demote()
    } else {
      protectedLru.moveFront(n)
    }
  }

  return {
    get(key) {
      const n = map.get(key)
      if (!n) {
        bump(key)
        return undefined
      }
      access(n)
      return n.value
    },
    put(key, value) {
      const n = map.get(key)
      if (n) {
        n.value = value
        access(n)
        return
      }
      if (cap === 0) return
      bump(key)
      const fresh: Node = { key, value, where: 'w', prev: null, next: null }
      if (window.size < windowCap) {
        window.pushFront(fresh)
        map.set(key, fresh)
        return
      }
      const candidate = window.popTail()
      window.pushFront(fresh)
      map.set(key, fresh)
      if (candidate) {
        map.delete(candidate.key)
        admit(candidate)
      }
    },
  }
}
