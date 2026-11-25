/** Reminders: kind-aware nudges delivered through the notification channels. */
import { randomUUID } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { JsonStore, statePath } from './store.ts'
import { sendNotification } from './notify.ts'
import type { TotemService } from './service.ts'
import {
  DAY,
  HOUR,
  KIND_PHASES,
  MINUTE,
  dueSlots,
  nextSlot,
  parseQuiet,
  rollRepeat,
  type Priority,
  type Reminder as PlannedReminder,
  type ReminderKind,
} from './reminder-plan.ts'

/** Kept as the module's public reminder shape; the scheduler owns the fields. */
export type Reminder = PlannedReminder
export type { ReminderKind, Priority } from './reminder-plan.ts'

/** Delivery loop period. */
const TICK_MS = 30_000
/** Hard cap on notifications per reminder per local day. */
const DAILY_CAP = 6
/** Minimum spacing between two notifications for the same reminder. */
const FLOOR_MS = 10 * MINUTE
/** Ledger entries kept per reminder. */
const LEDGER = 200

/** Pre-2.0 shape still present in `reminders.json`. */
interface LegacyReminder {
  id: string
  text: string
  nextAt: string
  recurrence?: 'once' | 'daily' | 'weekly'
  createdAt: string
  done: boolean
}

function isLegacy(item: unknown): item is LegacyReminder {
  return typeof item === 'object' && item !== null && !('phases' in item) && 'nextAt' in item
}

/** Convert an old reminder to the current shape. */
export function migrateReminder(item: Reminder | LegacyReminder): Reminder {
  if (!isLegacy(item)) return item
  const repeat = item.recurrence === 'daily' ? 'daily' : item.recurrence === 'weekly' ? 'weekly' : undefined
  return {
    id: item.id,
    text: item.text,
    dueAt: item.nextAt,
    // A one-shot reminder keeps a single slot at its time; a repeating one
    // becomes a habit and re-arms from the same wall-clock time.
    kind: repeat === undefined ? 'countdown' : 'habit',
    priority: 3,
    sound: true,
    ack: 'all',
    phases: repeat === undefined
      ? [{ fromMs: 0, toMs: HOUR, everyMs: 0, priority: 3, sound: true, label: 'reminder' }]
      : KIND_PHASES.habit,
    fired: [],
    done: item.done,
    createdAt: item.createdAt,
    ...repeat === undefined ? {} : { repeat },
  }
}

/** Input for a new reminder. */
export interface ReminderInput {
  text: string
  at: string
  kind?: ReminderKind
  priority?: Priority
  sound?: boolean
  repeat?: 'daily' | 'weekly'
}

const KIND_LABEL: Record<ReminderKind, string> = {
  appointment: 'Appointment',
  task: 'Still to do',
  deadline: 'Deadline',
  habit: 'Daily habit',
  countdown: 'Reminder',
}

/** ntfy priority for a reminder slot. Silent reminders never sound. */
export function priorityName(priority: Priority, sound: boolean): 'min' | 'low' | 'default' | 'high' | 'max' {
  if (!sound) return priority >= 4 ? 'low' : 'min'
  return priority >= 5 ? 'max' : priority === 4 ? 'high' : priority === 3 ? 'default' : 'low'
}

/** "in 2 days", "in 45 minutes", "now", "3 hours ago". */
export function relativeTime(target: number, now: number): string {
  const delta = target - now
  const abs = Math.abs(delta)
  const unit = abs >= DAY ? ['day', DAY] as const
    : abs >= HOUR ? ['hour', HOUR] as const
      : ['minute', MINUTE] as const
  const count = Math.round(abs / unit[1])
  const plural = count === 1 ? '' : 's'
  if (abs < MINUTE) return 'now'
  return delta >= 0 ? `in ${count} ${unit[0]}${plural}` : `${count} ${unit[0]}${plural} ago`
}

/** Human-readable phase list, for the tool result and the confirmation. */
export function describePhases(reminder: Reminder): string[] {
  return reminder.phases.map((phase) => {
    const span = phase.toMs === Number.MAX_SAFE_INTEGER
      ? `from ${relativeMs(phase.fromMs)}`
      : `from ${relativeMs(phase.fromMs)} to ${relativeMs(phase.toMs)}`
    const every = phase.everyMs <= 0 ? 'once' : `every ${relativeMs(phase.everyMs)}`
    return `${phase.label}: ${span}, ${every}`
  })
}

function relativeMs(ms: number): string {
  if (ms === 0) return 'the time'
  const sign = ms < 0 ? '−' : '+'
  const abs = Math.abs(ms)
  if (abs >= DAY && abs % DAY === 0) return `${sign}${abs / DAY}d`
  if (abs >= HOUR && abs % HOUR === 0) return `${sign}${abs / HOUR}h`
  return `${sign}${Math.round(abs / MINUTE)}m`
}

