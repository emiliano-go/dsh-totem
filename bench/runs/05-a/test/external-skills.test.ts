import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  linkSkill,
  managedSkillsRoot,
  readSkillLock,
  syncExternalSkills,
} from '../script/external-skills.ts'

function temp(): string {
  return mkdtempSync(join(tmpdir(), 'dsh-totem-skills-'))
}

test('the lock file declares the expected external skills', () => {
  const lock = readSkillLock(join(import.meta.dir, '..', 'skills.lock.json'))
  const names = lock.map(skill => skill.name).sort()
  expect(names).toEqual([
    'charles-color-analysis', 'charles-hero-mockups', 'charles-polish',
    'charles-store-screenshots', 'charles-unreasonable-craft', 'charles-unslop', 'diagram-design',
    'dimensional-drawing', 'hallmark', 'humanizer', 'impeccable', 'last30days', 'logo-design',
    'taste-skill', 'unslop',
  ])
  // impeccable ships a DSH-specific variant; pin it instead of the Claude one.
  expect(lock.find(skill => skill.name === 'impeccable')?.path).toBe('.dsh/skills/impeccable')
  // humanizer keeps its skill at the repository root.
  expect(lock.find(skill => skill.name === 'humanizer')?.path).toBe('.')
  for (const skill of lock) expect(skill.repo).toMatch(/^[\w.-]+\/[\w.-]+$/u)
})

test('a malformed lock file is rejected with the offending entry', () => {
  const dir = temp()
  const path = join(dir, 'lock.json')
  writeFileSync(path, JSON.stringify([{ name: 'Bad Name', repo: 'a/b', path: 'skills/x' }]))
  expect(() => readSkillLock(path)).toThrow(/invalid name/u)
  writeFileSync(path, JSON.stringify({ not: 'an array' }))
  expect(() => readSkillLock(path)).toThrow(/expected an array/u)
})

test('linking is idempotent and never adopts a real directory', () => {
  const dir = temp()
  const source = join(dir, 'checkout', 'skills', 'x')
  mkdirSync(source, { recursive: true })
  const dest = join(dir, 'agents', 'x')
  mkdirSync(join(dir, 'agents'), { recursive: true })

  expect(linkSkill(source, dest)).toBe('linked')
  expect(readlinkSync(dest)).toBe(source)
  expect(linkSkill(source, dest)).toBe('skipped')

  // A directory someone else owns stays untouched.
  const owned = join(dir, 'agents', 'owned')
  mkdirSync(owned)
  expect(linkSkill(source, owned)).toBe('skipped')
})

test('a repointed symlink follows this checkout', () => {
  const dir = temp()
  const first = join(dir, 'a')
  const second = join(dir, 'b')
  mkdirSync(first)
  mkdirSync(second)
  const dest = join(dir, 'agents', 'x')
  mkdirSync(join(dir, 'agents'), { recursive: true })
  linkSkill(first, dest)
  expect(linkSkill(second, dest)).toBe('linked')
  expect(readlinkSync(dest)).toBe(second)
})

test('the managed root defaults under the data directory', () => {
  expect(managedSkillsRoot({}, '/home/test')).toBe('/home/test/.local/share/dsh-totem/skills')
  expect(managedSkillsRoot({ DSH_TOTEM_SKILLS_DIR: '/opt/skills' }, '/home/test')).toBe('/opt/skills')
})

test('--check reports the plan without cloning', () => {
  const dir = temp()
  const plan = syncExternalSkills({
    lockPath: join(import.meta.dir, '..', 'skills.lock.json'),
    managed: join(dir, 'managed'),
    destRoot: join(dir, 'agents'),
    check: true,
    only: ['humanizer'],
  })
  expect(plan).toHaveLength(1)
  expect(plan[0].action).toBe('planned')
  expect(plan[0].detail).toContain('would clone blader/humanizer')
})
