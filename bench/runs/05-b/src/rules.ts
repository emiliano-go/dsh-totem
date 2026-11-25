/**
 * Deterministic rule pack: high-precision checks that need no model.
 *
 * The existing verify lane in `verify.ts` covers secrets, injection,
 * destructive commands, silent swallows, test weakening, and scope prose. This
 * pack adds the failure modes that survive those checks but are still provable
 * from the diff alone: shipped merge markers, debug breakpoints, credential
 * files, writes that escape the project, bare excepts, assertion-free tests,
 * dependency drift, sleeps in tests, and added binaries.
 *
 * Two properties matter more than coverage:
 *
 * - **Diff awareness.** A rule looks at *added* lines when a unified diff is
 *   present, so pre-existing code in a large file is never blamed on the change.
 * - **Precision over recall.** Every rule here can be argued from the text. A
 *   noisy rule costs a retry and teaches the model to distrust the gate, which
 *   is worse than missing a case a reviewer will catch.
 *
 * @module dsh-totem/rules
 */
import { isAbsolute, relative, resolve } from 'node:path'
import type { VerifyChange, VerifyFinding } from './verify.ts'
import { isGeneratedPath, isTestPath } from './paths.ts'

export { isGeneratedPath, isTestPath }

/** What one rule sees. */
export interface RuleContext {
  /** The tool call being judged. */
  readonly change: VerifyChange
  /** Lines the change adds, without the diff prefix. */
  readonly added: readonly string[]
  /** Lines the change removes, without the diff prefix. */
  readonly removed: readonly string[]
  /** Path the change targets, when known. */
  readonly path: string
  /** Project root, when the caller knows it. */
  readonly root?: string
}

/** One deterministic check. `detail` is returned only when it fires. */
export interface Rule {
  readonly id: string
  readonly severity: 'high' | 'medium'
  readonly description: string
  readonly check: (context: RuleContext) => string | undefined
}

/** Options accepted by {@link verifyExtraChanges}. */
export interface ExtraVerifyOptions {
  /** Project root, used to prove a write stays inside the repository. */
  readonly root?: string
  /** Rule ids to skip. */
  readonly disable?: readonly string[]
}

const MAX_FINDINGS = 20

