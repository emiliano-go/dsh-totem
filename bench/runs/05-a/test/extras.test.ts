import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  AGENT_REACH_ZIP,
  OPENMOTION_PORT,
  OPENMOTION_REPO,
  openMotionRoot,
  openMotionRunning,
  openMotionWebDist,
} from '../script/extras-setup.ts'

test('Agent Reach installs from its release zip, never PyPI', () => {
  // The PyPI package with this name is a different project; the installer’s
  // whole contract is to fetch the GitHub release asset.
  expect(AGENT_REACH_ZIP.startsWith('https://github.com/Panniantong/Agent-Reach/')).toBe(true)
  expect(AGENT_REACH_ZIP.endsWith('/agent-reach.zip')).toBe(true)
  expect(OPENMOTION_REPO).toBe('https://github.com/Yuan-ManX/open-motion.git')
})

test('the OpenMotion checkout lives in one managed directory', () => {
  expect(openMotionRoot({}, '/home/test')).toBe('/home/test/.local/share/dsh-totem/open-motion')
  expect(openMotionRoot({ OPENMOTION_DIR: '/opt/om' }, '/home/test')).toBe('/opt/om')
  // A blank override must not resolve to the process directory.
  expect(openMotionRoot({ OPENMOTION_DIR: '  ' }, '/home/test')).toBe('/home/test/.local/share/dsh-totem/open-motion')
})

test('readiness needs both the server build and the web build', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-totem-extras-'))
  expect(openMotionRunning(root)).toBe(false)
  mkdirSync(join(root, 'open-motion', 'dist', 'src'), { recursive: true })
  writeFileSync(join(root, 'open-motion', 'dist', 'src', 'index.js'), '')
  expect(openMotionRunning(root)).toBe(false)
  mkdirSync(openMotionWebDist(root), { recursive: true })
  expect(openMotionRunning(root)).toBe(true)
  expect(openMotionWebDist(root)).toBe(join(root, 'web', 'dist'))
})

test('the MCP entry points at the server’s default port', () => {
  expect(OPENMOTION_PORT).toBe(7000)
})
