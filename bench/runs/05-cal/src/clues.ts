/**
 * Query clues for multi-hop recall.
 *
 * MemoRAG-style clue generation: ask a cheap model for a few surrogate
 * questions, search each one, and hand the union back as seed ids to the
 * context compiler. The original query still dominates; clues only widen
 * recall. Disabled by default.
 */
import type { Context } from '@deepseek-ai/cordis'
import { runOneShot, type DistillTarget } from './distill.ts'
import type { TotemService } from './service.ts'

const SYSTEM = `You expand one engineering recall query into a few precise clue queries.
Return 2-4 short lines, each a question or phrase that would find a different
part of the answer. Do not answer the question. Do not use markdown.
Return an empty string when the query is already a direct symbol or file lookup.`

/** Generate 2-4 clue queries; an empty array means "use the original only". */
export async function generateClues(
  ctx: Context,
  target: DistillTarget,
  task: string,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<string[]> {
  if (task.trim().length < 12) return []
  const text = await runOneShot(ctx, target, SYSTEM, task.slice(0, 4000), signal, sessionId)
  if (text === undefined) return []
  return text
    .split('\n')
    .map(line => line.replace(/^[-*\d.\s]+/u, '').trim())
    .filter(line => line.length >= 4 && line.length <= 300)
    .slice(0, 4)
}

/** Search each clue and return the union of matching memory ids. */
export async function clueSeeds(
  totem: TotemService,
  project: string,
  clues: readonly string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const ids = new Set<string>()
  for (const clue of clues.slice(0, 4)) {
    try {
      const result = await totem.call('memory_search_tool', {
        query: clue,
        limit: 5,
        project,
      }, signal) as unknown
      if (!Array.isArray(result)) continue
      for (const entry of result) {
        if (typeof entry !== 'object' || entry === null) continue
        const id = (entry as { id?: unknown }).id
        if (typeof id === 'string') ids.add(id)
      }
    } catch {
      // One bad clue must not discard the others.
    }
  }
  return [...ids]
}
