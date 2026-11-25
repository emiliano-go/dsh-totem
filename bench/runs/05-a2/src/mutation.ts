/**
 * Mutation kill-rate: do the tests actually test the change?
 *
 * A passing suite proves the tests ran, not that they would notice a defect.
 * This generates small semantic mutants of a file, runs the test command
 * against each, and reports the share the suite killed. A low rate on changed
 * code is the deterministic version of "the tests look weakened".
 *
 * The mutator is deliberately conservative: a handful of operators that change
 * behaviour without breaking syntax, applied one line at a time. It never
 * touches comments, and it caps the mutant count so a run stays bounded.
 *
 * @module dsh-totem/mutation
 */

/** One single-line semantic change. */
export interface Mutant {
  id: number
  /** Zero-based line index. */
  line: number
  original: string
  mutated: string
  description: string
}

/** One experiment outcome. */
export interface MutantResult {
  mutant: Mutant
  killed: boolean
  exitCode: number
  durationMs: number
}

/** Aggregate kill rate. */
export interface KillRate {
  total: number
  killed: number
  rate: number
}

interface Operator {
  description: string
  pattern: RegExp
  replacement: (match: string) => string
}

const OPERATORS: Operator[] = [
  { description: 'strict equality flipped', pattern: /===/gu, replacement: () => '!==' },
  { description: 'strict inequality flipped', pattern: /!==/gu, replacement: () => '===' },
  { description: 'loose equality flipped', pattern: /(?<![=!])==(?!=)/gu, replacement: () => '!=' },
  { description: 'loose inequality flipped', pattern: /!=(?!=)/gu, replacement: () => '==' },
  { description: 'logical and flipped', pattern: /&&/gu, replacement: () => '||' },
  { description: 'logical or flipped', pattern: /\|\|/gu, replacement: () => '&&' },
  { description: 'true flipped', pattern: /\btrue\b/gu, replacement: () => 'false' },
  { description: 'false flipped', pattern: /\bfalse\b/gu, replacement: () => 'true' },
]

const SKIP_LINE = /^\s*(?:\/\/|#|\*|\/\*)/u
const SKIP_EXTENSION = /\.(?:md|json|lock|map|css|html|svg|txt|ya?ml)$/iu

/** Whether a file is worth mutating at all. */
export function isMutablePath(path: string): boolean {
  return !SKIP_EXTENSION.test(path)
}

/**
 * Generate mutants for a source file.
 *
 * Each line contributes at most one mutant per operator, and the total is
 * capped; a line that yields no operator is skipped. Comments are never mutated
 * because their text does not run.
 */
export function generateMutants(source: string, options: { max?: number } = {}): Mutant[] {
  const max = Math.max(1, options.max ?? 12)
  const mutants: Mutant[] = []
  const lines = source.split('\n')
  for (let index = 0; index < lines.length && mutants.length < max; index += 1) {
    const line = lines[index]
    if (line.trim().length === 0 || SKIP_LINE.test(line)) continue
    for (const operator of OPERATORS) {
      if (mutants.length >= max) break
      if (!operator.pattern.test(line)) continue
      operator.pattern.lastIndex = 0
      const mutated = line.replace(operator.pattern, (match) => operator.replacement(match))
      if (mutated === line) continue
      mutants.push({
        id: mutants.length + 1,
        line: index,
        original: line,
        mutated,
        description: operator.description,
      })
      break
    }
  }
  return mutants
}

/** Apply one mutant to the source, leaving every other line untouched. */
export function applyMutant(source: string, mutant: Mutant): string {
  const lines = source.split('\n')
  lines[mutant.line] = mutant.mutated
  return lines.join('\n')
}

/** Kill rate over a set of experiments. */
export function killRate(results: readonly { killed: boolean }[]): KillRate {
  const total = results.length
  const killed = results.filter(result => result.killed).length
  return { total, killed, rate: total === 0 ? 0 : killed / total }
}
