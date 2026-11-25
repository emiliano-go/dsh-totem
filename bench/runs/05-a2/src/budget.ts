/**
 * Token-budgeted context blocks for memory injection.
 *
 * Every block this plugin injects into a model request costs the same context
 * window the conversation needs, so the digest and the post-compaction recovery
 * are clipped to a budget instead of growing without bound. A four-character
 * token estimate is deliberate: it is stable across providers, needs no
 * tokenizer dependency, and slightly over-counts prose, which is the safe
 * direction for a budget.
 *
 * @module dsh-totem/budget
 */

/** Characters per token used by {@link estimateTokens}. */
export const CHARS_PER_TOKEN = 4

/** Estimate the token cost of one text block. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Clip text to at most `maxTokens` estimated tokens.
 *
 * Clipping happens on a line boundary when one is available so a bullet is not
 * cut mid-sentence, and the result carries the supplied marker when anything
 * was dropped.
 */
export function clipToTokens(text: string, maxTokens: number, marker = '\n… (truncated)'): string {
  if (maxTokens <= 0) return ''
  if (estimateTokens(text) <= maxTokens) return text
  const keep = Math.max(0, maxTokens * CHARS_PER_TOKEN - marker.length)
  const head = text.slice(0, keep)
  const boundary = head.lastIndexOf('\n')
  const body = boundary > 0 ? head.slice(0, boundary) : head
  return `${body}${marker}`
}

/** One durable memory reduced to the fields an injected block needs. */
export interface BudgetItem {
  type?: unknown
  title?: unknown
  statement?: unknown
  importance?: unknown
  metadata?: unknown
}

/**
 * Render memory items as bullets, strongest first, until the budget is spent.
 *
 * Items without a title and statement are skipped rather than rendered as
 * empty bullets, and a single oversized item is not allowed to consume the
 * whole block.
 */
export function bulletBlock(items: readonly BudgetItem[], maxTokens: number, maxPerItem = 180): string[] {
  const lines: string[] = []
  let used = 0
  for (const item of items) {
    const type = typeof item.type === 'string' ? `[${item.type}] ` : ''
    const title = typeof item.title === 'string' ? item.title : ''
    const statement = typeof item.statement === 'string' ? item.statement : ''
    const text = [title, statement].filter(Boolean).join(': ')
    if (text.length === 0) continue
    const remaining = maxTokens - used
    if (remaining <= 0) break
    // A single item may not overrun the whole block: cap it to what is left so
    // the first bullet still fits a small budget.
    const limit = Math.min(maxPerItem, remaining * CHARS_PER_TOKEN)
    const line = `- ${type}${text}`.slice(0, limit)
    const cost = estimateTokens(line)
    if (used + cost > maxTokens) break
    lines.push(line)
    used += cost
  }
  return lines
}

/** Rank items by importance, newest first on ties. */
export function rankItems<T extends BudgetItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const left = Number(a.importance ?? 0)
    const right = Number(b.importance ?? 0)
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return right - left
    return 0
  })
}

/**
 * Scale a configured budget by current context pressure.
 *
 * A fixed budget assumes the conversation has room. Under pressure the same
 * block competes with the work it is meant to support, so the block shrinks
 * first: half at 70% context use, nothing at 90%. Unknown pressure keeps the
 * configured budget, because a missing measurement is not evidence of room.
 */
export function budgetFor(pressure: number | undefined, configured: number): number {
  if (configured <= 0) return 0
  if (pressure === undefined || !Number.isFinite(pressure) || pressure < 0) return configured
  if (pressure >= 0.9) return 0
  if (pressure >= 0.7) return Math.round(configured / 2)
  return configured
}