/** Reminder store, delivery loop, and the tool surface. */
export class ReminderService {
  private readonly store = new JsonStore<{ version?: number; items: (Reminder | LegacyReminder)[] }>(
    statePath('reminders.json'),
    { version: 2, items: [] },
  )
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

  private async load(): Promise<Reminder[]> {
    const { items } = await this.store.read()
    return items.map(migrateReminder)
  }

  /** List reminders with their next slot, soonest first. */
  async list(includeDone = false): Promise<(Reminder & { next?: { at: string; label: string; priority: Priority } })[]> {
    const now = Date.now()
    return (await this.load())
      .filter(item => includeDone || (!item.done && item.canceled !== true))
      .map(item => ({ ...item, ...nextSlot(item, now) === undefined ? {} : { next: nextSlot(item, now) } }))
      .sort((a, b) => (a.next?.at ?? '9999').localeCompare(b.next?.at ?? '9999'))
  }

  /** Create one reminder from a kind. */
  async add(input: ReminderInput): Promise<Reminder> {
    const text = input.text.trim()
    if (text.length === 0) throw new Error('text is required')
    const due = new Date(input.at)
    if (Number.isNaN(due.getTime())) throw new Error(`invalid date: ${input.at}`)
    const kind = input.kind ?? (input.repeat === undefined ? 'countdown' : 'habit')
    const reminder: Reminder = {
      id: randomUUID(),
      text,
      dueAt: due.toISOString(),
      kind,
      priority: input.priority ?? 3,
      sound: input.sound ?? kind !== 'task',
      ack: kind === 'appointment' ? 'phase' : 'all',
      phases: KIND_PHASES[kind],
      fired: [],
      createdAt: new Date().toISOString(),
      done: false,
      ...input.repeat === undefined ? kind === 'habit' ? { repeat: 'daily' as const } : {} : { repeat: input.repeat },
    }
    await this.store.update(current => ({ version: 2, items: [...current.items.map(migrateReminder), reminder] }))
    return reminder
  }

  /** Cancel (delete) one reminder. */
  async cancel(id: string): Promise<boolean> {
    const reminders = await this.load()
    if (!reminders.some(item => item.id === id)) return false
    await this.store.update(current => ({
      version: 2,
      items: current.items.map(migrateReminder).filter(item => item.id !== id),
    }))
    return true
  }

  /** Mark one reminder done. */
  async done(id: string): Promise<boolean> {
    return this.patch(id, () => ({ done: true }))
  }

  /**
   * Acknowledge the current notification.
   *
   * `ack: 'phase'` (appointments) silences only the running phase, so an early
   * dismissal does not mute the warnings on the day itself. `ack: 'all'`
   * (tasks) pushes the next daily nudge to tomorrow without marking the work
   * done — the point of a task reminder is that it keeps nagging.
   */
  async ack(id: string): Promise<boolean> {
    const reminders = await this.load()
    const reminder = reminders.find(item => item.id === id)
    if (reminder === undefined || reminder.done) return false
    const now = Date.now()
    const quiet = parseQuiet(this.totem.config.quietHours.get())
    const due = new Date(reminder.dueAt).getTime()
    const current = dueSlots(reminder, now, { quiet }).fire[0]
    const nextPhase = current === undefined ? undefined : reminder.phases[current.phase + 1]
    const until = reminder.ack === 'phase' && nextPhase !== undefined
      ? due + nextPhase.fromMs
      : now + DAY
    if (nextPhase === undefined && reminder.repeat === undefined && reminder.kind !== 'task') {
      return this.done(id)
    }
    return this.patch(id, () => ({ snoozedUntil: new Date(Math.max(until, now + MINUTE)).toISOString() }))
  }

  /** Snooze one reminder by minutes. */
  async snooze(id: string, minutes: number): Promise<boolean> {
    const until = new Date(Date.now() + Math.max(1, minutes) * MINUTE).toISOString()
    return this.patch(id, () => ({ snoozedUntil: until }))
  }

