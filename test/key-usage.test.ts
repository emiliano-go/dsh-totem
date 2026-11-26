import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readKeyUsage } from '../src/key-usage.ts'

const NOW = Date.UTC(2026, 10, 26, 15, 0, 0)

describe('OpenCode key usage', () => {
  test('masks each key and returns its current meters and pool state', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-key-usage-'))
    const authPath = join(home, 'auth.json')
    try {
      const first = 'oc_sk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1111'
      const second = 'oc_sk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2222'
      writeFileSync(authPath, JSON.stringify({
        'opencode-go': {
          type: 'api',
          key: first,
          keys: [first, second],
          suspended: { [hash(first)]: NOW + 60_000 },
        },
      }))
      const seen: string[] = []
      const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
        seen.push(new Headers(init?.headers).get('authorization') ?? '')
        return new Response(JSON.stringify({
          usage: {
            rolling: { status: 'ok', percent: 3, resetsAt: '2026-11-26T19:00:00.000Z' },
            weekly: { status: 'rate-limited', percent: 100, resetsAt: '2026-11-30T00:00:00.000Z' },
            monthly: { status: 'ok', percent: 12, resetsAt: '2026-12-01T00:00:00.000Z' },
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }) as typeof fetch

      const usage = await readKeyUsage({ authPath, fetchImpl, now: NOW })
      expect(usage.keys).toHaveLength(2)
      expect(usage.keys[0].masked).toBe('oc_sk_aaaa…1111')
      expect(usage.keys[0].state).toBe('suspended')
      expect(usage.keys[0].usage?.weekly).toEqual({
        status: 'rate-limited',
        percent: 100,
        resetsAt: '2026-11-30T00:00:00.000Z',
      })
      expect(usage.keys[1].state).toBe('usable')
      expect(seen).toEqual([
        `Bearer ${first}`,
        `Bearer ${second}`,
      ])
      expect(JSON.stringify(usage)).not.toContain(first)
      expect(JSON.stringify(usage)).not.toContain(second)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('returns no cards when the auth pool is absent', async () => {
    const usage = await readKeyUsage({
      authPath: join(tmpdir(), 'definitely-missing-encoder-auth.json'),
      fetchImpl: (async () => { throw new Error('must not fetch') }) as unknown as typeof fetch,
    })
    expect(usage.keys).toEqual([])
  })

  test('keeps every card when the pool has four keys', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-key-usage-four-'))
    const authPath = join(home, 'auth.json')
    const keys = ['1111', '2222', '3333', '4444'].map(suffix => `oc_sk_${'x'.repeat(28)}${suffix}`)
    try {
      writeFileSync(authPath, JSON.stringify({
        'opencode-go': { type: 'api', key: keys[0], keys },
      }))
      const fetchImpl = (async () => new Response(JSON.stringify({
        usage: {
          rolling: { status: 'ok', percent: 1, resetsAt: null },
          weekly: { status: 'ok', percent: 2, resetsAt: null },
          monthly: { status: 'ok', percent: 3, resetsAt: null },
        },
      }), { status: 200 })) as unknown as typeof fetch
      const usage = await readKeyUsage({ authPath, fetchImpl, now: NOW })
      expect(usage.keys).toHaveLength(4)
      expect(new Set(usage.keys.map(card => card.id)).size).toBe(4)
      expect(new Set(usage.keys.map(card => card.masked)).size).toBe(4)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

function hash(key: string): string {
  return require('node:crypto').createHash('sha256').update(key).digest('hex').slice(0, 16)
}
