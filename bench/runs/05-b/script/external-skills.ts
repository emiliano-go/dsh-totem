#!/usr/bin/env bun
/**
 * External skills: checkouts managed here, linked into the user-level root.
 *
 * Some useful skills live in their own repositories and are too large to vendor
 * (tens of megabytes of references and assets). This module keeps one shallow,
 * sparse checkout per repository under `~/.local/share/dsh-totem/skills`, then
 * links the skill directory itself into `~/.agents/skills`, which every DSH
 * session scans.
 *
 * Sparse checkout matters: only the skill path is materialized, so a 124 MB
 * repository contributes a few hundred kilobytes. The install is declarative —
 * `skills.lock.json` is the source of truth, and adding a skill is one line.
 *
 * @module dsh-totem/script/external-skills
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

/** One declared skill. */
export interface ExternalSkill {
  /** Directory name under `~/.agents/skills`. */
  name: string
  /** `owner/repo` or a full clone URL. */
  repo: string
  /** Path of the skill directory inside the repository; `.` is the root. */
  path: string
}

/** What the installer did for one entry. */
export interface ExternalInstall {
  name: string
  action: 'cloned' | 'updated' | 'linked' | 'skipped' | 'failed' | 'planned'
  dest?: string
  detail?: string
}

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/u

/** Parse and validate `skills.lock.json`. */
export function readSkillLock(path: string): ExternalSkill[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected an array`)
  return parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) throw new Error(`${path}[${index}]: expected an object`)
    const record = entry as Record<string, unknown>
    const { name, repo, path: skillPath } = record
    if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`${path}[${index}]: invalid name`)
    if (typeof repo !== 'string' || repo.trim().length === 0) throw new Error(`${path}[${index}]: invalid repo`)
    if (typeof skillPath !== 'string' || skillPath.trim().length === 0) throw new Error(`${path}[${index}]: invalid path`)
    return { name, repo: repo.trim(), path: skillPath.trim() }
  })
}

/** Managed checkout root, overridable for tests and custom installs. */
export function managedSkillsRoot(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return env.DSH_TOTEM_SKILLS_DIR?.trim() || join(home, '.local', 'share', 'dsh-totem', 'skills')
}

function git(args: string[]): { code: number; stderr: string } {
  const result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode ?? 1, stderr: result.stderr.toString().trim() }
}

function cloneUrl(repo: string): string {
  if (repo.includes('://') || repo.startsWith('git@')) return repo
  return `https://github.com/${repo}`
}

/** Link `source` into `destRoot`, leaving a real directory that already exists alone. */
export function linkSkill(source: string, dest: string): ExternalInstall['action'] {
  let existing
  try {
    existing = lstatSync(dest)
  } catch {
    existing = undefined
  }
  if (existing !== undefined) {
    if (existing.isSymbolicLink() && readlinkSync(dest) === source) return 'skipped'
    if (!existing.isSymbolicLink()) return 'skipped'
    rmSync(dest)
  }
  symlinkSync(source, dest, 'dir')
  return 'linked'
}

export interface SyncOptions {
  lockPath: string
  managed?: string
  destRoot?: string
  /** Report without touching the network or the filesystem. */
  check?: boolean
  /** Only these skill names. */
  only?: readonly string[]
}

/**
 * Clone, update, and link every skill in the lock file.
 * @returns one entry per skill, in lock order.
 */
export function syncExternalSkills(options: SyncOptions): ExternalInstall[] {
  const skills = readSkillLock(options.lockPath)
  const managed = options.managed ?? managedSkillsRoot()
  const destRoot = options.destRoot ?? join(homedir(), '.agents', 'skills')
  const only = options.only === undefined ? undefined : new Set(options.only)
  const results: ExternalInstall[] = []
  if (!options.check) mkdirSync(destRoot, { recursive: true })

  for (const skill of skills) {
    if (only !== undefined && !only.has(skill.name)) continue
    const dir = join(managed, skill.name)
    const source = skill.path === '.' || isAbsolute(skill.path) ? dir : join(dir, skill.path)
    if (options.check) {
      results.push({
        name: skill.name,
        action: 'planned',
        dest: join(destRoot, skill.name),
        detail: existsSync(source) ? 'checkout present' : `would clone ${skill.repo}`,
      })
      continue
    }

    if (!existsSync(join(dir, '.git'))) {
      mkdirSync(managed, { recursive: true })
      const sparse = skill.path !== '.'
      const clone = git([
        'clone', '--depth', '1',
        ...sparse ? ['--filter=blob:none', '--sparse'] : [],
        cloneUrl(skill.repo), dir,
      ])
      if (clone.code !== 0) {
        results.push({ name: skill.name, action: 'failed', detail: clone.stderr })
        continue
      }
      if (sparse) {
        const set = git(['-C', dir, 'sparse-checkout', 'set', '--no-cone', skill.path])
        if (set.code !== 0) {
          results.push({ name: skill.name, action: 'failed', detail: set.stderr })
          continue
        }
      }
      if (!existsSync(source)) {
        results.push({ name: skill.name, action: 'failed', detail: `${skill.path} does not exist upstream` })
        continue
      }
      mkdirSync(dir, { recursive: true })
    } else {
      // A failed pull (offline, detached head) must not lose the working copy.
      git(['-C', dir, 'pull', '--ff-only', '--depth', '1'])
    }

    if (!existsSync(source)) {
      results.push({ name: skill.name, action: 'failed', detail: `${skill.path} is missing from the checkout` })
      continue
    }
    const dest = join(destRoot, skill.name)
    const linkAction = linkSkill(source, dest)
    results.push({ name: skill.name, action: linkAction, dest })
  }

  return results
}
