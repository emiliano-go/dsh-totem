/**
 * Deterministic prose compression for context blocks.
 *
 * It never processes stored evidence or memory bodies. Lines carrying ids,
 * paths, hashes, status, evidence, or code fences are protected; only ordinary
 * sentences may be dropped. This is the safe default before considering an
 * external token classifier.
 */
import { estimateTokens } from './budget.ts'

const PROTECTED = /(\[|Evidence:|Status:|Verified:|[0-9a-f]{8,}|\/|\\|```|`[^`]+`)/i

function sentences(line: string): string[] {
  return line.split(/(?<=[.!?])\s+/u).filter(part => part.trim().length > 0)
}

/** Compress prose to a token budget while preserving protected lines. */
export function compressProse(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return ''
  if (estimateTokens(text) <= maxTokens) return text
  const lines = text.split('\n')
  const kept: string[] = []
  let used = 0
  for (const line of lines) {
    const protectedLine = PROTECTED.test(line)
    const candidates = protectedLine ? [line] : sentences(line)
    for (const candidate of candidates) {
      const cost = estimateTokens(candidate)
      if (protectedLine) {
        // Protected context (ids, paths, evidence) is never dropped, even when
        // it makes the block slightly over budget. The caller can clip later.
        kept.push(candidate)
        used += cost
        continue
      }
      if (used + cost > maxTokens) {
        continue
      }
      kept.push(candidate)
      used += cost
    }
  }
  return kept.join('\n').trimEnd()
}
