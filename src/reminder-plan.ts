/**
 * Reminder scheduling, as pure data and pure functions.
 *
 * A reminder is *for* a moment (`dueAt`); the nudges around it are a list of
 * phases relative to that moment. This module turns a kind into phases, phases
 * into due slots, and applies the policies that make the output humane:
 * escalation, quiet hours, catch-up after downtime, and a per-day cap.
 *
 * Nothing here touches the clock, the store, or the network, which is what
 * makes the schedule testable without waiting for time to pass.
 *
 * @module dsh-totem/reminder-plan
 */
export const MINUTE = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000
/** Open-ended window for nagging phases. JSON-safe sentinel for infinity. */
export const OPEN = Number.MAX_SAFE_INTEGER

export type Priority = 1 | 2 | 3 | 4 | 5

/** The shape of a reminder, persisted as-is. */
export type ReminderKind = 'appointment' | 'task' | 'deadline' | 'habit' | 'countdown'

/** One relative window that emits slots at a fixed interval. */
export interface Phase {
  /** Window start, relative to `dueAt` (negative is before). */
  fromMs: number
  /** Window end, relative to `dueAt`; `OPEN` never ends. */
  toMs: number
  /** Interval between slots. A non-positive value means one slot at `fromMs`. */
  everyMs: number
  priority?: Priority
  sound?: boolean
  /** Escalation for open-ended nagging: priority climbs, sound joins later. */
  escalate?: { priorityPerDay?: number; soundFromDay?: number }
  label: string
}

/** One recorded notification. */
export interface Firing {
  phase: number
  /** Slot time in ISO form; the dedupe key with `phase`. */
  slot: string
  at: string
}

export interface Reminder {
  id: string
  text: string
  dueAt: string
  kind: ReminderKind
  priority: Priority
  sound: boolean
  /** What acknowledging a notification means. */
  ack: 'phase' | 'all'
  phases: Phase[]
  fired: Firing[]
  /** Daily habit: re-arm at the same wall-clock time the next day. */
  repeat?: 'daily' | 'weekly'
  snoozedUntil?: string
  createdAt: string
  done: boolean
  canceled?: boolean
}

/** One notification to send now. */
export interface DueSlot {
  phase: number
  slot: string
  priority: Priority
  sound: boolean
  label: string
}

/** Quiet-hours window in local wall-clock minutes. */
export interface QuietWindow {
  startMinute: number
  endMinute: number
}

/** Default kind schedules. All are editable per reminder. */
export const KIND_PHASES: Record<ReminderKind, Phase[]> = {
  appointment: [
    // Once a day for the week before, three times a day the day before, then
    // hourly through the last three hours and for one hour after the time
    // itself (the "yes" grace window).
    { fromMs: -7 * DAY, toMs: -DAY, everyMs: DAY, priority: 2, sound: false, label: 'one week before' },
    { fromMs: -DAY, toMs: -3 * HOUR, everyMs: 8 * HOUR, priority: 3, sound: true, label: 'the day before' },
    { fromMs: -3 * HOUR, toMs: 0, everyMs: HOUR, priority: 4, sound: true, label: 'the day of' },
    { fromMs: 0, toMs: HOUR, everyMs: HOUR, priority: 5, sound: true, label: 'on the day' },
  ],
  // "I need to do X": daily at the chosen hour, forever, getting louder.
  task: [
    {
      fromMs: 0,
      toMs: OPEN,
      everyMs: DAY,
      priority: 2,
      sound: false,
      escalate: { priorityPerDay: 1, soundFromDay: 3 },
      label: 'daily until done',
    },
  ],
  deadline: [
    { fromMs: -3 * DAY, toMs: -2 * HOUR, everyMs: 12 * HOUR, priority: 2, sound: false, label: 'three days before' },
    { fromMs: -2 * HOUR, toMs: 0, everyMs: 30 * MINUTE, priority: 4, sound: true, label: 'final two hours' },
    { fromMs: 0, toMs: HOUR, everyMs: 15 * MINUTE, priority: 5, sound: true, label: 'overdue' },
  ],
  habit: [
    { fromMs: 0, toMs: HOUR, everyMs: 0, priority: 2, sound: false, label: 'daily habit' },
  ],
  countdown: [
    { fromMs: -DAY, toMs: 0, everyMs: 6 * HOUR, priority: 3, sound: false, label: 'countdown' },
  ],
}

