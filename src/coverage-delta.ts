/**
 * Coverage delta: which added lines did the tests actually execute?
 *
 * "Tests pass" is weak evidence when the new branch was never run. This maps
 * the *added* lines of a unified diff onto a coverage report and reports the
 * ones the suite never touched. It reads reports that already exist, so it adds
 * no test-run cost and stays deterministic.
 *
 * Supported formats: Istanbul JSON (`coverage-final.json`), LCOV (`lcov.info`),
 * and Cobertura XML (`coverage.xml`).
 *
 * @module dsh-totem/coverage-delta
 */

/** Line coverage for one file, in new-file coordinates. */
export interface LineCoverage {
  covered: Set<number>
  executable: Set<number>
}

/** One parsed coverage report. */
export interface CoverageReport {
  files: Map<string, LineCoverage>
  format: 'istanbul' | 'lcov' | 'cobertura'
}

/** Added lines per file, in new-file coordinates. */
export type AddedLines = Map<string, number[]>

/** One added line the report does not mark as executed. */
export interface UncoveredLine {
  path: string
  line: number
}

/** Per-file summary of the delta. */
export interface FileDelta {
  path: string
  added: number
  executable: number
  uncovered: number
}

/** Normalise a report path against the repository root and diff conventions. */
export function normalizePath(path: string, root?: string): string {
  let normalized = path.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/')
  if (root !== undefined) {
    const base = root.replace(/\\/gu, '/').replace(/\/+$/u, '')
    if (normalized.startsWith(`${base}/`)) normalized = normalized.slice(base.length + 1)
  }
  // Coverage tools sometimes prefix the workspace; keep the longest suffix that
  // matches a repository-relative path.
  return normalized.replace(/^\/+/, '')
}

/**
 * Added line numbers per file from a unified diff.
 *
 * Hunk headers give the new-file start (`@@ -a,b +c,d @@`); context lines
 * advance the new-file counter, removed lines do not, added lines record their
 * number. `+++ /dev/null` means the file was deleted, so it contributes nothing.
 */
export function addedLineNumbers(diff: string): AddedLines {
  const result: AddedLines = new Map()
  let path = ''
  let newLine = 0
  let inHunk = false
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trim()
      path = target === '/dev/null' ? '' : target.replace(/^b\//u, '')
      inHunk = false
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line)
    if (hunk !== null) {
      newLine = Number(hunk[1])
      inHunk = true
      continue
    }
    if (!inHunk || path.length === 0) continue
    if (line.startsWith('+')) {
      const lines = result.get(path) ?? []
      lines.push(newLine)
      result.set(path, lines)
      newLine += 1
    } else if (line.startsWith(' ')) {
      newLine += 1
    }
    // A removed line does not advance the new-file counter.
  }
  return result
}

/** Merge several diffs (one per changed file) into one added-lines map. */
export function addedLineNumbersOf(changes: readonly { paths?: readonly string[]; diff?: string }[]): AddedLines {
  const merged: AddedLines = new Map()
  for (const change of changes) {
    if (change.diff === undefined || change.diff.length === 0) continue
    for (const [path, lines] of addedLineNumbers(change.diff)) {
      const known = merged.get(path) ?? []
      merged.set(path, [...known, ...lines])
    }
  }
  return merged
}

function addLine(file: LineCoverage, line: number, covered: boolean): void {
  file.executable.add(line)
  if (covered) file.covered.add(line)
}

/** Parse Istanbul `coverage-final.json`. */
export function parseIstanbul(json: unknown, root?: string): CoverageReport {
  const files = new Map<string, LineCoverage>()
  if (typeof json !== 'object' || json === null) return { files, format: 'istanbul' }
  for (const [rawPath, entry] of Object.entries(json as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as {
      statementMap?: Record<string, { start?: { line?: number }; end?: { line?: number } }>
      s?: Record<string, number>
    }
    const lineCoverage: LineCoverage = { covered: new Set(), executable: new Set() }
    for (const [key, statement] of Object.entries(record.statementMap ?? {})) {
      const start = statement.start?.line ?? 0
      const end = statement.end?.line ?? start
      if (start <= 0) continue
      const hits = record.s?.[key] ?? 0
      for (let line = start; line <= end; line += 1) addLine(lineCoverage, line, hits > 0)
    }
    if (lineCoverage.executable.size > 0) files.set(normalizePath(rawPath, root), lineCoverage)
  }
  return { files, format: 'istanbul' }
}

/** Parse an LCOV tracefile. */
export function parseLcov(text: string, root?: string): CoverageReport {
  const files = new Map<string, LineCoverage>()
  let current: { path: string; coverage: LineCoverage } | undefined
  const flush = (): void => {
    if (current !== undefined && current.coverage.executable.size > 0) {
      files.set(normalizePath(current.path, root), current.coverage)
    }
    current = undefined
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      flush()
      current = { path: line.slice(3).trim(), coverage: { covered: new Set(), executable: new Set() } }
    } else if (line.startsWith('DA:') && current !== undefined) {
      const [number, hits] = line.slice(3).split(',')
      const sourceLine = Number(number)
      if (Number.isFinite(sourceLine)) addLine(current.coverage, sourceLine, Number(hits) > 0)
    } else if (line.trim() === 'end_of_record') {
      flush()
    }
  }
  flush()
  return { files, format: 'lcov' }
}

