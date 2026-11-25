/** Shared types for the task-specific pipeline tools. */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Finding {
  id: string
  title: string
  severity: Severity
  location: string
  evidence: string
  impact: string
  fix: string
  confidence: 'high' | 'medium' | 'low'
  verified: boolean
  source: 'deterministic' | 'scanner' | 'review' | 'check'
}

export interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'skipped' | 'unavailable'
  detail: string
}

export interface ArtifactRef {
  name: string
  path: string
}

export interface PipelineResult {
  run_id: string
  kind: 'sec_audit' | 'site_audit'
  target: string
  status: 'completed' | 'failed'
  summary: string
  findings: Finding[]
  checks: CheckResult[]
  artifacts: ArtifactRef[]
  pages?: PageAudit[]
  duration_ms: number
  error?: string
}

export interface PageAudit {
  url: string
  status: number
  title: string
  description: string
  canonical: string
  lang: string
  h1: number
  images: number
  missing_alt: number
  links: number
  external_links: number
  structured_data: number
  viewport: boolean
  robots: string
  screenshot?: string
  words: number
  score: number
}

export interface CommandResult {
  code: number
  stdout: string
  stderr: string
}

export interface CommandRunner {
  (command: string, args: readonly string[], options?: { timeoutMs?: number; maxBuffer?: number }): Promise<CommandResult>
}

export interface LlmTarget {
  provider: string
  model: string
  maxTokens: number
  timeoutMs: number
}

export interface LlmSummarizer {
  (input: string, signal?: AbortSignal): Promise<string | undefined>
}

export interface PipelineDependencies {
  cwd: string
  run: CommandRunner
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, data: string) => Promise<void>
  mkdir: (path: string) => Promise<void>
  artifactRoot: string
  summarize?: LlmSummarizer
  review?: (input: string, signal?: AbortSignal) => Promise<string | undefined>
  screenshots?: boolean
  allowPrivate?: boolean
  now?: () => Date
}

export interface SecAuditOptions {
  target?: string
  base?: string
  head?: string
  maxFindings?: number
  review?: boolean
}

export interface SiteAuditOptions {
  urls: string[]
  screenshots?: boolean
  review?: boolean
  maxFindings?: number
}
