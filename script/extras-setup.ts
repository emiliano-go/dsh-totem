#!/usr/bin/env bun
/**
 * Install the agent extras the bundle documents: Agent Reach, OpenMotion, and
 * the Modern Web Guidance skill.
 *
 * Three moving parts:
 *   1. Agent Reach — a CLI that reaches social/video platforms, installed from
 *      its GitHub release zip with `uv` (the PyPI `agent-reach` is a different,
 *      unrelated package). Its own `setup` installs the default channels and
 *      refreshes its skill.
 *   2. OpenMotion — a motion runtime with an MCP surface. Cloned into a managed
 *      directory, built, and left ready to serve on :7000 (`/api/mcp` is the
 *      MCP endpoint the bundle wires over Streamable HTTP).
 *   3. The Modern Web Guidance skill — vendored in this repository, linked into
 *      `~/.agents/skills` by the shared installer.
 *
 * Idempotent: an existing clone is fast-forwarded, an installed Agent Reach is
 * upgraded in place, and re-running the skill installer only refreshes links.
 * `--check` reports state without touching anything; `--no-build` skips the
 * slow OpenMotion build.
 *
 * @module dsh-totem/script/extras-setup
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { installPortableSkills } from './install-skills.ts'

/** The release zip Agent Reach documents; the PyPI name belongs to another project. */
export const AGENT_REACH_ZIP = 'https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip'
/** Upstream OpenMotion monorepo. */
export const OPENMOTION_REPO = 'https://github.com/Yuan-ManX/open-motion.git'
/** OpenMotion's default port; `/api/mcp` is mounted on it. */
export const OPENMOTION_PORT = 7000

const root = join(import.meta.dir, '..')
const args = process.argv.slice(2)
const check = args.includes('--check')
const build = !args.includes('--no-build')
const skip = (name: string): boolean => args.includes(`--skip-${name}`)

interface RunOptions {
  cwd?: string
  allowFailure?: boolean
  stdin?: 'inherit' | 'ignore'
}

function run(command: string, commandArgs: string[], options: RunOptions = {}): number {
  if (check) {
    console.log(`  would run: ${command} ${commandArgs.join(' ')}`)
    return 0
  }
  const result = Bun.spawnSync([command, ...commandArgs], {
    cwd: options.cwd ?? root,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: options.stdin ?? 'inherit',
  })
  const code = result.exitCode ?? 1
  if (code !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${commandArgs.join(' ')} exited ${code}`)
  }
  return code
}

function have(command: string): boolean {
  try {
    return Bun.spawnSync(['sh', '-c', `command -v ${command}`], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0
  } catch {
    return false
  }
}

function log(message: string): void {
  console.log(`\n▸ ${message}`)
}

/** Managed OpenMotion checkout, overridable for tests and custom installs. */
export function openMotionRoot(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return env.OPENMOTION_DIR?.trim() || join(home, '.local', 'share', 'dsh-totem', 'open-motion')
}

/** Where the built OpenMotion web assets land. */
export function openMotionWebDist(omRoot: string): string {
  return join(omRoot, 'web', 'dist')
}

/** The bundle refuses to start this entry until OpenMotion is serving. */
export function openMotionRunning(omRoot: string): boolean {
  return existsSync(join(omRoot, 'open-motion', 'dist', 'src', 'index.js'))
    && existsSync(openMotionWebDist(omRoot))
}

function agentReach(): void {
  log('Agent Reach')
  if (!have('uv')) {
    throw new Error('uv is required for Agent Reach: curl -LsSf https://astral.sh/uv/install.sh | sh')
  }
  const installed = have('agent-reach')
  console.log(installed ? '  agent-reach found; upgrading from the release zip' : '  installing from the release zip')
  run('uv', ['tool', 'install', ...installed ? ['--force'] : [], AGENT_REACH_ZIP])
  if (!check && !have('agent-reach')) {
    throw new Error('agent-reach is still not on PATH; run `uv tool update-shell` and open a new shell')
  }
  console.log(installed ? '  refreshing channels and the skill' : '  setting up default channels and the skill')
  run('agent-reach', ['setup'])
}

function openMotion(): void {
  const omRoot = openMotionRoot()
  log(`OpenMotion (${omRoot})`)
  if (!existsSync(join(omRoot, 'package.json'))) {
    run('git', ['clone', '--depth', '1', OPENMOTION_REPO, omRoot])
  } else {
    console.log('  existing checkout; fast-forwarding')
    run('git', ['-C', omRoot, 'pull', '--ff-only'], { allowFailure: true })
  }
  const nodeMajor = Number(Bun.spawnSync(['node', '-p', 'process.versions.node.split(".")[0]'], {
    stdout: 'pipe',
  }).stdout.toString().trim())
  if (Number.isFinite(nodeMajor) && nodeMajor < 22) {
    throw new Error(`OpenMotion needs Node >= 22.5, found ${nodeMajor}`)
  }
  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: omRoot })
  if (!build) {
    console.log('  --no-build: skipping the build')
  } else {
    // Upstream main has shipped without files its own imports name
    // (`server/routes/batch.ts`, `motion/templates/crystalCascade.ts`), so the
    // build fails in their tree, not ours. Keep the checkout and say so
    // instead of pretending the install worked.
    const code = run('npm', ['run', 'build'], { cwd: omRoot, allowFailure: true })
    console.log(code === 0
      ? `  built; start it with: (cd ${omRoot} && npm -w @openmotion/server run start)`
      : `  WARNING: upstream does not build (npm run build exited ${code}).`
      + `\n  The checkout is kept at ${omRoot}; rerun this script after upstream fixes it.`)
  }
  console.log(`  MCP endpoint: http://127.0.0.1:${OPENMOTION_PORT}/api/mcp`)
}

function skills(): void {
  log('Portable skills')
  let names: { name: string; dest: string; action: string }[] = []
  if (check) {
    console.log('  would link .agents/skills into ~/.agents/skills')
  } else {
    names = installPortableSkills()
  }
  for (const skill of names) {
    console.log(`  ${skill.action === 'skipped' ? 'left existing' : skill.action}: ${skill.name} -> ${skill.dest}`)
  }
  const guidance = join(root, '.agents', 'skills', 'modern-web-guidance', 'SKILL.md')
  console.log(existsSync(guidance)
    ? '  modern-web-guidance: vendored (npx-driven, no local data needed)'
    : '  modern-web-guidance: MISSING from .agents/skills')
}

async function main(): Promise<void> {
  if (!skip('agent-reach')) agentReach()
  if (!skip('open-motion')) openMotion()
  if (!skip('skills')) skills()

  log('Next steps')
  console.log('  Start OpenMotion before using its tools:')
  console.log(`    (cd ${openMotionRoot()} && npm -w @openmotion/server run start)`)
  console.log('    then the bundle exposes mcp__openmotion__* on the next DSH start')
  console.log('  Agent Reach is a CLI, so the agent calls it directly:')
  console.log('    agent-reach channels')
  console.log('    agent-reach read https://example.com/post')
  console.log('  Modern Web Guidance is a skill: it runs through npx when a web UI task starts.')
  if (check) console.log('\n  --check: nothing was changed')
}

if (import.meta.main) await main()
