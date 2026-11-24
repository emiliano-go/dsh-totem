/** Shared helpers for the pipeline tools. */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  ArtifactRef,
  Finding,
  PipelineDependencies,
  Severity,
} from './types.ts'

export const MAX_TEXT = 2_000_000
export const MAX_FINDINGS = 100

export function runId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')
  return `${stamp}-${randomUUID().slice(0, 8)}`
}

export function clip(text: string, max = 4000): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… [truncated ${text.length - max} chars]`
}

export function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function severityRank(value: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[value]
}

export function normalizeSeverity(value: unknown): Severity {
  const text = String(value ?? '').toLowerCase()
  if (text === 'critical') return 'critical'
  if (text === 'high') return 'high'
  if (text === 'medium' || text === 'moderate') return 'medium'
  if (text === 'low') return 'low'
  return 'info'
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('[')
    const end = trimmed.lastIndexOf(']')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        return undefined
      }
    }
    return undefined
  }
}

export function findingsFromModel(value: unknown, source: Finding['source']): Finding[] {
  const rows = Array.isArray(value) ? value : value !== null && typeof value === 'object' && Array.isArray((value as { findings?: unknown }).findings)
    ? (value as { findings: unknown[] }).findings
    : []
  const out: Finding[] = []
  for (const [index, row] of rows.entries()) {
    if (row === null || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const location = typeof item.location === 'string' ? item.location.trim() : ''
    if (title.length === 0 || location.length === 0) continue
    out.push({
      id: typeof item.id === 'string' && item.id.trim().length > 0 ? item.id.trim().slice(0, 40) : `MODEL-${index + 1}`,
      title: title.slice(0, 200),
      severity: normalizeSeverity(item.severity),
      location: location.slice(0, 300),
      evidence: typeof item.evidence === 'string' ? item.evidence.slice(0, 2000) : '',
      impact: typeof item.impact === 'string' ? item.impact.slice(0, 1000) : '',
      fix: typeof item.fix === 'string' ? item.fix.slice(0, 1000) : '',
      confidence: item.confidence === 'high' || item.confidence === 'low' ? item.confidence : 'medium',
      verified: false,
      source,
    })
  }
  return out
}

export function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const finding of findings) {
    const key = `${finding.location}\u0000${finding.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(finding)
  }
  return out
}

export async function writeArtifacts(
  deps: PipelineDependencies,
  id: string,
  files: Record<string, string>,
): Promise<{ dir: string; refs: ArtifactRef[] }> {
  const dir = join(deps.artifactRoot, id)
  await deps.mkdir(dir)
  const refs: ArtifactRef[] = []
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name)
    await deps.writeFile(path, content)
    refs.push({ name, path })
  }
  return { dir, refs }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;')
}

export function reportMarkdown(result: {
  kind: string
  target: string
  summary: string
  findings: Finding[]
  checks: { name: string; status: string; detail: string }[]
  artifacts: ArtifactRef[]
}): string {
  const lines = [
    `# ${result.kind} report`,
    '',
    `Target: \`${result.target}\``,
    '',
    result.summary,
    '',
    '## Findings',
    '',
  ]
  if (result.findings.length === 0) lines.push('No findings.')
  for (const finding of result.findings) {
    lines.push(
      `### ${finding.id} · ${finding.severity.toUpperCase()} · ${finding.title}`,
      '',
      `- Location: \`${finding.location}\``,
      `- Source: ${finding.source}${finding.verified ? ' · verified' : ' · unverified'}`,
      `- Impact: ${finding.impact || '—'}`,
      `- Fix: ${finding.fix || '—'}`,
      '',
      finding.evidence ? '```text\n' + finding.evidence + '\n```\n' : '',
    )
  }
  lines.push('## Checks', '')
  for (const check of result.checks) lines.push(`- ${check.status.toUpperCase()} · ${check.name} — ${check.detail}`)
  lines.push('', '## Artifacts', '')
  for (const artifact of result.artifacts) lines.push(`- ${artifact.name}: \`${artifact.path}\``)
  return `${lines.join('\n')}\n`
}
