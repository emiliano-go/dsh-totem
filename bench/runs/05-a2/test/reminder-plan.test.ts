import { describe, expect, test } from 'bun:test'

import {
  DAY,
  HOUR,
  KIND_PHASES,
  MINUTE,
  afterQuietHours,
  dueSlots,
  inQuietHours,
  nextSlot,
  parseQuiet,
  rollRepeat,
  type Reminder,
} from '../src/reminder-plan.ts'

/** A reminder due at a local wall-clock time, so the tests never depend on UTC offsets. */
function at(year: number, month: number, day: number, hour = 15, minute = 30): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    text: 'Dentist',
    dueAt: new Date(at(2026, 11, 24)).toISOString(),
    kind: 'appointment',
    priority: 3,
    sound: true,
    ack: 'phase',
    phases: KIND_PHASES.appointment,
    fired: [],
    createdAt: new Date(at(2026, 11, 10)).toISOString(),
    done: false,
    ...overrides,
  }
}

describe('quiet hours', () => {
  test('parses a wrapping window and rejects nonsense', () => {
    expect(parseQuiet('22:00-08:00')).toEqual({ startMinute: 1320, endMinute: 480 })
    expect(parseQuiet(' 9:05 - 17:30 ')).toEqual({ startMinute: 545, endMinute: 1050 })
    expect(parseQuiet('')).toBeUndefined()
    expect(parseQuiet('22:00')).toBeUndefined()
    expect(parseQuiet('25:00-08:00')).toBeUndefined()
    expect(parseQuiet('22:00-22:00')).toBeUndefined()
  })

  test('detects the window across midnight', () => {
    const quiet = parseQuiet('22:00-08:00')
    expect(inQuietHours(at(2026, 11, 24, 23, 0), quiet)).toBe(true)
    expect(inQuietHours(at(2026, 11, 24, 2, 0), quiet)).toBe(true)
    expect(inQuietHours(at(2026, 11, 24, 7, 59), quiet)).toBe(true)
    expect(inQuietHours(at(2026, 11, 24, 8, 0), quiet)).toBe(false)
    expect(inQuietHours(at(2026, 11, 24, 21, 59), quiet)).toBe(false)
  })

  test('a slot parked by quiet hours resumes at the window end', () => {
    const quiet = parseQuiet('22:00-08:00')
    const late = at(2026, 11, 24, 23, 10)
    expect(afterQuietHours(late, quiet)).toBe(at(2026, 11, 25, 8, 0))
    const morning = at(2026, 11, 24, 9, 0)
    expect(afterQuietHours(morning, quiet)).toBe(morning)
  })
})

describe('appointment escalation', () => {
  test('one nudge a day during the week before', () => {
    const item = reminder()
    const due = new Date(item.dueAt).getTime()
    const result = dueSlots(item, due - 5 * DAY, { quiet: undefined })
    expect(result.fire).toHaveLength(1)
    expect(result.fire[0].label).toBe('one week before')
    expect(result.fire[0].priority).toBe(2)
    expect(result.fire[0].sound).toBe(false)
    // Only slots inside the grace window are candidates: older ones can never
    // fire again, so they are not replayed after a restart.
    expect(result.seen.length).toBe(1)
  })

  test('three a day the day before, then hourly through the day', () => {
    const item = reminder()
    const due = new Date(item.dueAt).getTime()
    const dayBefore = dueSlots(item, due - 16 * HOUR)
    expect(dayBefore.fire[0].label).toBe('the day before')
    expect(dayBefore.fire[0].priority).toBe(3)

    const threeHours = dueSlots(item, due - 2 * HOUR)
    expect(threeHours.fire.map(slot => slot.label)).toContain('the day of')
    expect(threeHours.fire[0].priority).toBe(4)
    expect(threeHours.fire[0].sound).toBe(true)
  })

  test('the window ends one hour after the appointment', () => {
    const item = reminder()
    const due = new Date(item.dueAt).getTime()
    // At due + 2 h nothing inside the day window is still fresh enough to fire.
    const late = dueSlots(item, due + 3 * HOUR)
    expect(late.fire).toHaveLength(0)
  })
})

