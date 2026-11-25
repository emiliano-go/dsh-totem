/** Watches: page-diff, RSS, and LLM-condition monitors delivered as notifications. */
import { createHash, randomUUID } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { JsonStore, statePath } from './store.ts'
import { sendNotification } from './notify.ts'
import { runOneShot } from './distill.ts'
import type { TotemService } from './service.ts'

/** One watch. */
export interface Watch {
  id: string
  kind: 'page' | 'rss' | 'condition'
  url: string
  condition?: string
  intervalMinutes: number
  active: boolean
  createdAt: string
  lastCheckedAt?: string
  lastHash?: string
  lastSeen?: string[]
  lastResult?: string
  completedAt?: string
}

const TICK_MS = 60_000
const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 20_000

function privateHost(host: string): boolean {
  const name = host.toLowerCase()
  if (name === 'localhost' || name.endsWith('.local') || name === '::1') return true
  if (/^127\./u.test(name) || /^10\./u.test(name) || /^192\.168\./u.test(name) || /^169\.254\./u.test(name)) return true
  const match = /^172\.(\d+)\./u.exec(name)
  return match !== null && Number(match[1]) >= 16 && Number(match[1]) <= 31
}

function assertUrl(url: string, allowPrivate: boolean): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`invalid URL: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('only http(s) URLs are supported')
  if (!allowPrivate && privateHost(parsed.hostname)) throw new Error(`private address blocked: ${parsed.hostname}`)
  return parsed
}

async function fetchText(url: string, allowPrivate: boolean): Promise<string> {
  assertUrl(url, allowPrivate)
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': 'dsh-totem-watch/0.1' },
  })
  if (!response.ok) throw new Error(`http ${response.status}`)
  const reader = response.body?.getReader()
  if (reader === undefined) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    chunks.push(value)
    if (size >= MAX_BYTES) {
      await reader.cancel()
      break
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).slice(0, MAX_BYTES))
}

function rssItems(text: string): { title: string; key: string }[] {
  const itemPattern = /<(item|entry)\b[\s\S]*?<\/\1>/giu
  const items: { title: string; key: string }[] = []
  for (const match of text.matchAll(itemPattern)) {
    const block = match[0]
    const title = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(block)?.[1]?.replace(/<!\[CDATA\[|\]\]>/gu, '').trim() ?? ''
    const link = /<link[^>]*href="([^"]+)"/iu.exec(block)?.[1]
      ?? /<link[^>]*>([\s\S]*?)<\/link>/iu.exec(block)?.[1]?.trim()
      ?? /<guid[^>]*>([\s\S]*?)<\/guid>/iu.exec(block)?.[1]?.trim()
    const key = link ?? title
    if (key.length > 0) items.push({ title: title || key, key })
  }
  return items.slice(0, 100)
}

/** Watch store, poller, and the tool surface. */
export class WatchService {
  private readonly store = new JsonStore<{ items: Watch[] }>(statePath('watches.json'), { items: [] })
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly ctx: Context,
    private readonly totem: TotemService,
  ) {}

  /** Start the poller. */
  start(): void {
    if (this.timer !== undefined) return
    void this.tick()
    this.timer = setInterval(() => { void this.tick() }, TICK_MS)
    this.timer.unref?.()
  }

  /** Stop the poller. */
  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
  }

  /** List watches. */
  async list(includeInactive = true): Promise<Watch[]> {
    const { items } = await this.store.read()
    return items.filter(item => includeInactive || item.active)
  }

  /** Add one watch. */
  async add(input: {
    kind: Watch['kind']
    url: string
    condition?: string
    intervalMinutes?: number
  }): Promise<Watch> {
    assertUrl(input.url, this.totem.config.watchAllowPrivate.get())
    if (input.kind === 'condition' && (input.condition ?? '').trim().length === 0) {
      throw new Error('condition watches require a condition')
    }
    const watch: Watch = {
      id: randomUUID(),
      kind: input.kind,
      url: input.url,
      ...input.kind === 'condition' ? { condition: input.condition } : {},
      intervalMinutes: Math.max(1, Math.floor(input.intervalMinutes ?? 15)),
      active: true,
      createdAt: new Date().toISOString(),
    }
    await this.store.update(current => ({ items: [...current.items, watch] }))
    return watch
  }

  /** Stop watching one id. */
  async cancel(id: string): Promise<boolean> {
    const { items } = await this.store.read()
    if (!items.some(item => item.id === id)) return false
    await this.store.update(current => ({
      items: current.items.map(item => item.id === id ? { ...item, active: false } : item),
    }))
    return true
  }

  /** Check one watch immediately. */
  async runNow(id: string): Promise<Watch | undefined> {
    const { items } = await this.store.read()
    const watch = items.find(item => item.id === id)
    if (watch === undefined) return undefined
    return this.check(watch)
  }

  /** Poll every due watch; never throws. */
  async tick(): Promise<void> {
    const now = Date.now()
    const { items } = await this.store.read()
    for (const watch of items) {
      if (!watch.active) continue
      const last = watch.lastCheckedAt === undefined ? 0 : new Date(watch.lastCheckedAt).getTime()
      if (now - last < watch.intervalMinutes * 60_000) continue
      await this.check(watch).catch(() => {})
    }
  }

  private async check(watch: Watch): Promise<Watch> {
    const allowPrivate = this.totem.config.watchAllowPrivate.get()
    let next: Watch = { ...watch, lastCheckedAt: new Date().toISOString() }
    try {
      const text = await fetchText(watch.url, allowPrivate)
      if (watch.kind === 'page') {
        const hash = createHash('sha256').update(text).digest('hex')
        const changed = watch.lastHash !== undefined && watch.lastHash !== hash
        next = { ...next, lastHash: hash, lastResult: changed ? 'changed' : 'unchanged' }
        if (changed) {
          await sendNotification(this.totem.config, {
            title: 'Watch changed',
            message: `${watch.url}\n\nThe page changed since the last check.`,
          })
        }
      } else if (watch.kind === 'rss') {
        const items = rssItems(text)
        const seen = new Set(watch.lastSeen ?? [])
        const fresh = items.filter(item => !seen.has(item.key)).slice(0, 5)
        next = { ...next, lastSeen: items.map(item => item.key).slice(0, 200), lastResult: `${fresh.length} new` }
        if (fresh.length > 0) {
          await sendNotification(this.totem.config, {
            title: 'New feed items',
            message: `${watch.url}\n\n${fresh.map(item => `- ${item.title}`).join('\n')}`,
          })
        }
      } else {
        const target = this.totem.target()
        const answer = target === undefined
          ? undefined
          : await runOneShot(
            this.ctx,
            target,
            'You evaluate whether a web page satisfies a condition. Answer YES or NO on the first line, then one short reason.',
            `Condition: ${watch.condition ?? ''}\n\nPage text:\n${text.slice(0, 12000)}`,
          )
        const met = answer !== undefined && /^\s*yes\b/iu.test(answer)
        next = { ...next, lastResult: met ? 'met' : 'not met' }
        if (met) {
          next = { ...next, active: false, completedAt: next.lastCheckedAt }
          await sendNotification(this.totem.config, {
            title: 'Watch condition met',
            message: `${watch.url}\n\nCondition: ${watch.condition ?? ''}\n\n${answer?.slice(0, 500) ?? ''}`,
            priority: 'high',
          })
        }
      }
    } catch (error) {
      next = { ...next, lastResult: `error: ${error instanceof Error ? error.message : String(error)}` }
    }
    await this.store.update(current => ({
      items: current.items.map(item => item.id === watch.id ? next : item),
    }))
    return next
  }
}

/** Register the watch tools. */
export function registerWatchTools(ctx: Context, watches: WatchService): void {
  const render = (value: unknown): { type: 'text'; text: string }[] => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }]
  ctx.tools.register(defineTool({
    name: 'watch_add',
    description: 'Watch a page for changes, a feed for new items, or a page until an LLM-checked condition is met. Updates arrive as notifications.',
    parameters: {
      kind: { type: 'string', required: true, enum: ['page', 'rss', 'condition'], description: 'Watch kind.' },
      url: { type: 'string', required: true, description: 'HTTP(S) URL to poll.' },
      condition: { type: 'string', description: 'YES/NO condition for kind=condition.' },
      interval_minutes: { type: 'number', description: 'Poll interval in minutes (default 15).' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return watches.add({
        kind: args.kind,
        url: args.url,
        condition: args.condition,
        intervalMinutes: args.interval_minutes,
      })
    },
  }))
  ctx.tools.register(defineTool({
    name: 'watch_list',
    description: 'List configured watches and their last result.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute() {
      return watches.list()
    },
  }))
  ctx.tools.register(defineTool({
    name: 'watch_cancel',
    description: 'Stop a watch by id.',
    parameters: {
      id: { type: 'string', required: true, description: 'Watch id.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return { canceled: await watches.cancel(args.id) }
    },
  }))
}
