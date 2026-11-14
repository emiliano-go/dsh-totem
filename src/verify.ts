// Deterministic verify lane: high-precision rules over the turn's tool calls
// and outputs. Any high-severity finding vetoes the turn regardless of the
// decision engine's verdict. External scanners are added in a later step.
export interface VerifyChange {
  readonly tool: string
  readonly input: string
  readonly output: string
  readonly diff?: string
  readonly paths?: readonly string[]
}

export interface VerifyFinding {
  readonly rule: string
  readonly severity: "high" | "medium"
  readonly detail: string
  readonly tool: string
  readonly path?: string
}

export interface VerifyResult {
  readonly findings: VerifyFinding[]
  readonly veto: boolean
}

export interface VerifyOptions {
  readonly disable?: readonly string[]
}

const MAX_FINDINGS = 20

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-(?:live|test|prod)-[A-Za-z0-9_-]{8,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /["']?(?:api[_-]?key|secret|token|password)["']?\s*[:=]\s*["'][A-Za-z0-9_+/=-]{16,}["']/i,
]

const INJECTION_PATTERNS: RegExp[] = [
  /["'](?:SELECT|INSERT|UPDATE|DELETE)\b[^"']*["']\s*["']?\s*\+\s*(?:email|user|name|input|id|query|req|val)/i,
  /f["'][^"']*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^"']*\{/i,
  /["'][^"']*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^"']*["']\s*%\s*\(/i,
  /\bos\.system\(\s*f?["']/,
  /subprocess\.(?:run|Popen|call)\([^)]*shell\s*=\s*True/,
  /child_process\.(?:exec|execSync)\(/,
  /\beval\(\s*(?:request|req|input|params|args)/i,
  /\b(?:pickle|marshal|dill)\.loads?\s*\(/,
  /\byaml\.load\s*\((?![^)]*SafeLoader)/,
  /\bnew\s+Function\s*\(/,
]

const DESTRUCTIVE_PATTERNS: { severity: "high" | "medium"; re: RegExp; label: string }[] = [
  { severity: "high", re: /(?:^|[\s;&|])rm\s+-[a-z]*r[a-z]*f[a-z]*\s+\/(?:\s|$|\*)/, label: "rm -rf /" },
  { severity: "high", re: /(?:^|[\s;&|])rm\s+-[a-z]*f[a-z]*r[a-z]*\s+\/(?:\s|$|\*)/, label: "rm -fr /" },
  { severity: "high", re: /curl[^|;\n]*\|\s*(?:ba|z|da)?sh\b/, label: "curl | sh" },
  { severity: "high", re: /wget[^|;\n]*\|\s*(?:ba|z)?sh\b/, label: "wget | sh" },
  { severity: "high", re: /\bchmod\s+(?:-R\s+)?777\b/, label: "chmod 777" },
  { severity: "high", re: /git\s+push[^\n]*--force[^\n]*\b(?:main|master)\b/, label: "force push to main" },
  { severity: "medium", re: /\bDROP\s+TABLE\b/i, label: "DROP TABLE" },
]

const TEST_MARKERS = /ran \d+ tests?|test session starts|test suites?:|\d+ passing|\d+ failing|\d+ passed/i
const TEST_FAILURES = /\bFAILED\b|\bfailures?=[1-9]\b|\b[1-9]\d* failed\b|\b[1-9]\d* failing\b/
const TYPE_ERRORS = /\berror TS\d+/
const LSP_ERRORS = /LSP errors detected in/
const LINT_MARKERS = /\d+ problems? \((\d+) errors?/

// Assignment where a comparison was almost certainly intended, e.g.
// `if (b = 0)`. Restricted to constant/identifier right-hand sides so
// intentional `if ((x = f()) != null)` does not trip the high-severity veto.
const ASSIGNMENT_IN_CONDITION: RegExp[] = [
  /\b(?:if|while)\s*\(\s*[A-Za-z_$][\w$.]*\s*=\s*(?:0|1|true|false|null|undefined|["'][^"']{0,40}["'])\s*\)/,
]

// Empty catch/except blocks hide failures the caller needs to see.
const SILENT_SWALLOW: RegExp[] = [
  /\bcatch\s*\([^)]*\)\s*\{\s*\}/,
  /\bexcept[^:\n]*:\s*pass\b/,
  /\bexcept\s*:\s*pass\b/,
]

// Agents that cannot pass a test sometimes weaken it instead.
const TEST_SKIP = /\b(?:pytest\.mark\.skip|pytest\.skip\(|unittest\.skip|\.skip\(|\.only\(|xit\()/
const IS_TEST_PATH =
  /(?:^|\/)(?:tests?|__tests__|spec)\//i
const TEST_FILE = /(?:^|\/)(?:test_[^/]+|[^/]+_test\.[A-Za-z]+|[^/]+\.(?:test|spec)\.[A-Za-z]+)$/i

function testWeakening(change: VerifyChange): VerifyFinding[] {
  const path = change.paths?.[0] ?? change.input.match(/(?:filePath|path)=([^\s]+)/)?.[1] ?? ""
  if (!change.diff || !(IS_TEST_PATH.test(path) || TEST_FILE.test(path))) return []
  const lines = change.diff.split("\n")
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1))
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).map((line) => line.slice(1))
  const base = { rule: "test-weakened", tool: change.tool, ...(path ? { path } : {}) }
  if (added.some((line) => TEST_SKIP.test(line))) return [{ ...base, severity: "high", detail: "test-weakened: test skipped" }]
  const removedAssert = removed.some((line) => /\bassert\b|\bexpect\s*\(/.test(line))
  if (removedAssert && added.some((line) => /^\s*pass\s*$/.test(line))) {
    return [{ ...base, severity: "high", detail: "test-weakened: assertion replaced with pass" }]
  }
  if (removedAssert && added.length === 0) return [{ ...base, severity: "high", detail: "test-weakened: assertions removed" }]
  return []
}

function firstLine(text: string, pattern: RegExp): string {
  return text
    .split("\n")
    .find((line) => pattern.test(line))
    ?.trim()
    .slice(0, 160) ?? ""
}

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9_+/=-]{12,}/g, (match) => `${match.slice(0, 4)}…`)
}

function scan(
  change: VerifyChange,
  patterns: readonly RegExp[],
  rule: string,
  severity: "high" | "medium",
  label = rule,
): VerifyFinding[] {
  // Scan tool args and only the lines the change ADDS. Removed lines are
  // excluded so deleting a secret is not reported as introducing one, and the
  // diff marker is stripped so regexes see normal code.
  const added = (change.diff ?? "")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n")
  const text = `${change.input}\n${added}\n${change.output}`
  return patterns.flatMap((pattern) => {
    const match = text.match(pattern)
    if (!match) return []
    return [
      {
        rule,
        severity,
        detail: `${label}: ${redact(match[0]).slice(0, 140)}`,
        tool: change.tool,
        ...(change.paths?.[0] ? { path: change.paths[0] } : {}),
      },
    ]
  })
}

// Families whose last observed result wins: an early failure that was fixed by
// a later passing run must not veto the turn.
function executionSignals(output: string): { family: string; failed: boolean; detail: string }[] {
  const signals: { family: string; failed: boolean; detail: string }[] = []
  if (TEST_MARKERS.test(output)) {
    signals.push({
      family: "tests",
      failed: TEST_FAILURES.test(output),
      detail: firstLine(output, TEST_FAILURES) || firstLine(output, TEST_MARKERS),
    })
  }
  if (TYPE_ERRORS.test(output)) {
    signals.push({ family: "typecheck", failed: true, detail: firstLine(output, TYPE_ERRORS) })
  }
  if (LSP_ERRORS.test(output)) {
    signals.push({ family: "lsp", failed: true, detail: firstLine(output, LSP_ERRORS) })
  }
  const lint = output.match(LINT_MARKERS)
  if (lint) {
    signals.push({
      family: "lint",
      failed: Number(lint[1]) > 0,
      detail: firstLine(output, LINT_MARKERS),
    })
  }
  return signals
}

export interface ExecutionEvidence {
  readonly kind: string
  readonly status: "pass" | "fail"
  readonly summary: string
  readonly tool?: string
  readonly path?: string
}

/**
 * Last observed execution result per kind (tests/typecheck/lint/lsp), pass or
 * fail. Shared by the verify gate and the decision-engine state.
 */
export function executionEvidence(changes: readonly VerifyChange[]): ExecutionEvidence[] {
  const last = new Map<string, ExecutionEvidence>()
  for (const change of changes) {
    for (const signal of executionSignals(change.output)) {
      last.set(signal.family, {
        kind: signal.family,
        status: signal.failed ? "fail" : "pass",
        summary: signal.detail.slice(0, 300),
        tool: change.tool,
        ...(change.paths?.[0] ? { path: change.paths[0] } : {}),
      })
    }
  }
  return [...last.values()]
}

export function verifyChanges(changes: readonly VerifyChange[], options: VerifyOptions = {}): VerifyResult {
  const disabled = new Set(options.disable ?? [])
  const findings: VerifyFinding[] = []

  for (const change of changes) {
    if (!disabled.has("secret-hardcoded")) findings.push(...scan(change, SECRET_PATTERNS, "secret-hardcoded", "high"))
    if (!disabled.has("sql-or-code-injection")) {
      findings.push(...scan(change, INJECTION_PATTERNS, "sql-or-code-injection", "high"))
    }
    if (!disabled.has("destructive-command")) {
      for (const entry of DESTRUCTIVE_PATTERNS) {
        findings.push(...scan(change, [entry.re], "destructive-command", entry.severity, entry.label))
      }
    }
    if (!disabled.has("assignment-in-condition")) {
      findings.push(...scan(change, ASSIGNMENT_IN_CONDITION, "assignment-in-condition", "high"))
    }
    if (!disabled.has("silent-swallow")) {
      findings.push(...scan(change, SILENT_SWALLOW, "silent-swallow", "high"))
    }
    if (!disabled.has("test-weakened")) {
      findings.push(...testWeakening(change))
    }
  }

  for (const evidence of executionEvidence(changes)) {
    if (evidence.status !== "fail") continue
    const rule = `execution-${evidence.kind}`
    if (disabled.has(rule)) continue
    findings.push({
      rule,
      severity: "high",
      detail: `${rule}: ${evidence.summary || evidence.kind}`,
      tool: evidence.tool ?? "bash",
      ...(evidence.path ? { path: evidence.path } : {}),
    })
  }

  const capped = findings.slice(0, MAX_FINDINGS)
  return { findings: capped, veto: capped.some((finding) => finding.severity === "high") }
}

// Text advice has no patch to scan, so unsafe guidance needs its own lane.
// High precision only: several of these are security-relevant and veto.
const UNSAFE_ADVICE: { severity: "high" | "medium"; re: RegExp; label: string }[] = [
  { severity: "high", re: /client[- ]supplied\s+(?:file\s*)?name[^.]{0,90}(?:directly|web root)/i, label: "trusting client-supplied filename" },
  { severity: "high", re: /(?:no|don'?t|does not|doesn'?t)\s+need\s+to\s+(?:validate|sanitize|check|verify)/i, label: "skipping validation" },
  { severity: "high", re: /\b(?:disable|turn off|skip)\s+(?:tls|ssl|certificate)\s+(?:verification|validation)/i, label: "disabling TLS verification" },
  { severity: "high", re: /\bverify\s*=\s*False\b/, label: "verify=False" },
  { severity: "high", re: /\b(?:disable|skip|bypass|turn off)\s+(?:auth|authentication|authorization|access control|csrf)\b/i, label: "disabling auth" },
  { severity: "high", re: /\bchmod\s+(?:-R\s+)?777\b/, label: "chmod 777" },
  { severity: "high", re: /\beval\(\s*(?:user|input|request|req|params)/i, label: "eval of user input" },
  { severity: "medium", re: /\b(?:store|save|keep)\s+(?:the\s+)?password\s+in\s+plain\s*text/i, label: "plaintext password" },
]

export function verifyAnswer(answer: string, options: VerifyOptions = {}): VerifyResult {
  const disabled = new Set(options.disable ?? [])
  if (disabled.has("unsafe-advice") || !answer) return { findings: [], veto: false }
  const findings: VerifyFinding[] = UNSAFE_ADVICE.filter((entry) => entry.re.test(answer)).map((entry) => ({
    rule: "unsafe-advice",
    severity: entry.severity,
    detail: `unsafe-advice: ${entry.label}`,
    tool: "answer",
  }))
  const capped = findings.slice(0, MAX_FINDINGS)
  return { findings: capped, veto: capped.some((finding) => finding.severity === "high") }
}

// --- External adapters -----------------------------------------------------------
// Optional scanners run on the turn's changed files when installed. Failures,
// timeouts, and unparseable output are silently skipped: the built-in lane is
// the guarantee, adapters only add precision.

export interface ExternalRunInput {
  readonly tool: string
  readonly args: readonly string[]
  readonly cwd?: string
}

export interface ExternalRunResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export type ExternalRunner = (input: ExternalRunInput) => Promise<ExternalRunResult>

export interface ExternalVerifyOptions {
  readonly cwd?: string
  readonly external?: "auto" | "on" | "off"
  readonly disable?: readonly string[]
  readonly runner?: ExternalRunner
  readonly available?: (binary: string) => boolean
}

const EXTERNAL_TIMEOUT_MS = 10_000
const MAX_EXTERNAL_FILES = 20

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function externalFindings(id: string, file: string, parsed: unknown): VerifyFinding[] {
  const push = (severity: "high" | "medium", detail: string): VerifyFinding[] => [
    { rule: `external-${id}`, severity, detail: `${id}: ${detail}`.slice(0, 200), tool: id, path: file },
  ]
  if (id === "gitleaks") {
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) =>
      isRecord(entry)
        ? push("high", `${String(entry["Description"] ?? entry["RuleID"] ?? "secret")} in ${file}:${String(entry["StartLine"] ?? "?")}`)
        : [],
    )
  }
  if (id === "semgrep") {
    const results = isRecord(parsed) ? parsed["results"] : undefined
    if (!Array.isArray(results)) return []
    return results.flatMap((entry) => {
      if (!isRecord(entry)) return []
      const extra = isRecord(entry["extra"]) ? entry["extra"] : {}
      const severity = String(extra["severity"] ?? "WARNING").toUpperCase() === "ERROR" ? "high" : "medium"
      const line = isRecord(entry["start"]) ? entry["start"]["line"] : "?"
      return push(severity, `${String(entry["check_id"] ?? "rule")} at ${file}:${String(line)}`)
    })
  }
  if (id === "bandit") {
    const results = isRecord(parsed) ? parsed["results"] : undefined
    if (!Array.isArray(results)) return []
    return results.flatMap((entry) => {
      if (!isRecord(entry)) return []
      const severity = String(entry["issue_severity"] ?? "").toUpperCase() === "HIGH" ? "high" : "medium"
      return push(severity, `${String(entry["test_id"] ?? "bandit")} ${String(entry["issue_text"] ?? "")}`.trim())
    })
  }
  if (id === "shellcheck") {
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      if (!isRecord(entry)) return []
      const level = String(entry["level"] ?? "warning").toLowerCase()
      const severity = level === "error" ? "high" : "medium"
      return push(severity, `${String(entry["code"] ?? "SC")} ${String(entry["message"] ?? "")}`.trim())
    })
  }
  return []
}

const EXTERNAL_ADAPTERS: { id: string; binary: string; supports: (file: string) => boolean; args: (file: string) => string[] }[] = [
  {
    id: "gitleaks",
    binary: "gitleaks",
    supports: () => true,
    args: (file) => ["detect", "--no-git", "--source", file, "--report-format", "json", "--report-path", "/dev/stdout", "--no-banner", "--exit-code", "0"],
  },
  {
    id: "semgrep",
    binary: "semgrep",
    supports: () => true,
    args: (file) => ["scan", "--json", "--quiet", "--config", "auto", file],
  },
  {
    id: "bandit",
    binary: "bandit",
    supports: (file) => file.endsWith(".py"),
    args: (file) => ["-f", "json", "-q", file],
  },
  {
    id: "shellcheck",
    binary: "shellcheck",
    supports: (file) => /\.(sh|bash)$/.test(file),
    args: (file) => ["-f", "json", "-S", "error", file],
  },
]

async function defaultExternalRunner(input: ExternalRunInput): Promise<ExternalRunResult> {
  const { execFile } = await import('node:child_process')
  return await new Promise((resolve, reject) => {
    execFile(input.tool, [...input.args], { cwd: input.cwd, timeout: EXTERNAL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : 1
      if (error !== null && (error as { killed?: boolean }).killed === true) reject(error)
      else resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
}

export interface VerifyCommandResult {
  readonly findings: VerifyFinding[]
  readonly evidence: ExecutionEvidence[]
}

/**
 * Run the configured project verification command (tests/typecheck) once per
 * mutating turn. Nonzero exit or failing test markers veto the turn; the parsed
 * evidence is always attached to the decision-engine state.
 */
export async function runVerifyCommand(command: string, cwd: string, timeoutMs = 60_000): Promise<VerifyCommandResult> {
  const { execFile } = await import('node:child_process')
  const { code, stdout, stderr } = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    execFile('/bin/sh', ['-c', command], { cwd, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, out, err) => {
      const exit = error === null ? 0 : typeof (error as { code?: unknown }).code === 'number' ? (error as { code: number }).code : 1
      if (error !== null && (error as { killed?: boolean }).killed === true) reject(error)
      else resolve({ code: exit, stdout: String(out ?? ''), stderr: String(err ?? '') })
    })
  })
  {
    const output = `${stdout}\n${stderr}`.trim()
    const evidence = executionEvidence([{ tool: "verify", input: command, output }])
    const findings: VerifyFinding[] = evidence
      .filter((entry) => entry.status === "fail")
      .map((entry) => ({
        rule: `execution-${entry.kind}`,
        severity: "high" as const,
        detail: `verify command: ${entry.summary || entry.kind}`.slice(0, 200),
        tool: "verify",
      }))
    if (code !== 0 && findings.length === 0) {
      findings.push({
        rule: "verify-command",
        severity: "high",
        detail: `verify command exited ${code}: ${firstLine(output, /./)}`.slice(0, 200),
        tool: "verify",
      })
    }
    return { findings, evidence }
  }
}

export async function verifyExternalFiles(
  paths: readonly string[],
  options: ExternalVerifyOptions = {},
): Promise<VerifyFinding[]> {
  const mode = options.external ?? "auto"
  if (mode === "off") return []
  const files = [...new Set(paths)].slice(0, MAX_EXTERNAL_FILES)
  if (files.length === 0) return []
  const disabled = new Set(options.disable ?? [])
  const runner = options.runner ?? defaultExternalRunner
  const available = options.available ?? ((binary: string) => {
    try {
      const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
      execFileSync('which', [binary], { stdio: 'ignore', timeout: 2000 })
      return true
    } catch {
      return false
    }
  })
  const findings: VerifyFinding[] = []

  for (const adapter of EXTERNAL_ADAPTERS) {
    if (disabled.has(`external-${adapter.id}`)) continue
    if (!available(adapter.binary)) continue
    for (const file of files.filter((candidate) => adapter.supports(candidate))) {
      try {
        const result = await runner({ tool: adapter.binary, args: adapter.args(file), cwd: options.cwd })
        findings.push(...externalFindings(adapter.id, file, parseJson(result.stdout)))
        if (findings.length >= MAX_FINDINGS) return findings.slice(0, MAX_FINDINGS)
      } catch {
        // absent/broken/incompatible scanner: the built-in lane already ran
      }
    }
  }
  return findings.slice(0, MAX_FINDINGS)
}
