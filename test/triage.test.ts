import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  fetchAlerts,
  parseLedger,
  parseTriageInput,
  parseWindow,
  prepareTriage,
  resolveTriageDir,
  sanitizeFeedText,
  type FetchLike,
} from '../src/triage.ts'

const NOW = Date.UTC(2026, 10, 16, 16, 0, 0)

function alert(slug: string, time: number, packages: string[] = ['pkg'], rules: string[] = ['C001']) {
  return {
    slug,
    time,
    iso: new Date(time * 1000).toISOString(),
    title: `TrustSight: ${packages.join(', ')} scored 20`,
    headline: `${packages.join(', ')} scored 20`,
    packages,
    rules,
    counts: { alerts: 1, over_threshold: 1, ioc: 0, impersonation: 0 },
  }
}

async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'dsh-totem-triage-'))
}

function fixedFetch(alerts: unknown[], pages = 1): FetchLike {
  let calls = 0
  return async () => {
    calls += 1
    const perPage = Math.ceil(alerts.length / pages)
    const start = (calls - 1) * perPage
    const items = alerts.slice(start, start + perPage)
    const more = calls < pages
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items,
        next: more ? { before: 1794843996 - calls, beforeRow: 100 + calls } : null,
      }),
    }
  }
}

describe('triage ledger', () => {
  test('ignores malformed lines and keeps the newest duplicate', () => {
    const ledger = parseLedger([
      'not json',
      '{"slug":"bad slug"}',
      '{"slug":"2026-11-15/100000","triaged_at":"2026-11-15T10:00:00Z"}',
      '{"slug":"2026-11-15/100000","triaged_at":"2026-11-16T10:00:00Z","packages":["a"]}',
      '{"slug":"2026-11-14/090000","triaged_at":"2026-11-14T09:00:00Z"}',
    ].join('\n'))
    expect(ledger.entries.size).toBe(2)
    expect(ledger.entries.get('2026-11-15/100000')?.triagedAt).toBe('2026-11-16T10:00:00Z')
    expect(ledger.entries.get('2026-11-15/100000')?.packages).toEqual(['a'])
    expect(ledger.entries.get('2026-11-15/100000')?.complete).toBe(false)
    expect(ledger.newest).toBe(Date.parse('2026-11-15T10:00:00Z'))
  })

  test('marks evidence-backed complete entries and screening entries separately', () => {
    const ledger = parseLedger([
      '{"slug":"2026-11-15/100000","status":"complete","core":{},"packages":["a"],"verdicts":{"a":"BFP"},"evidence":[{"package":"a","quote":"pkgver=1"}]}',
      '{"slug":"2026-11-15/110000","status":"screened","verdicts":{"a":"MFP"}}',
      '{"slug":"2026-11-15/113000","status":"complete","core":{},"packages":["a","b"],"verdicts":{"a":"BFP"},"evidence":[{"package":"a","quote":"pkgver=1"}]}',
      '{"slug":"2026-11-15/120000","core":{},"verdicts":{"a":"MFP"}}',
    ].join('\n'))
    expect(ledger.entries.get('2026-11-15/100000')?.complete).toBe(true)
    expect(ledger.entries.get('2026-11-15/110000')?.complete).toBe(false)
    expect(ledger.entries.get('2026-11-15/113000')?.complete).toBe(false)
    expect(ledger.entries.get('2026-11-15/120000')?.complete).toBe(true)
  })

  test('falls back to the slug time when triaged_at is absent', () => {
    const ledger = parseLedger('{"slug":"2026-11-15/101112"}')
    expect(ledger.newest).toBe(Date.parse('2026-11-15T10:11:12Z'))
  })
})