/** Parse a Cobertura XML report without an XML dependency. */
export function parseCobertura(xml: string, root?: string): CoverageReport {
  const files = new Map<string, LineCoverage>()
  const classPattern = /<class\b[^>]*\bfilename="([^"]+)"[^>]*>([\s\S]*?)<\/class>/gu
  for (const match of xml.matchAll(classPattern)) {
    const path = match[1]
    const body = match[2]
    const coverage: LineCoverage = { covered: new Set(), executable: new Set() }
    for (const lineMatch of body.matchAll(/<line\b[^>]*\bnumber="(\d+)"[^>]*\bhits="(\d+)"/gu)) {
      addLine(coverage, Number(lineMatch[1]), Number(lineMatch[2]) > 0)
    }
    if (coverage.executable.size > 0) files.set(normalizePath(path, root), coverage)
  }
  return { files, format: 'cobertura' }
}

/** Pick a parser from the report's file name. */
export function parseCoverage(content: string, fileName: string, root?: string): CoverageReport {
  const name = fileName.toLowerCase()
  if (name.endsWith('.json')) return parseIstanbul(JSON.parse(content) as unknown, root)
  if (name.endsWith('.info') || name.endsWith('lcov')) return parseLcov(content, root)
  if (name.endsWith('.xml')) return parseCobertura(content, root)
  throw new Error(`unknown coverage format: ${fileName}`)
}

/**
 * Added executable lines the report does not mark as covered.
 *
 * Lines absent from the report are ignored: a comment or a declaration has no
 * coverage entry, and blaming it would report every added type as uncovered.
 */
export function uncoveredAddedLines(added: AddedLines, report: CoverageReport, root?: string): UncoveredLine[] {
  const uncovered: UncoveredLine[] = []
  for (const [rawPath, lines] of added) {
    const path = normalizePath(rawPath, root)
    const coverage = report.files.get(path)
    if (coverage === undefined) continue
    for (const line of lines) {
      if (!coverage.executable.has(line)) continue
      if (coverage.covered.has(line)) continue
      uncovered.push({ path, line })
    }
  }
  return uncovered.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line)
}

/** Per-file counts for the delta, for a readable report. */
export function fileDeltas(added: AddedLines, report: CoverageReport, root?: string): FileDelta[] {
  const deltas: FileDelta[] = []
  for (const [rawPath, lines] of added) {
    const path = normalizePath(rawPath, root)
    const coverage = report.files.get(path)
    const unique = [...new Set(lines)]
    const executable = coverage === undefined ? [] : unique.filter(line => coverage.executable.has(line))
    const uncovered = executable.filter(line => !coverage?.covered.has(line))
    deltas.push({ path, added: unique.length, executable: executable.length, uncovered: uncovered.length })
  }
  return deltas.sort((left, right) => left.path.localeCompare(right.path))
}

/**
 * Coverage ratio over added executable lines.
 *
 * `null` means no added line was measurable (no report entry, or only comments
 * and declarations), which must not be read as 0% coverage.
 */
export function deltaRatio(added: AddedLines, report: CoverageReport, root?: string): number | null {
  let executable = 0
  let covered = 0
  for (const [rawPath, lines] of added) {
    const coverage = report.files.get(normalizePath(rawPath, root))
    if (coverage === undefined) continue
    for (const line of new Set(lines)) {
      if (!coverage.executable.has(line)) continue
      executable += 1
      if (coverage.covered.has(line)) covered += 1
    }
  }
  return executable === 0 ? null : covered / executable
}