/** Parse `"22:00-08:00"`; an empty or malformed value disables quiet hours. */
export function parseQuiet(spec: string | undefined): QuietWindow | undefined {
  if (spec === undefined) return undefined
  const match = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/u.exec(spec)
  if (match === null) return undefined
  const [startHour, startMinute, endHour, endMinute] = match.slice(1).map(Number)
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return undefined
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  if (start === end) return undefined
  return { startMinute: start, endMinute: end }
}

/** Local wall-clock minute of a timestamp. */
export function minuteOfDay(time: number): number {
  const date = new Date(time)
  return date.getHours() * 60 + date.getMinutes()
}

/** True when `time` falls inside the window (windows may wrap midnight). */
export function inQuietHours(time: number, quiet: QuietWindow | undefined): boolean {
  if (quiet === undefined) return false
  const minute = minuteOfDay(time)
  return quiet.startMinute < quiet.endMinute
    ? minute >= quiet.startMinute && minute < quiet.endMinute
    : minute >= quiet.startMinute || minute < quiet.endMinute
}

/**
 * The first moment at or after `time` that is outside the quiet window.
 * @returns `time` unchanged outside quiet hours.
 */
export function afterQuietHours(time: number, quiet: QuietWindow | undefined): number {
  if (quiet === undefined || !inQuietHours(time, quiet)) return time
  const date = new Date(time)
  const end = new Date(time)
  end.setHours(Math.floor(quiet.endMinute / 60), quiet.endMinute % 60, 0, 0)
  if (end.getTime() <= date.getTime()) end.setDate(end.getDate() + 1)
  return end.getTime()
}

/** Priority of a slot, applying phase escalation. */
export function slotPriority(phase: Phase, base: Priority, elapsedMs: number): Priority {
  const perDay = phase.escalate?.priorityPerDay ?? 0
  const climbed = perDay === 0 ? 0 : Math.floor(Math.max(0, elapsedMs) / DAY) * perDay
  const value = (phase.priority ?? base) + climbed
  return Math.max(1, Math.min(5, value)) as Priority
}

/** Whether a slot sounds, applying escalation. */
export function slotSound(phase: Phase, base: boolean, elapsedMs: number): boolean {
  const fromDay = phase.escalate?.soundFromDay
  if (fromDay === undefined) return phase.sound ?? base
  return elapsedMs >= fromDay * DAY ? true : (phase.sound ?? base)
}

/** Every slot of one phase up to `now`, capped to keep the loop bounded. */
function phaseSlots(phase: Phase, index: number, due: number, now: number, base: Priority): DueSlot[] {
  const start = due + phase.fromMs
  // `toMs` is an exclusive window end; `now` is inclusive, so a slot exactly
  // at the current millisecond still counts.
  const end = phase.toMs === OPEN ? Number.POSITIVE_INFINITY : due + phase.toMs
  if (now < start) return []
  const slots: DueSlot[] = []
  if (phase.everyMs <= 0) {
    if (start < end) slots.push(makeSlot(phase, index, start, base, due))
    return slots
  }
  let slot = start
  let guard = 0
  while (slot <= now && slot < end && guard < 10_000) {
    slots.push(makeSlot(phase, index, slot, base, due))
    slot += phase.everyMs
    guard += 1
  }
  return slots
}

function makeSlot(phase: Phase, index: number, slot: number, base: Priority, due: number): DueSlot {
  // Escalation counts from the moment the reminder is *for*, so a task gets
  // louder the longer it stays undone, and an appointment stays quiet early.
  const elapsed = slot - due
  return {
    phase: index,
    slot: new Date(slot).toISOString(),
    priority: slotPriority(phase, base, elapsed),
    sound: slotSound(phase, base, elapsed),
    label: phase.label,
  }
}

