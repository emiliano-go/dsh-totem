import { describe, expect, test } from 'bun:test'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openStore } from './store.ts'

const dirs: string[] = []
const dir = () => { const d = mkdtempSync(join(tmpdir(), 'own-')); dirs.push(d); return d }

describe('own invariants', () => {
  test('torn trailing record cannot swallow the next acknowledged write', async () => {
    const d = dir()
    const s = await openStore(d)
    await s.put('a', '1'); await s.close()
    // kill -9 mid-append: bytes are in the page cache, no trailing newline
    appendFileSync(join(d, 'data.log'), '{"k":"z","v":')
    const r = await openStore(d)
    await r.put('b', '2'); await r.close()
    const again = await openStore(d)
    expect(again.get('a')).toBe('1')
    expect(again.get('b')).toBe('2')
    expect(again.get('z')).toBeUndefined()
    await again.close()
    rmSync(d, { recursive: true, force: true })
  })

  test('concurrent puts and deletes settle in one durable order; close is idempotent', async () => {
    const d = dir()
    const s = await openStore(d)
    await Promise.all([
      ...Array.from({ length: 100 }, (_, i) => s.put(`k${i}`, `v${i}`)),
      ...Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? s.delete(`k${i}`) : undefined)),
    ].filter(Boolean) as Promise<void>[])
    await s.close(); await s.close()
    const r = await openStore(d)
    expect(r.get('k0')).toBeUndefined()
    expect(r.get('k1')).toBe('v1')
    expect(r.get('k99')).toBe('v99')
    await r.close()
    rmSync(d, { recursive: true, force: true })
  })
})
