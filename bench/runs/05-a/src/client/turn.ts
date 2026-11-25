/**
 * Read a turn number from a slot owner value.
 *
 * The turn-tail slot passes `TurnTailOwnerProps.turn`, which is a
 * `TurnLocation`: it carries the start/end events, status, steps, and a
 * turn-scoped data store rather than the number itself. Treating it as a number
 * made every lookup miss silently, so this normalization is shared and tested
 * on its own.
 *
 * @module dsh-totem/client/turn
 */
export function turnNumberOf(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'object' && value !== null) {
    const candidate = (value as { turn?: unknown }).turn
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
  }
  return undefined
}

/**
 * Lifecycle status carried by the slot's `TurnLocation`.
 *
 * A closed turn can no longer produce judge calls, so its card fetches once
 * instead of polling; only an open turn is worth retrying.
 */
export function turnStatusOf(value: unknown): 'open' | 'closed' | 'unknown' {
  if (typeof value !== 'object' || value === null) return 'unknown'
  const status = (value as { status?: unknown }).status
  return status === 'open' || status === 'closed' ? status : 'unknown'
}
