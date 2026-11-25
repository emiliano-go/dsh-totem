import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { openStore } from './store.ts'

type Measured = { conc: number; puts_per_second: number; p50_ms: number; p99_ms: number; max_ms: number }
const WRITES = 2000
const VALUE = (i: number) => `value-${i}-${'x'.repeat(48)}`
const root = mkdtempSync(join(process.cwd(), '.bench-final-'))

async function run(conc: number): Promise<Measured> {
  const dir = join(root, `c${conc}`)
  const store = await openStore(dir)
  const lat: number[] = new Array(WRITES)
  let next = 0
  const t0 = performance.now()
  await Promise.all(Array.from({ length: conc }, async () => {
    for (;;) {
      const i = next++
      if (i >= WRITES) return
      const a = performance.now()
      await store.put(`k${i}`, VALUE(i))
      lat[i] = performance.now() - a
    }
  }))
  const ms = performance.now() - t0
  await store.close()
  const sorted = lat.slice().sort((a, b) => a - b)
  return {
    conc,
    puts_per_second: Math.round(WRITES / (ms / 1000)),
    p50_ms: +sorted[WRITES >> 1].toFixed(2),
    p99_ms: +sorted[Math.floor(WRITES * 0.99)].toFixed(2),
    max_ms: +sorted[WRITES - 1].toFixed(2),
  }
}

const rows = []
for (const conc of [1, 32, 128]) rows.push(await run(conc))
rmSync(root, { recursive: true, force: true })
console.log(JSON.stringify(rows, null, 1))
