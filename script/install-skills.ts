#!/usr/bin/env bun
/**
 * Install the bundle's portable skills into the user-level skill root.
 *
 * `.agents/skills/` in the package is a *project* root: DSH discovers it only
 * for sessions whose cwd is inside the checkout. The same skills are meant to
 * work in every project, which is what `~/.agents/skills` is for. Symbolic
 * links are preferred so edits in the checkout take effect without a reinstall;
 * platforms that refuse symlinks fall back to a copy.
 *
 * Existing directories that are not links to this checkout are left alone.
 *
 * @module dsh-totem/script/install-skills
 */
import { cpSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readSkillLock, syncExternalSkills, type ExternalInstall } from './external-skills.ts'

export type SkillAction = 'linked' | 'copied' | 'skipped'

export interface SkillInstall {
  name: string
  action: SkillAction
  dest: string
}

const root = join(import.meta.dir, '..')
const sourceRoot = join(root, '.agents', 'skills')

/** Portable skills plus the external checkouts declared in `skills.lock.json`. */
export interface AllSkills {
  portable: SkillInstall[]
  external: ExternalInstall[]
}

/**
 * Install both kinds of skill.
 * @param options.destRoot - user-level skill root.
 * @param options.external - sync `skills.lock.json` checkouts too (default true).
 * @param options.check - report the external plan without touching anything.
 */
export function installAllSkills(options: {
  destRoot?: string
  external?: boolean
  check?: boolean
} = {}): AllSkills {
  const portable = installPortableSkills(options.destRoot)
  if (options.external === false) return { portable, external: [] }
  const lockPath = join(root, 'skills.lock.json')
  const external = syncExternalSkills({
    lockPath,
    ...options.destRoot === undefined ? {} : { destRoot: options.destRoot },
    ...options.check === true ? { check: true } : {},
  })
  return { portable, external }
}

/** Link (or copy) every shipped skill into `~/.agents/skills`. */
export function installPortableSkills(destRoot = join(homedir(), '.agents', 'skills')): SkillInstall[] {
  mkdirSync(destRoot, { recursive: true })
  const installed: SkillInstall[] = []

  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const source = join(sourceRoot, entry.name)
    const dest = join(destRoot, entry.name)

    let existing
    try {
      existing = lstatSync(dest)
    } catch {
      existing = undefined
    }

    if (existing !== undefined) {
      if (existing.isSymbolicLink() && readlinkSync(dest) === source) {
        installed.push({ name: entry.name, action: 'skipped', dest })
        continue
      }
      if (existing.isSymbolicLink()) {
        // A link to another checkout: repoint it at this one.
        rmSync(dest)
      } else {
        installed.push({ name: entry.name, action: 'skipped', dest })
        continue
      }
    }

    try {
      symlinkSync(source, dest, 'dir')
      installed.push({ name: entry.name, action: 'linked', dest })
    } catch {
      cpSync(source, dest, { recursive: true })
      installed.push({ name: entry.name, action: 'copied', dest })
    }
  }

  return installed
}

if (import.meta.main) {
  const check = process.argv.includes('--check')
  const { portable, external } = installAllSkills({
    external: !process.argv.includes('--no-external'),
    check,
  })
  for (const item of portable) {
    const verb = item.action === 'skipped' ? 'left existing' : item.action
    console.log(`  ${verb}: ${item.name} -> ${item.dest}`)
  }
  for (const item of external) {
    const verb = item.action === 'skipped' ? 'left existing' : item.action
    console.log(`  ${verb}: ${item.name}${item.detail === undefined ? '' : ` (${item.detail})`} -> ${item.dest ?? ''}`)
  }
  const failed = external.filter(item => item.action === 'failed')
  console.log(`\n${portable.length + external.length - failed.length} skill(s) available in every project.`)
  if (failed.length > 0) {
    console.error(`${failed.length} external skill(s) failed: ${failed.map(item => item.name).join(', ')}`)
    process.exit(1)
  }
}
