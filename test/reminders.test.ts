import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ReminderService,
  describePhases,
  migrateReminder,
  priorityName,
  relativeTime,
  type Reminder,
} from '../src/reminders.ts'

function ref<T>(value: T): { get: () => T } {
  return { get: () => value }
}

/** A fresh state directory per test, so reminders never leak between cases. */
function service(quiet = '22:00-08:00', dir?: string): ReminderService {
  process.env.DSH_HOME = dir ?? mkdtempSync(join(tmpdir(), 'dsh-totem-rem-'))
  const config = {
    quietHours: ref(quiet),
    ntfyTopic: ref(''),
    ntfyUrl: ref(''),
    ntfyToken: ref(''),
    telegramBotToken: ref(''),
    telegramChatId: ref(''),
  }
  return new ReminderService({} as never, { config } as never)
}

const inHours = (hours: number): string => new Date(Date.now() + hours * 3_600_000).toISOString()

test('an appointment gets the escalating schedule and phase-level ack', async () => {
  const reminder = await service().add({
    text: 'Dentist',
    at: inHours(200),
    kind: 'appointment',
  })
  expect(reminder.kind).toBe('appointment')
  expect(reminder.ack).toBe('phase')
  expect(reminder.phases.map(phase => phase.label))
    .toEqual(['one week before', 'the day before', 'the day of', 'on the day'])
  expect(describePhases(reminder)[0]).toContain('one week before')
})

test('a task is silent by nagging default and acknowledges everything', async () => {
  const reminder = await service().add({ text: 'File taxes', at: inHours(48), kind: 'task' })
  expect(reminder.sound).toBe(false)
  expect(reminder.ack).toBe('all')
  expect(reminder.phases).toHaveLength(1)
  expect(reminder.phases[0].toMs).toBe(Number.MAX_SAFE_INTEGER)
})

test('list reports the next notification and its phase', async () => {
  const reminders = service()
  await reminders.add({ text: 'Standup', at: inHours(30), kind: 'appointment' })
  const items = await reminders.list()
  expect(items).toHaveLength(1)
  expect(items[0].next?.label).toBe('one week before')
  expect(Date.parse(items[0].next!.at)).toBeLessThan(Date.parse(items[0].dueAt))
})

test('old reminders on disk are migrated, not dropped', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-totem-rem-legacy-'))
  process.env.DSH_HOME = home
  const dir = join(home, 'totem')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'reminders.json'), JSON.stringify({
    items: [
      { id: 'a', text: 'once', nextAt: new Date().toISOString(), recurrence: 'once', createdAt: new Date().toISOString(), done: false },
      { id: 'b', text: 'daily', nextAt: new Date().toISOString(), recurrence: 'daily', createdAt: new Date().toISOString(), done: false },
    ],
  }))
  const items = await service('22:00-08:00', home).list()
  const once = items.find(item => item.id === 'a') as Reminder
  const daily = items.find(item => item.id === 'b') as Reminder
  expect(once.kind).toBe('countdown')
  expect(once.repeat).toBeUndefined()
  expect(daily.kind).toBe('habit')
  expect(daily.repeat).toBe('daily')
})

test('ack on an appointment silences the phase, not the day', async () => {
  const reminders = service()
  const reminder = await reminders.add({ text: 'Dentist', at: inHours(2), kind: 'appointment' })
  expect(await reminders.ack(reminder.id)).toBe(true)
  const [stored] = await reminders.list()
  // The next phase starts at the appointment itself.
  expect(stored.snoozedUntil).toBe(reminder.dueAt)
})

test('a due habit fires once and the ledger prevents a replay', async () => {
  // No quiet window: the test runner may use a different TZ than the shell, and
  // a silent habit inside quiet hours is deliberately held rather than fired.
  const reminders = service('')
  const reminder = await reminders.add({
    text: 'Drink water',
    at: new Date(Date.now() - 5 * 60_000).toISOString(),
    kind: 'habit',
  })
  await reminders.tick()
  const [afterFirst] = await reminders.list()
  expect(afterFirst.fired.length).toBe(1)
  await reminders.tick()
  const [afterSecond] = await reminders.list()
  expect(afterSecond.fired.length).toBe(1)
  expect(afterSecond.id).toBe(reminder.id)
})

test('done and cancel remove the reminder from the active list', async () => {
  const reminders = service()
  const one = await reminders.add({ text: 'a', at: inHours(1) })
  const two = await reminders.add({ text: 'b', at: inHours(2) })
  expect(await reminders.done(one.id)).toBe(true)
  expect(await reminders.cancel(two.id)).toBe(true)
  expect(await reminders.list()).toHaveLength(0)
})

test('silent reminders never map to a sounding priority', () => {
  expect(priorityName(5, true)).toBe('max')
  expect(priorityName(4, true)).toBe('high')
  expect(priorityName(3, true)).toBe('default')
  expect(priorityName(2, true)).toBe('low')
  expect(priorityName(5, false)).toBe('low')
  expect(priorityName(2, false)).toBe('min')
})

test('relative time reads like a person would say it', () => {
  const now = Date.now()
  expect(relativeTime(now + 2 * 86_400_000, now)).toBe('in 2 days')
  expect(relativeTime(now + 3 * 3_600_000, now)).toBe('in 3 hours')
  expect(relativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago')
  expect(relativeTime(now + 10_000, now)).toBe('now')
})

test('a legacy record migrates in isolation', () => {
  const migrated = migrateReminder({
    id: 'x',
    text: 'old',
    nextAt: new Date().toISOString(),
    recurrence: 'weekly',
    createdAt: new Date().toISOString(),
    done: false,
  })
  expect(migrated.repeat).toBe('weekly')
  expect(migrated.kind).toBe('habit')
  expect(migrated.phases).toHaveLength(1)
})
