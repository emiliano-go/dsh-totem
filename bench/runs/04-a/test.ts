/** Correctness tests for cache.ts. Run: bun test test.ts */
import { describe, expect, test } from 'bun:test'
import { createCache } from './cache.ts'

/** Tracks resident size without exposing internals by using a probe key set. */
function residentCount(cache: ReturnType<typeof createCache>, keys: string[]): number {
  let n = 0
  for (const k of keys) if (cache.get(k) !== undefined) n++
  return n
}

describe('cache', () => {
  test('basic put/get/overwrite/miss', () => {
    const c = createCache(10)
    expect(c.get('a')).toBeUndefined()
    c.put('a', '1')
    expect(c.get('a')).toBe('1')
    c.put('a', '2')
    expect(c.get('a')).toBe('2')
    c.put('b', '')
    expect(c.get('b')).toBe('')
  })

  test('never grows past capacity', () => {
    const cap = 50
    const c = createCache(cap)
    const keys: string[] = []
    for (let i = 0; i < 10_000; i++) {
      const k = `k${i}`
      keys.push(k)
      c.put(k, `v${i}`)
      if (i >= cap * 4) {
        const live = keys.slice(i - cap * 4).filter((k) => c.get(k) !== undefined)
        expect(live.length).toBeLessThanOrEqual(cap)
      }
    }
  })

  test('capacity 0 is a no-op cache', () => {
    const c = createCache(0)
    c.put('a', '1')
    expect(c.get('a')).toBeUndefined()
  })

  test('capacity 1 keeps only the newest key', () => {
    const c = createCache(1)
    c.put('a', '1')
    c.put('b', '2')
    expect(c.get('b')).toBe('2')
    expect(c.get('a')).toBeUndefined()
  })

  test('hot keys survive churn of cold keys', () => {
    const c = createCache(100)
    for (let r = 0; r < 50; r++) {
      for (let i = 0; i < 10; i++) c.put(`hot${i}`, `h${i}`)
      for (let j = 0; j < 500; j++) c.get(`hot${j % 10}`)
      for (let j = 0; j < 300; j++) c.put(`cold${r}-${j}`, 'x')
    }
    for (let i = 0; i < 10; i++) expect(c.get(`hot${i}`)).toBe(`h${i}`)
  })

  test('negative / fractional / non-finite capacity', () => {
    expect(createCache(-5).get('a')).toBeUndefined()
    const c = createCache(2.9)
    c.put('a', '1')
    c.put('b', '2')
    c.put('c', '3')
    // rounded down to 2: no more than two keys may be resident
    const resident = ['a', 'b', 'c'].filter((k) => c.get(k) !== undefined)
    expect(resident.length).toBeLessThanOrEqual(2)
    // the most recently stored key is always resident
    expect(c.get('c')).toBe('3')
    expect(() => createCache(NaN)).toThrow()
  })

  test('interleaved gets and puts keep stored values exact', () => {
    const c = createCache(200)
    const model = new Map<string, string>()
    let seed = 12345
    const rnd = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
      return seed / 4294967296
    }
    for (let i = 0; i < 20_000; i++) {
      const k = `k${Math.floor(rnd() * 500)}`
      if (rnd() < 0.5) {
        const got = c.get(k)
        // a policy may drop a cold key, but a hit must return the latest write
        if (got !== undefined) expect(got).toBe(model.get(k))
      } else {
        const v = `v${i}`
        c.put(k, v)
        model.set(k, v)
      }
    }
    // every resident must report its latest written value
    for (const [k, v] of model) {
      const got = c.get(k)
      if (got !== undefined) expect(got).toBe(v)
    }
  })

  test('large strings and unicode keys', () => {
    const c = createCache(1000)
    const big = 'x'.repeat(100_000)
    c.put('big', big)
    expect(c.get('big')).toBe(big)
    c.put('ключ🎯', 'v')
    expect(c.get('ключ🎯')).toBe('v')
  })
})