describe('triage window', () => {
  test('uses a one-day overlap around the last triage', () => {
    const newest = Date.parse('2026-11-16T10:00:00Z')
    const window = parseWindow('', newest, NOW, 7)
    expect('error' in window).toBe(false)
    if ('error' in window) return
    expect(window.from).toBe(Math.floor(newest / 1000) - 86_400)
    expect(window.label).toContain('last triage')
  })

  test('uses the configured lookback when the ledger is empty', () => {
    const window = parseWindow('', undefined, NOW, 3)
    if ('error' in window) throw new Error(window.error)
    expect(window.from).toBe(Math.floor(NOW / 1000) - 3 * 86_400)
    expect(window.label).toBe('last 3 days')
  })

  test('accepts days, dates, and all', () => {
    const days = parseWindow('30d', undefined, NOW, 7)
    if ('error' in days) throw new Error(days.error)
    expect(days.from).toBe(Math.floor(NOW / 1000) - 30 * 86_400)

    const date = parseWindow('2026-11-14', undefined, NOW, 7)
    if ('error' in date) throw new Error(date.error)
    expect(date.from).toBe(Math.floor(Date.parse('2026-11-14T00:00:00Z') / 1000))

    const all = parseWindow('all', undefined, NOW, 7)
    if ('error' in all) throw new Error(all.error)
    expect(all.from).toBeUndefined()
  })

  test('accepts an hour window', () => {
    const hours = parseWindow('12h', undefined, NOW, 7)
    if ('error' in hours) throw new Error(hours.error)
    expect(hours.from).toBe(Math.floor(NOW / 1000) - 12 * 3_600)
    expect(hours.label).toBe('last 12 hours')

    const one = parseWindow('1h', undefined, NOW, 7)
    if ('error' in one) throw new Error(one.error)
    expect(one.label).toBe('last 1 hour')
  })

  test('rejects an impossible date', () => {
    expect(parseWindow('2026-02-31', undefined, NOW, 7)).toEqual({ error: expect.any(String) })
  })
})

describe('triage input', () => {
  test('reads a window and a limit in either order', () => {
    expect(parseTriageInput('7d --limit 5')).toEqual({ window: '7d', limit: 5 })
    expect(parseTriageInput('6h --limit 5')).toEqual({ window: '6h', limit: 5 })
    expect(parseTriageInput('--limit 0 all')).toEqual({ window: 'all', limit: 0 })
  })

  test('rejects unknown options and two windows', () => {
    expect(parseTriageInput('--nope')).toEqual({ error: expect.any(String) })
    expect(parseTriageInput('7d 30d')).toEqual({ error: expect.any(String) })
  })
})

describe('triage feed', () => {
  test('collapses untrusted text to one line', () => {
    expect(sanitizeFeedText('line one\nline two\u0000')).toBe('line one line two')
  })

  test('pages through next cursors and deduplicates slugs', async () => {
    const two = alert('2026-11-15/100000', 1_760_000_000)
    const one = alert('2026-11-16/100000', 1_760_100_000)
    const result = await fetchAlerts({
      baseUrl: 'https://watcher.test',
      to: 1_760_200_000,
      signal: new AbortController().signal,
      fetchImpl: fixedFetch([two, one], 2),
    })
    expect(result.truncated).toBe(false)
    expect(result.alerts.map(item => item.slug).sort())
      .toEqual(['2026-11-15/100000', '2026-11-16/100000'])
  })

  test('reports a non-200 response', async () => {
    await expect(fetchAlerts({
      baseUrl: 'https://watcher.test',
      to: 1_760_200_000,
      signal: new AbortController().signal,
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    })).rejects.toThrow('HTTP 429')
  })
})

