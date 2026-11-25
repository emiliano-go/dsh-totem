import { describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ENTRY = process.env.STORE_ENTRY


const TARGETS = JSON.parse(
  readFileSync(join(import.meta.dir, '..', 'targets.json'), 'utf8'),
) as { min_puts_per_second: number; durable_write_p99_ms: number; writes: number }

describe('durable write throughput on the repository filesystem', () => {
  test('acknowledged writes sustain the pre-registered throughput', async () => {
    const { openStore } = await import(ENTRY as string)
    // Not tmpdir(): the cost that matters is the real disk's fsync.
    const dir = join(process.cwd(), '.bench-throughput')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })

    const store = await openStore(dir)
    // Writes must be able to overlap: a design that batches fsync across callers
    // cannot be measured by a strictly sequential loop.
    const CONCURRENCY = 32
    let next = 0
    const started = performance.now()
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const index = next++
        if (index >= TARGETS.writes) return
        await store.put(`k${index}`, `value-${index}-${'x'.repeat(48)}`)
      }
    })
    await Promise.all(workers)
    const elapsed = performance.now() - started
    await store.close()
    rmSync(dir, { recursive: true, force: true })

    const perSecond = TARGETS.writes / (elapsed / 1000)
    expect(Math.round(perSecond)).toBeGreaterThanOrEqual(TARGETS.min_puts_per_second)
  }, 120_000)
})