export interface DueOptions {
  /** How late a slot may still fire. */
  graceMs?: number
  quiet?: QuietWindow
  /** Notification floor: ignore slots newer than this. */
  earliest?: number
}

export interface DueResult {
  /** Slots to deliver now, at most one per phase (the newest). */
  fire: DueSlot[]
  /** Slots that are due but held by quiet hours or the grace window. */
  held: DueSlot[]
  /** Every slot up to the newest fired one, for the dedupe ledger. */
  seen: DueSlot[]
}

/**
 * Compute what a reminder owes at `now`.
 *
 * One slot per phase is delivered — the newest — while the older ones are
 * returned in `seen` so the caller can record them and never flood a phone
 * after downtime.
 */
export function dueSlots(reminder: Reminder, now: number, options: DueOptions = {}): DueResult {
  if (reminder.done || reminder.canceled === true) return { fire: [], held: [], seen: [] }
  if (reminder.snoozedUntil !== undefined && new Date(reminder.snoozedUntil).getTime() > now) {
    return { fire: [], held: [], seen: [] }
  }
  const due = new Date(reminder.dueAt).getTime()
  if (Number.isNaN(due)) return { fire: [], held: [], seen: [] }
  const grace = options.graceMs ?? 2 * HOUR
  const fired = new Set(reminder.fired.map(item => `${item.phase}:${item.slot}`))
  const fire: DueSlot[] = []
  const held: DueSlot[] = []
  const seen: DueSlot[] = []

  for (const [index, phase] of reminder.phases.entries()) {
    const candidates: DueSlot[] = []
    for (const slot of phaseSlots(phase, index, due, now, reminder.priority)) {
      if (fired.has(`${slot.phase}:${slot.slot}`)) continue
      const at = new Date(slot.slot).getTime()
      // A silent slot parked by quiet hours fires from the window's end.
      const effective = slot.sound ? at : afterQuietHours(at, options.quiet)
      const adjusted: DueSlot = { ...slot, slot: new Date(effective).toISOString() }
      if (options.earliest !== undefined && effective < options.earliest) continue
      if (now - effective > grace) continue
      if (inQuietHours(now, options.quiet) && !slot.sound) {
        held.push(adjusted)
        continue
      }
      seen.push(adjusted)
      candidates.push(adjusted)
    }
    const newest = candidates.at(-1)
    if (newest !== undefined) fire.push(newest)
  }

  return { fire, held, seen }
}

/** The next slot that will fire, for the "next: in 3 h" line. */
export function nextSlot(reminder: Reminder, now: number): { at: string; label: string; priority: Priority } | undefined {
  if (reminder.done || reminder.canceled === true) return undefined
  const due = new Date(reminder.dueAt).getTime()
  let best: { at: number; label: string; priority: Priority } | undefined
  reminder.phases.forEach((phase) => {
    const start = due + phase.fromMs
    const end = due + phase.toMs
    let slot = start
    if (phase.everyMs > 0 && slot <= now) {
      slot = start + Math.ceil((now - start + 1) / phase.everyMs) * phase.everyMs
    }
    if (slot > end) return
    if (best === undefined || slot < best.at) {
      best = { at: slot, label: phase.label, priority: phase.priority ?? reminder.priority }
    }
  })
  return best === undefined
    ? undefined
    : { at: new Date(best.at).toISOString(), label: best.label, priority: best.priority }
}

/** Roll a repeating reminder to its next occurrence once the current one passed. */
export function rollRepeat(reminder: Reminder, now: number): Reminder {
  if (reminder.repeat === undefined || reminder.done) return reminder
  const step = reminder.repeat === 'daily' ? DAY : 7 * DAY
  let due = new Date(reminder.dueAt).getTime()
  if (Number.isNaN(due)) return reminder
  let changed = false
  // Daily habits keep their wall-clock time across DST, so the step is applied
  // to the calendar date rather than to the millisecond count.
  while (now - due > step) {
    const next = new Date(due)
    next.setDate(next.getDate() + (reminder.repeat === 'daily' ? 1 : 7))
    due = next.getTime()
    changed = true
  }
  if (!changed) return reminder
  return { ...reminder, dueAt: new Date(due).toISOString(), fired: [] }
}