describe('triage preparation', () => {
  test('queues only untriaged alerts and asks for persistence', async () => {
    const cwd = await workspace()
    try {
      const dir = join(cwd, 'alert-triage')
      await mkdir(dir, { recursive: true })
      const triagedAt = new Date(NOW - 60_000).toISOString()
      await writeFile(join(dir, 'ledger.jsonl'), [
        JSON.stringify({
          slug: '2026-11-16/100000',
          status: 'complete',
          triaged_at: triagedAt,
          core: { action: 'current' },
          packages: ['old'],
          verdicts: { old: 'BFP' },
          evidence: [{ package: 'old', kind: 'diff', locator: 'PKGBUILD', quote: 'pkgver=1' }],
        }),
      ].join('\n'))

      const result = await prepareTriage({
        cwd,
        rawInput: '7d',
        options: { dir: '', feedUrl: 'https://watcher.test', windowDays: 7, batch: 20 },
        now: NOW,
        signal: new AbortController().signal,
        fetchImpl: fixedFetch([
          alert('2026-11-16/100000', 1_760_000_000),
          alert('2026-11-16/120000', 1_760_100_000, ['new-pkg']),
        ]),
      })
      if (result.kind !== 'prompt') throw new Error(`expected prompt, got ${result.kind}`)
      expect(result.prompt).toContain(join(dir, 'ledger.jsonl'))
      expect(result.prompt).toContain('reports')
      expect(result.prompt).toContain('BFP')
      expect(result.prompt).toContain('MFP')
      expect(result.prompt).toContain('TP')
      expect(result.prompt).toContain('Untrusted data')
      expect(result.prompt).toContain('MFP at HEAD')
      expect(result.prompt).toContain('analyze_diff')
      expect(result.prompt).toContain('fixed-at-head')
      expect(result.prompt).toContain('Adversarial default')
      expect(result.prompt).toContain('possible TPs first')
      expect(result.prompt).toContain('what proves it is not')
      expect(result.prompt).toContain('never downgrade an unexplained path to MFP')
      expect(result.prompt).toContain('Campaign and threshold sweep')
      expect(result.prompt).toContain('feed_campaigns')
      expect(result.prompt).toContain('feed_campaign')
      expect(result.prompt).toContain('over_threshold')
      expect(result.prompt).toContain('repo_file')
      expect(result.prompt).toContain('"status":"complete"')
      expect(result.prompt).toContain('"status":"screened"')
      expect(result.prompt).toContain('Every package needs at least one evidence item')

      const files = await readFile(join(dir, 'README.md'), 'utf8')
      expect(files).toContain('ledger.jsonl')
      expect(files).toContain('head_checks')
      expect(files).toContain('Possible TPs are analyzed first')
      const queuePath = /Queue: ([^\n]+)/u.exec(result.prompt)?.[1] ?? ''
      const queue = JSON.parse(await readFile(queuePath, 'utf8'))
      expect(queue.queued).toBe(1)
      expect(queue.alerts[0].slug).toBe('2026-11-16/120000')
      expect(queue.alerts[0].packages).toEqual(['new-pkg'])
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('returns empty after every queued alert is in the ledger', async () => {
    const cwd = await workspace()
    try {
      const dir = join(cwd, 'alert-triage')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'ledger.jsonl'), [
        JSON.stringify({
          slug: '2026-11-16/100000',
          status: 'complete',
          triaged_at: new Date(NOW).toISOString(),
          core: { action: 'current' },
          packages: ['old'],
          verdicts: { old: 'BFP' },
          evidence: [{ package: 'old', kind: 'diff', locator: 'PKGBUILD', quote: 'pkgver=1' }],
        }),
      ].join('\n'))
      const result = await prepareTriage({
        cwd,
        rawInput: '7d',
        options: { dir: '', feedUrl: 'https://watcher.test', windowDays: 7, batch: 20 },
        now: NOW,
        signal: new AbortController().signal,
        fetchImpl: fixedFetch([alert('2026-11-16/100000', 1_760_000_000)]),
      })
      expect(result.kind).toBe('empty')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('re-queues a screening-only ledger entry', async () => {
    const cwd = await workspace()
    try {
      const dir = join(cwd, 'alert-triage')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'ledger.jsonl'), [
        JSON.stringify({
          slug: '2026-11-16/100000',
          status: 'screened',
          triaged_at: new Date(NOW).toISOString(),
          packages: ['old'],
          summary: 'no evidence',
        }),
      ].join('\n'))
      const result = await prepareTriage({
        cwd,
        rawInput: '7d',
        options: { dir: '', feedUrl: 'https://watcher.test', windowDays: 7, batch: 20 },
        now: NOW,
        signal: new AbortController().signal,
        fetchImpl: fixedFetch([alert('2026-11-16/100000', 1_760_000_000)]),
      })
      if (result.kind !== 'prompt') throw new Error(`expected prompt, got ${result.kind}`)
      expect(result.prompt).toContain('Screening-only ledger rows in scope: 1')
      const queuePath = /Queue: ([^\n]+)/u.exec(result.prompt)?.[1] ?? ''
      const queue = JSON.parse(await readFile(queuePath, 'utf8'))
      expect(queue.queued).toBe(1)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('widens the default window to the oldest screening entry', async () => {
    const cwd = await workspace()
    try {
      const dir = join(cwd, 'alert-triage')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'ledger.jsonl'), [
        JSON.stringify({
          slug: '2026-11-10/100000',
          status: 'screened',
          triaged_at: '2026-11-11T00:00:00.000Z',
          packages: ['old'],
        }),
        JSON.stringify({
          slug: '2026-11-16/090000',
          status: 'complete',
          triaged_at: '2026-11-16T10:00:00.000Z',
          packages: ['done'],
          verdicts: { done: 'BFP' },
          core: { action: 'current' },
          evidence: [{ package: 'done', quote: 'pkgver=1' }],
        }),
      ].join('\n'))
      const result = await prepareTriage({
        cwd,
        rawInput: '',
        options: { dir: '', feedUrl: 'https://watcher.test', windowDays: 7, batch: 20 },
        now: NOW,
        signal: new AbortController().signal,
        fetchImpl: fixedFetch([alert('2026-11-10/100000', 1_760_000_000)]),
      })
      if (result.kind !== 'prompt') throw new Error(`expected prompt, got ${result.kind}`)
      expect(result.prompt).toContain('screening backlog since 2026-11-11')
      expect(result.prompt).toContain('Screening-only ledger rows in scope: 1')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('queues a possible TP before an older low-signal alert', async () => {
    const cwd = await workspace()
    try {
      const result = await prepareTriage({
        cwd,
        rawInput: '7d --limit 1',
        options: { dir: '', feedUrl: 'https://watcher.test', windowDays: 7, batch: 1 },
        now: NOW,
        signal: new AbortController().signal,
        fetchImpl: fixedFetch([
          alert('2026-11-16/090000', 1_760_000_000, ['old-low'], ['G003']),
          alert('2026-11-16/120000', 1_760_100_000, ['new-tp'], ['E002']),
        ]),
      })
      if (result.kind !== 'prompt') throw new Error(`expected prompt, got ${result.kind}`)
      const queuePath = /Queue: ([^\n]+)/u.exec(result.prompt)?.[1] ?? ''
      const queue = JSON.parse(await readFile(queuePath, 'utf8'))
      expect(queue.alerts).toHaveLength(1)
      expect(queue.alerts[0].slug).toBe('2026-11-16/120000')
      expect(queue.alerts[0].priority).toBe('review-first')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('survives a feed failure with a fallback prompt', async () => {
    const cwd = await workspace()
    try {
      const result = await prepareTriage({
        cwd,
        rawInput: '',
        options: { dir: '', feedUrl: 'https://watcher.test', windowDays: 7, batch: 20 },
        now: NOW,
        signal: new AbortController().signal,
        fetchImpl: async () => { throw new Error('offline') },
      })
      if (result.kind !== 'prompt') throw new Error(`expected prompt, got ${result.kind}`)
      expect(result.text).toContain('fallback')
      expect(result.prompt).toContain('feed_search')
      expect(result.prompt).toContain('offline')
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('resolves relative, absolute, and home directories', () => {
    expect(resolveTriageDir('/work/project', '')).toBe('/work/project/alert-triage')
    expect(resolveTriageDir('/work/project', 'triage')).toBe('/work/project/triage')
    expect(resolveTriageDir('/work/project', '/tmp/triage')).toBe('/tmp/triage')
    expect(resolveTriageDir('/work/project', '~/alert-triage')).toContain('/alert-triage')
  })
})