  /** Deliver every due reminder. */
  async tick(): Promise<void> {
    const now = Date.now()
    const quiet = parseQuiet(this.totem.config.quietHours.get())
    const reminders = await this.load()
    if (reminders.length === 0) return
    const changed = new Map<string, Reminder>()

    for (const original of reminders) {
      const reminder = rollRepeat(original, now)
      const result = dueSlots(reminder, now, { quiet })
      if (result.seen.length > 0) {
        const day = new Date(now).toDateString()
        const today = reminder.fired.filter(item => new Date(item.at).toDateString() === day).length
        const last = reminder.fired.at(-1)
        const since = last === undefined ? Number.POSITIVE_INFINITY : now - new Date(last.at).getTime()
        if (today < DAILY_CAP && since >= FLOOR_MS) {
          for (const slot of result.fire) {
            const due = new Date(reminder.dueAt).getTime()
            await this.deliver(reminder, slot.label, new Date(due).toISOString(), now, slot.priority, slot.sound)
          }
          const fired = [
            ...reminder.fired,
            ...result.seen.map(slot => ({ phase: slot.phase, slot: slot.slot, at: new Date(now).toISOString() })),
          ].slice(-LEDGER)
          changed.set(reminder.id, { ...reminder, fired })
          continue
        }
      }
      if (reminder !== original) changed.set(reminder.id, reminder)
    }

    if (changed.size === 0) return
    await this.store.update(current => ({
      version: 2,
      items: current.items.map(item => {
        const migrated = migrateReminder(item)
        return changed.get(migrated.id) ?? migrated
      }),
    }))
  }

  private async deliver(
    reminder: Reminder,
    label: string,
    dueIso: string,
    now: number,
    priority: Priority,
    sound: boolean,
  ): Promise<void> {
    const due = new Date(dueIso).getTime()
    await sendNotification(this.totem.config, {
      title: `${KIND_LABEL[reminder.kind]} ${relativeTime(due, now)}`,
      message: `${reminder.text}\n${label} · ${new Date(due).toLocaleString()}`,
      priority: priorityName(priority, sound),
    })
  }

  private async patch(id: string, update: (item: Reminder) => Partial<Reminder>): Promise<boolean> {
    const reminders = await this.load()
    if (!reminders.some(item => item.id === id && !item.done)) return false
    await this.store.update(current => ({
      version: 2,
      items: current.items.map((item) => {
        const migrated = migrateReminder(item)
        return migrated.id === id ? { ...migrated, ...update(migrated) } : migrated
      }),
    }))
    return true
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
    description: 'Create a local reminder that escalates towards a moment and is delivered through the notification channels. Returns the computed schedule; read it back to the user.',
    parameters: {
      text: { type: 'string', required: true, description: 'What to be reminded about.' },
      at: { type: 'string', required: true, description: 'ISO-8601 timestamp of the moment itself (the appointment, the deadline).' },
      kind: {
        type: 'string',
        enum: ['appointment', 'task', 'deadline', 'habit', 'countdown'],
        description: 'appointment: daily for a week, 3x/day the day before, hourly through the day. task: daily until done, escalating. deadline: twice a day for three days, every 30 min in the last two hours. habit: one daily nudge. countdown: every 6 h for a day.',
      },
      priority: { type: 'number', description: 'Base priority 1-5 (default 3). Phases may override it.' },
      sound: { type: 'boolean', description: 'Whether notifications may sound (default true, false for tasks).' },
      repeat: { type: 'string', enum: ['daily', 'weekly'], description: 'Re-arm after the moment passes (habits).' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      const reminder = await reminders.add({
        text: args.text,
        at: args.at,
        ...args.kind === undefined ? {} : { kind: args.kind as ReminderKind },
        ...args.priority === undefined ? {} : { priority: Math.max(1, Math.min(5, Math.round(args.priority))) as Priority },
        ...args.sound === undefined ? {} : { sound: args.sound },
        ...args.repeat === undefined ? {} : { repeat: args.repeat as 'daily' | 'weekly' },
      })
      return { reminder, schedule: describePhases(reminder) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'reminder_list',
    description: 'List pending reminders with the next notification and its phase.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute() {
      return reminders.list()
    },
  }))
  ctx.tools.register(defineTool({
    name: 'reminder_cancel',
    description: 'Cancel (delete) a reminder by id.',
    parameters: { id: { type: 'string', required: true, description: 'Reminder id.' } },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return { canceled: await reminders.cancel(args.id) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'reminder_ack',
    description: 'Acknowledge the current notification: silences the running phase (appointments) or skips to tomorrow (tasks). Does not mark the work done.',
    parameters: { id: { type: 'string', required: true, description: 'Reminder id.' } },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return { acknowledged: await reminders.ack(args.id) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'reminder_snooze',
    description: 'Snooze a reminder for a number of minutes.',
    parameters: {
      id: { type: 'string', required: true, description: 'Reminder id.' },
      minutes: { type: 'number', description: 'Minutes to wait (default 10).' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args) {
      return { snoozed: await reminders.snooze(args.id, args.minutes ?? 10) }
    },
  }))
}
