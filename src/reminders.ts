/** Reminders: durable local nudges delivered through the notification channels. */
import { randomUUID } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { JsonStore, statePath } from './store.ts'
import { sendNotification } from './notify.ts'
import type { TotemService } from './service.ts'

/** One reminder. */
export interface Reminder {
  id: string
  text: string
  nextAt: string
  recurrence: 'once' | 'daily' | 'weekly'
  createdAt: string
  done: boolean
}

const TICK_MS = 30_000

function validDate(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`invalid date: ${value}`)
  return date
}

/** Reminder store, timer, and the tool surface. */
export class ReminderService {
  private readonly store = new JsonStore<{ items: Reminder[] }>(statePath('reminders.json'), { items: [] })
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly ctx: Context,
    private readonly totem: TotemService,
  ) {}

  /** Start the delivery loop. */
  start(): void {
    if (this.timer !== undefined) return
    void this.tick()
    this.timer = setInterval(() => { void this.tick() }, TICK_MS)
    this.timer.unref?.()
  }

  /** Stop the delivery loop. */
  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
  }

  /** List reminders, soonest first. */
  async list(includeDone = false): Promise<Reminder[]> {
    const { items } = await this.store.read()
    return items
      .filter(item => includeDone || !item.done)
      .sort((a, b) => a.nextAt.localeCompare(b.nextAt))
  }

  /** Create one reminder. */
  async add(text: string, at: string, recurrence: Reminder['recurrence'] = 'once'): Promise<Reminder> {
    const reminder: Reminder = {
      id: randomUUID(),
      text: text.trim(),
      nextAt: validDate(at).toISOString(),
      recurrence,
      createdAt: new Date().toISOString(),
      done: false,
    }
    if (reminder.text.length === 0) throw new Error('text is required')
    await this.store.update(current => ({ items: [...current.items, reminder] }))
    return reminder
  }

  /** Cancel one reminder. */
  async cancel(id: string): Promise<boolean> {
    const { items } = await this.store.read()
    if (!items.some(item => item.id === id)) return false
    await this.store.update(current => ({ items: current.items.filter(item => item.id !== id) }))
    return true
  }

  /** Snooze one reminder. */
  async snooze(id: string, minutes: number): Promise<boolean> {
    const until = new Date(Date.now() + Math.max(1, minutes) * 60_000).toISOString()
    const { items } = await this.store.read()
    if (!items.some(item => item.id === id && !item.done)) return false
    await this.store.update(current => ({
      items: current.items.map(item => item.id === id ? { ...item, nextAt: until } : item),
    }))
    return true
  }

  /** Mark one reminder done. */
  async done(id: string): Promise<boolean> {
    const { items } = await this.store.read()
    if (!items.some(item => item.id === id)) return false
    await this.store.update(current => ({
      items: current.items.map(item => item.id === id ? { ...item, done: true } : item),
    }))
    return true
  }

  /** Deliver every due reminder. */
  async tick(): Promise<void> {
    const now = Date.now()
    const due = (await this.list()).filter(item => new Date(item.nextAt).getTime() <= now)
    if (due.length === 0) return
    for (const reminder of due) {
      await sendNotification(this.totem.config, {
        title: 'Reminder',
        message: reminder.text,
        priority: 'high',
      })
    }
    const ids = new Set(due.map(item => item.id))
    await this.store.update(current => ({
      items: current.items.map((item) => {
        if (!ids.has(item.id)) return item
        if (item.recurrence === 'once') return { ...item, done: true }
        const step = item.recurrence === 'daily' ? 86_400_000 : 604_800_000
        let next = new Date(item.nextAt).getTime() + step
        while (next <= now) next += step
        return { ...item, nextAt: new Date(next).toISOString() }
      }),
    }))
  }
}

/** Register the reminder tools. */
export function registerReminderTools(ctx: Context, reminders: ReminderService): void {
  const render = (value: unknown): { type: 'text'; text: string }[] => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }]
  ctx.tools.register(defineTool({
    name: 'remind_me',
    description: 'Create a local reminder that is delivered through the configured notification channels.',
    parameters: {
      text: { type: 'string', required: true, description: 'What to be reminded about.' },
      at: { type: 'string', required: true, description: 'ISO-8601 timestamp for the first occurrence.' },
      recurrence: { type: 'string', enum: ['once', 'daily', 'weekly'], description: 'Repeat rule (default once).' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return reminders.add(args.text, args.at, args.recurrence ?? 'once')
    },
  }))
  ctx.tools.register(defineTool({
    name: 'reminder_list',
    description: 'List pending reminders.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute() {
      return reminders.list()
    },
  }))
  ctx.tools.register(defineTool({
    name: 'reminder_cancel',
    description: 'Cancel a reminder by id.',
    parameters: {
      id: { type: 'string', required: true, description: 'Reminder id.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return { canceled: await reminders.cancel(args.id) }
    },
  }))
}
