/**
 * Deterministic verifier CLI.
 *
 * Runs the built-in verify lane and the extra rule pack over a unified diff, a
 * real repository diff, or a JSON change list — no Host, no model, no GPU. This
 * is the offline entry point for testing the rules and for wiring them into a
 * pre-commit hook or CI step.
 *
 * Usage:
 *   bun run script/verify.ts --repo .                 # git diff HEAD
 *   bun run script/verify.ts --repo . --staged        # index only
 *   bun run script/verify.ts --patch change.diff
 *   bun run script/verify.ts --changes changes.json --root .
 *   ... --json | --disable a,b | --quiet
 *
 * Exit codes: 0 clean, 1 blocking finding, 2 usage error.
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { verifyChanges, type VerifyChange } from '../src/verify.ts'
import { verifyExtraChanges } from '../src/rules.ts'

export interface CliArgs {
  patch?: string
  repo?: string
  changes?: string
  root?: string
  staged: boolean
  json: boolean
  quiet: boolean
  disable: string[]
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { staged: false, json: false, quiet: false, disable: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    switch (flag) {
      case '--patch': args.patch = value; index += 1; break
      case '--repo': args.repo = value; index += 1; break
      case '--changes': args.changes = value; index += 1; break
      case '--root': args.root = value; index += 1; break
      case '--disable': args.disable = (value ?? '').split(',').map(part => part.trim()).filter(Boolean); index += 1; break
      case '--staged': args.staged = true; break
      case '--json': args.json = true; break
      case '--quiet': args.quiet = true; break
      case '--help':
        console.log('usage: bun run script/verify.ts (--repo path [--staged] | --patch file | --changes file) [--root path] [--disable a,b] [--json] [--quiet]')
        process.exit(0)
        break
      default:
        throw new Error(`unknown argument: ${flag}`)
    }
  }
  return args
}

/** Split a unified diff into one change per file. */
export function changesFromPatch(patch: string): VerifyChange[] {
  const chunks = patch.split(/^diff --git /mu).filter(chunk => chunk.trim().length > 0)
  return chunks.flatMap((chunk) => {
    const text = chunk.startsWith('diff --git ') ? chunk : `diff --git ${chunk}`
    const target = /^\+\+\+ (?:b\/)?(\S+)/mu.exec(text)?.[1]
    const source = /^--- (?:a\/)?(\S+)/mu.exec(text)?.[1]
    const path = target !== undefined && target !== '/dev/null' ? target : source
    if (path === undefined) return []
    return [{ tool: 'apply_patch', input: '', output: '', diff: text, paths: [path] }]
  })
}

/** Working-tree (or staged) diff for a repository. */
export function repoPatch(repo: string, staged: boolean): string {
  const args = ['-C', repo, 'diff', '--no-color', '--no-ext-diff']
  if (staged) args.push('--cached')
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** Load a JSON change list and normalise it to `VerifyChange`. */
export function changesFromJson(text: string): VerifyChange[] {
  const parsed = JSON.parse(text) as unknown
  if (!Array.isArray(parsed)) throw new Error('--changes expects a JSON array')
  return parsed.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    return [{
      tool: typeof record.tool === 'string' ? record.tool : 'edit',
      input: typeof record.input === 'string' ? record.input : '',
      output: typeof record.output === 'string' ? record.output : '',
      ...typeof record.diff === 'string' ? { diff: record.diff } : {},
      ...Array.isArray(record.paths) ? { paths: record.paths.filter((path): path is string => typeof path === 'string') } : {},
    }]
  })
}

function load(argv: readonly string[]): { changes: VerifyChange[]; root?: string; disable: string[]; json: boolean; quiet: boolean } {
  const args = parseArgs(argv)
  const root = args.root === undefined ? undefined : (isAbsolute(args.root) ? args.root : resolve(args.root))
  if (args.patch !== undefined) {
    return { changes: changesFromPatch(readFileSync(args.patch, 'utf8')), ...root === undefined ? {} : { root }, disable: args.disable, json: args.json, quiet: args.quiet }
  }
  if (args.repo !== undefined) {
    const repo = isAbsolute(args.repo) ? args.repo : resolve(args.repo)
    return { changes: changesFromPatch(repoPatch(repo, args.staged)), root: root ?? repo, disable: args.disable, json: args.json, quiet: args.quiet }
  }
  if (args.changes !== undefined) {
    return { changes: changesFromJson(readFileSync(args.changes, 'utf8')), ...root === undefined ? {} : { root }, disable: args.disable, json: args.json, quiet: args.quiet }
  }
  throw new Error('one of --repo, --patch, or --changes is required')
}

function main(): number {
  let loaded: ReturnType<typeof load>
  try {
    loaded = load(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
  const builtIn = verifyChanges(loaded.changes, { disable: loaded.disable })
  const extra = verifyExtraChanges(loaded.changes, {
    disable: loaded.disable,
    ...loaded.root === undefined ? {} : { root: loaded.root },
  })
  const findings = [...builtIn.findings, ...extra]
  const blocking = builtIn.veto || extra.some(finding => finding.severity === 'high')

  if (loaded.json) {
    console.log(JSON.stringify({ findings, blocking, changes: loaded.changes.length }, null, 2))
  } else if (!loaded.quiet) {
    console.log(`${loaded.changes.length} change(s), ${findings.length} finding(s)`)
    for (const finding of findings) {
      const path = finding.path === undefined ? '' : ` ${finding.path}`
      console.log(`  ${finding.severity.padEnd(6)} ${finding.rule}${path}: ${finding.detail}`)
    }
    if (findings.length === 0) console.log('  clean')
  }
  return blocking ? 1 : 0
}

if (import.meta.main) process.exitCode = main()