describe('task nagging', () => {
  const task = () => reminder({
    kind: 'task',
    priority: 2,
    sound: false,
    phases: KIND_PHASES.task,
    dueAt: new Date(at(2026, 11, 24, 9, 0)).toISOString(),
  })

  test('escalates priority and turns on sound after three days', () => {
    const item = task()
    const due = new Date(item.dueAt).getTime()
    const day2 = dueSlots(item, due + 2 * DAY)
    expect(day2.fire[0].priority).toBe(4)
    expect(day2.fire[0].sound).toBe(false)
    const day4 = dueSlots(item, due + 4 * DAY)
    expect(day4.fire[0].priority).toBe(5)
    expect(day4.fire[0].sound).toBe(true)
  })

  test('never stops: a month later it still fires', () => {
    const item = task()
    const due = new Date(item.dueAt).getTime()
    const late = dueSlots(item, due + 60 * DAY)
    expect(late.fire).toHaveLength(1)
    expect(late.fire[0].priority).toBe(5)
  })

  test('downtime collapses into one notification, not a flood', () => {
    const item = task()
    const due = new Date(item.dueAt).getTime()
    const after = dueSlots(item, due + 5 * DAY + 5 * MINUTE)
    // Days 0..4 aged past the grace window; only the newest slot is owed.
    expect(after.fire).toHaveLength(1)
    expect(after.seen).toHaveLength(1)
  })
})

describe('dedupe and acknowledgement', () => {
  test('a fired slot never fires twice', () => {
    const item = reminder()
    const due = new Date(item.dueAt).getTime()
    const now = due - 5 * DAY
    const first = dueSlots(item, now)
    expect(first.fire).toHaveLength(1)
    const seen = { ...item, fired: first.seen.map(slot => ({ phase: slot.phase, slot: slot.slot, at: new Date(now).toISOString() })) }
    expect(dueSlots(seen, now).fire).toHaveLength(0)
  })

  test('a done or canceled reminder owes nothing', () => {
    const due = new Date(reminder().dueAt).getTime()
    expect(dueSlots(reminder({ done: true }), due).fire).toHaveLength(0)
    expect(dueSlots(reminder({ canceled: true }), due).fire).toHaveLength(0)
  })

  test('snoozing suppresses until the snooze expires', () => {
    const due = new Date(reminder().dueAt).getTime()
    const snoozed = reminder({ snoozedUntil: new Date(due + HOUR).toISOString() })
    expect(dueSlots(snoozed, due).fire).toHaveLength(0)
    expect(dueSlots(snoozed, due + HOUR + MINUTE).fire.length).toBeGreaterThan(0)
  })
})

describe('quiet hours hold silent slots but not loud ones', () => {
  const quiet = parseQuiet('22:00-08:00')

  test('a silent slot at 23:00 waits for 08:00', () => {
    const item = reminder({
      kind: 'habit',
      phases: KIND_PHASES.habit,
      dueAt: new Date(at(2026, 11, 24, 23, 0)).toISOString(),
      sound: false,
      priority: 2,
    })
    const due = new Date(item.dueAt).getTime()
    const held = dueSlots(item, due + 5 * MINUTE, { quiet })
    expect(held.fire).toHaveLength(0)
    expect(held.held).toHaveLength(1)
    const morning = dueSlots(item, at(2026, 11, 25, 8, 5), { quiet })
    expect(morning.fire).toHaveLength(1)
  })

  test('a loud slot ignores quiet hours', () => {
    const item = reminder({
      kind: 'countdown',
      phases: [{ fromMs: 0, toMs: HOUR, everyMs: 0, priority: 5, sound: true, label: 'now' }],
      dueAt: new Date(at(2026, 11, 24, 23, 0)).toISOString(),
    })
    const due = new Date(item.dueAt).getTime()
    expect(dueSlots(item, due + MINUTE, { quiet }).fire).toHaveLength(1)
  })
})

describe('next slot and repeats', () => {
  test('nextSlot reports the upcoming window', () => {
    const item = reminder()
    const due = new Date(item.dueAt).getTime()
    const next = nextSlot(item, due - 4 * DAY + HOUR)
    expect(next?.label).toBe('one week before')
    expect(new Date(next!.at).getTime()).toBe(due - 3 * DAY)
  })

  test('a daily habit rolls to the same wall-clock time and clears the ledger', () => {
    const item = reminder({
      kind: 'habit',
      repeat: 'daily',
      phases: KIND_PHASES.habit,
      dueAt: new Date(at(2026, 11, 24, 9, 0)).toISOString(),
      fired: [{ phase: 0, slot: new Date(at(2026, 11, 24, 9, 0)).toISOString(), at: new Date(at(2026, 11, 24, 9, 0)).toISOString() }],
    })
    const rolled = rollRepeat(item, at(2026, 11, 26, 9, 5))
    expect(new Date(rolled.dueAt).getHours()).toBe(9)
    expect(rolled.fired).toHaveLength(0)
    expect(new Date(rolled.dueAt).getDate()).toBe(26)
  })

  test('a non-repeating reminder is left alone', () => {
    const item = reminder()
    expect(rollRepeat(item, at(2027, 1, 1))).toBe(item)
  })
})
