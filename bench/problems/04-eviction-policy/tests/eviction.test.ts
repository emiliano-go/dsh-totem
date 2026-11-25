import { describe, expect, test } from 'bun:test'

const ENTRY = process.env.STORE_ENTRY
if (ENTRY === undefined) throw new Error('STORE_ENTRY must point at the solution cache.ts')

const TARGETS = JSON.parse(process.env.BENCH_TARGETS ?? '{}') as {
  capacity: number
  min_hit_rate: number
  accesses: number
}

const seeded = (seed: number) => {
  let state = seed >>> 0
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}
const random = seeded(424242)

// Skewed popularity: a few keys carry most accesses.
const POOL = 20_000
const weights = Array.from({ length: POOL }, (_, index) => 1 / (index + 1))
const total = weights.reduce((sum, weight) => sum + weight, 0)
const cumulative: number[] = []
let running = 0
for (const weight of weights) { running += weight / total; cumulative.push(running) }

const pickPopular = (): number => {
  const roll = random()
  let low = 0
  let high = cumulative.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if ((cumulative[mid] as number) < roll) low = mid + 1
    else high = mid
  }
  return low
}

// The trace: 92% skewed popularity, 8% sequential scans that touch keys nothing
// else uses, which is the part that punishes recency-only eviction.
const trace: string[] = []
let scanCursor = 1_000_000
for (let index = 0; index < TARGETS.accesses; index += 1) {
  if (random() < 0.08) {
    trace.push(`scan${scanCursor}`)
    scanCursor += 1
  } else {
    trace.push(`k${pickPopular()}`)
  }
}

describe('eviction policy', () => {
  test('the hit rate on the graded trace clears the floor', async () => {
    const { createCache } = await import(ENTRY as string)
    const cache = createCache(TARGETS.capacity)
    let hits = 0
    for (const key of trace) {
      if (cache.get(key) !== undefined) hits += 1
      else cache.put(key, 'v')
    }
    const hitRate = hits / trace.length
    console.log(`MEASURE ${JSON.stringify({ hit_rate: Number(hitRate.toFixed(4)) })}`)
    expect({ hit: hitRate >= TARGETS.min_hit_rate }).toEqual({ hit: true })
  }, 180_000)
})
