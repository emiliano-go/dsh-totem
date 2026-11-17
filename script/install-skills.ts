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

export type SkillAction = 'linked' | 'copied' | 'skipped'

export interface SkillInstall {
  name: string
  action: SkillAction
  dest: string
}

const root = join(import.meta.dir, '..')
const sourceRoot = join(root, '.agents', 'skills')

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
  const installed = installPortableSkills()
  for (const item of installed) {
    const verb = item.action === 'skipped' ? 'left existing' : item.action
    console.log(`  ${verb}: ${item.name} -> ${item.dest}`)
  }
  console.log(`\n${installed.length} portable skill(s) available in every project.`)
}