/** Path a change targets: explicit paths first, then the tool's file argument. */
export function changePath(change: VerifyChange): string {
  const explicit = change.paths?.find(path => typeof path === 'string' && path.length > 0)
  if (explicit !== undefined) return explicit
  const match = /(?:filePath|file_path|path)\s*=\s*([^\s]+)/u.exec(change.input)
  if (match?.[1] !== undefined) return match[1].replace(/^["']|["']$/gu, '')
  return ''
}

/** Lines the change adds. Falls back to the payload when there is no diff. */
export function addedLines(change: VerifyChange): string[] {
  const diff = change.diff ?? ''
  if (diff.includes('@@')) {
    return diff
      .split('\n')
      .filter(line => line.startsWith('+') && !line.startsWith('+++'))
      .map(line => line.slice(1))
  }
  return change.input.split('\n')
}

/** Lines the change removes. */
export function removedLines(change: VerifyChange): string[] {
  const diff = change.diff ?? ''
  if (!diff.includes('@@')) return []
  return diff
    .split('\n')
    .filter(line => line.startsWith('-') && !line.startsWith('---'))
    .map(line => line.slice(1))
}

function firstMatch(lines: readonly string[], pattern: RegExp): string | undefined {
  for (const line of lines) {
    if (pattern.test(line)) return line.trim().slice(0, 140)
  }
  return undefined
}

const MANIFESTS: Record<string, string[]> = {
  'package.json': ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'],
  'pyproject.toml': ['uv.lock', 'poetry.lock', 'pdm.lock'],
  'Cargo.toml': ['Cargo.lock'],
  'go.mod': ['go.sum'],
  'Gemfile': ['Gemfile.lock'],
  'composer.json': ['composer.lock'],
}

/** Deterministic checks, in reporting order. */
export const RULES: readonly Rule[] = [
  {
    id: 'conflict-markers',
    severity: 'high',
    description: 'A shipped merge marker is the change, not the code around it.',
    check: ({ added }) => {
      if (added.some(line => /^\s*(?:<{7}|={7}|>{7})(?:\s|$)/u.test(line))) return 'merge conflict markers left in the file'
      return undefined
    },
  },
  {
    id: 'debug-breakpoint',
    severity: 'high',
    description: 'An interactive debugger call halts a test run or a deployed process.',
    check: ({ added }) => {
      const hit = firstMatch(added, /(?:\bpdb\.set_trace\s*\(|\bbreakpoint\s*\(\s*\)|\bdebugger\s*;|\bbinding\.pry\b)/u)
      return hit === undefined ? undefined : `debugger left behind: ${hit}`
    },
  },
  {
    id: 'credential-file',
    severity: 'high',
    description: 'A write creates a file whose whole purpose is to hold a secret.',
    check: ({ change, path }) => {
      const name = path.split('/').pop() ?? ''
      if (/\.(?:example|sample|template|dist)$/u.test(name)) return undefined
      // A patch that deletes the file is removing the secret, not adding one.
      if ((change.diff ?? '').includes('+++ /dev/null')) return undefined
      if (/^(?:\.env(?:\.[^/]*)?|id_rsa|id_ed25519|\.netrc|credentials\.json)$/u.test(name)
        || /\.(?:pem|key|p12|pfx)$/u.test(name)) {
        return `writes a credential-bearing file: ${path}`
      }
      return undefined
    },
  },
  {
    id: 'path-escape',
    severity: 'high',
    description: 'A write outside the project silently edits the host.',
    check: ({ change, path, root }) => {
      if (change.tool !== 'write' && change.tool !== 'edit' && change.tool !== 'apply_patch') return undefined
      if (path.length === 0) return undefined
      const normalized = path.replace(/\\/gu, '/')
      if (/(?:^|\/)\.\.(?:\/|$)/u.test(normalized)) return `path escapes the project: ${path}`
      if (root === undefined) return undefined
      const target = isAbsolute(path) ? path : resolve(root, path)
      const rel = relative(resolve(root), target)
      if (rel.startsWith('..') || isAbsolute(rel)) return `path escapes the project: ${path}`
      return undefined
    },
  },
  {
    id: 'bare-except',
    severity: 'medium',
    description: 'A bare except swallows keyboard interrupts, exits, and every real bug.',
    check: ({ added }) => {
      const hit = firstMatch(added, /^\s*except\s*:\s*$/u)
      return hit === undefined ? undefined : 'bare except'
    },
  },
  {
    id: 'assertion-free-test',
    severity: 'medium',
    description: 'A test that asserts a constant can never fail.',
    check: ({ added, path }) => {
      if (!isTestPath(path)) return undefined
      const hit = firstMatch(added, /(?:\bassert\s+(?:True|1|\(\s*\)|\{\s*\}|\[\s*\])\s*$|(?:\bassertTrue\s*\(\s*(?:True|1)\s*\))|(?:expect\s*\(\s*(?:true|1)\s*\)\s*\.\s*to(?:Be|Equal)\s*\(\s*(?:true|1)\s*\)))/u)
      return hit === undefined ? undefined : `asserts a constant: ${hit}`
    },
  },
  {
    id: 'test-sleep',
    severity: 'medium',
    description: 'A fixed sleep in a test is a flake waiting for a slow machine.',
    check: ({ added, path }) => {
      if (!isTestPath(path)) return undefined
      // `setTimeout(resolve, 0)` yields a tick; only a real wait is a flake risk.
      const hit = firstMatch(added, /(?:\btime\.sleep\s*\(|\bawait\s+(?:new\s+)?Promise\s*\(\s*resolve\s*=>\s*setTimeout\s*\(\s*resolve\s*,\s*(?:[1-9]\d{2,}|\d{4,})\s*\))/u)
      return hit === undefined ? undefined : `fixed wait in a test: ${hit}`
    },
  },
  {
    id: 'public-api-removed',
    severity: 'medium',
    description: 'Removing an export breaks callers that are not in the diff.',
    check: ({ added, removed }) => {
      const exported = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/u
      const names = (lines: readonly string[]): string[] =>
        lines.flatMap((line) => {
          const name = exported.exec(line)?.[1]
          return name === undefined ? [] : [name]
        })
      const kept = new Set(names(added))
      const lost = [...new Set(names(removed))].filter(name => !kept.has(name))
      return lost.length === 0 ? undefined : `removes exported symbol(s): ${lost.join(', ')}`
    },
  },
  {
    id: 'binary-add',
    severity: 'medium',
    description: 'A binary file cannot be reviewed in a diff.',
    check: ({ change }) => {
      if (!(change.diff ?? '').includes('Binary files')) return undefined
      return 'adds or rewrites a binary file'
    },
  },
]

const METADATA_KEYS = new Set([
  'version', 'name', 'description', 'files', 'scripts', 'license', 'homepage', 'author',
  'repository', 'main', 'types', 'module', 'exports', 'engines', 'private', 'keywords',
])

/**
 * Whether a manifest diff actually moves a dependency version.
 *
 * A lockfile is only required when resolution changes; renaming the package or
 * editing `files` does not. JSON manifests are matched by a version-shaped
 * value on a non-metadata key, TOML/requirements by a version operator.
 */
export function touchesDependency(lines: readonly string[]): boolean {
  return lines.some((line) => {
    const json = /^\s*"([A-Za-z0-9@/_.-]+)"\s*:\s*"[~^<>=*]?\d[^"]*"/u.exec(line)
    if (json !== null && !METADATA_KEYS.has(json[1])) return true
    if (/^\s*[A-Za-z0-9_.-]+\s*(?:[<>=~!]=?|[<>])\s*[\w."']*\d/u.test(line)) return true
    if (/^\s*[A-Za-z0-9_.-]+\s*=\s*"[\^~<>=*]?\d[^"]*"/u.test(line)) return true
    return /\(?(?:>=|==|~=)\s*\d/u.test(line)
  })
}

/** Findings from the set-level rules, which need every change at once. */
function setLevelRules(changes: readonly VerifyChange[], disabled: ReadonlySet<string>): VerifyFinding[] {
  if (disabled.has('dependency-drift')) return []
  const paths = new Set(changes.map(change => (changePath(change).split('/').pop() ?? '').toLowerCase()))
  for (const [manifest, locks] of Object.entries(MANIFESTS)) {
    if (!paths.has(manifest.toLowerCase())) continue
    if (locks.some(lock => paths.has(lock.toLowerCase()))) continue
    const change = changes.find(entry => (changePath(entry).split('/').pop() ?? '').toLowerCase() === manifest.toLowerCase())
    // Editing metadata (files, scripts, description) does not require a lock
    // update; only a versioned dependency line does.
    if (change !== undefined && !touchesDependency([...addedLines(change), ...removedLines(change)])) {
      continue
    }
    return [{
      rule: 'dependency-drift',
      severity: 'medium',
      detail: `${manifest} changed without its lockfile (${locks.join(' / ')})`,
      tool: change?.tool ?? 'write',
      ...(change === undefined ? {} : { path: changePath(change) }),
    }]
  }
  return []
}

/**
 * Run the pack over a change set.
 *
 * Findings use the same shape as the built-in verify lane, so the caller can
 * merge them without translation and a high-severity hit vetoes the turn.
 */
export function verifyExtraChanges(
  changes: readonly VerifyChange[],
  options: ExtraVerifyOptions = {},
): VerifyFinding[] {
  const disabled = new Set(options.disable ?? [])
  const findings: VerifyFinding[] = []

  for (const change of changes) {
    if (isGeneratedPath(changePath(change))) continue
    const context: RuleContext = {
      change,
      added: addedLines(change),
      removed: removedLines(change),
      path: changePath(change),
      ...options.root === undefined ? {} : { root: options.root },
    }
    for (const rule of RULES) {
      if (disabled.has(rule.id)) continue
      const detail = rule.check(context)
      if (detail === undefined) continue
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        detail: `${rule.id}: ${detail}`.slice(0, 200),
        tool: change.tool,
        ...context.path.length === 0 ? {} : { path: context.path },
      })
    }
  }

  findings.push(...setLevelRules(changes, disabled))
  return findings.slice(0, MAX_FINDINGS)
}

/** Whether a finding set blocks the turn. */
export function hasBlockingFinding(findings: readonly VerifyFinding[]): boolean {
  return findings.some(finding => finding.severity === 'high')
}
