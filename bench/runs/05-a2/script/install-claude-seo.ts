#!/usr/bin/env bun
/**
 * Install the claude-seo skill collection into the user-level DSH skill root.
 *
 * The upstream installer targets `~/.claude/skills` and rewrites
 * `${CLAUDE_PLUGIN_ROOT}` for Claude Code. DSH scans `~/.agents/skills`, so
 * this adapter copies the same skill tree there, rewrites the launcher paths
 * for the DSH location, and runs the isolated Python runtime setup.
 *
 * The 20 Claude sub-agent prompts are copied to `seo/agents/`; DSH has no
 * agent registry, but its `subagent` tool can run one by passing that file's
 * body as the child prompt. Skills run inline when that is not done.
 *
 * Usage:
 *   bun run script/install-claude-seo.ts
 *   bun run script/install-claude-seo.ts --skip-browser
 *
 * @module dsh-totem/script/install-claude-seo
 */
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const REPO = 'https://github.com/AgriciDaniel/claude-seo.git'
const TAG = process.env.CLAUDE_SEO_TAG?.trim() || 'v2.6.2'
const home = homedir()
const checkout = join(home, '.local', 'share', 'dsh-totem', 'skills', 'claude-seo-src')
const destRoot = join(home, '.agents', 'skills')
const main = join(destRoot, 'seo')
const marker = join(main, '.claude-seo-install.json')

function run(argv: string[], cwd?: string): { code: number; out: string; err: string } {
  const result = Bun.spawnSync(argv, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'inherit',
    env: process.env,
  })
  return {
    code: result.exitCode ?? 1,
    out: result.stdout.toString(),
    err: result.stderr.toString(),
  }
}

function fail(message: string): never {
  console.error(`claude-seo install: ${message}`)
  process.exit(1)
}

/** Copy one directory tree, replacing the destination. */
function replace(source: string, target: string): void {
  rmSync(target, { recursive: true, force: true })
  cpSync(source, target, { recursive: true })
}

/** Rewrite Claude plugin-root tokens for this DSH layout. */
function rewriteDocs(root: string): void {
  const absoluteRoot = main.replaceAll('\\', '/')
  const skillsRoot = destRoot.replaceAll('\\', '/')
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const before = readFileSync(path, 'utf8')
      const rewritten = before
        .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/', `${skillsRoot}/`)
        .replaceAll('${CLAUDE_PLUGIN_ROOT}', absoluteRoot)
      const after = stripCommunityFooter(rewritten)
      if (after !== before) writeFileSync(path, after)
    }
  }
  walk(root)
}

/**
 * Drop the vendor's "append this footer to major deliverables" block.
 *
 * The upstream main skill tells the model to append a Skool community banner
 * after audits. That is promotional output, not SEO guidance, so an install
 * for this harness removes the instruction (and a bare banner block if a
 * future release moves it out of the section).
 */
function stripCommunityFooter(text: string): string {
  let next = text
  const start = next.indexOf('\n## Community Footer')
  if (start !== -1) {
    const end = next.indexOf('\n## ', start + 1)
    next = end === -1 ? next.slice(0, start) : `${next.slice(0, start)}\n${next.slice(end + 1)}`
  }
  return next.replace(/(?:^|\n)━+\nBuilt by agricidaniel\.[\s\S]*?\n━+\n?/gu, '\n')
}

// One managed shallow checkout keeps re-installs fast.
if (!existsSync(join(checkout, '.git'))) {
  mkdirSync(join(home, '.local', 'share', 'dsh-totem', 'skills'), { recursive: true })
  const clone = run(['git', 'clone', '--depth', '1', '--branch', TAG, REPO, checkout])
  if (clone.code !== 0) fail(`git clone failed: ${clone.err || clone.out}`)
} else {
  const fetch = run(['git', 'fetch', '--depth', '1', 'origin', `tag`, TAG], checkout)
  if (fetch.code === 0) {
    const pick = run(['git', 'checkout', '--detach', 'FETCH_HEAD'], checkout)
    if (pick.code !== 0) fail(`git checkout ${TAG} failed: ${pick.err || pick.out}`)
  } else {
    console.warn(`claude-seo install: using existing checkout (fetch failed: ${fetch.err.trim() || 'offline'})`)
  }
}

if (!existsSync(join(checkout, 'skills', 'seo', 'SKILL.md'))) {
  fail(`checkout has no skills/seo/SKILL.md: ${checkout}`)
}

mkdirSync(destRoot, { recursive: true })
// Refuse to clobber a different `seo` install unless it is one of ours.
if (existsSync(main) && !existsSync(marker)) {
  fail(`${main} already exists and is not a claude-seo install; move it first`)
}

for (const entry of readdirSync(join(checkout, 'skills'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  replace(join(checkout, 'skills', entry.name), join(destRoot, entry.name))
}

for (const name of ['scripts', 'schema', 'data', 'extensions']) {
  const source = join(checkout, name)
  if (existsSync(source)) replace(source, join(main, name))
}
mkdirSync(join(main, 'agents'), { recursive: true })
for (const entry of readdirSync(join(checkout, 'agents'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md')) {
    cpSync(join(checkout, 'agents', entry.name), join(main, 'agents', entry.name))
  }
}
for (const name of ['requirements.txt', 'pyproject.toml']) {
  cpSync(join(checkout, name), join(main, name))
}
cpSync(join(checkout, '.claude-plugin', 'plugin.json'), join(main, 'runtime-plugin.json'))
mkdirSync(join(main, '.claude-plugin'), { recursive: true })
cpSync(join(checkout, '.claude-plugin', 'plugin.json'), join(main, '.claude-plugin', 'plugin.json'))
chmodSync(join(main, 'scripts', 'claude-seo'), 0o755)

// Older manual installs put the 1.4 GB venv + Chromium inside the skill root.
// The plugin manifest moves them to a dedicated data directory instead.
for (const name of ['.venv', 'ms-playwright', 'runtime-state.json']) {
  rmSync(join(main, name), { recursive: true, force: true })
}

// The docs use `${CLAUDE_PLUGIN_ROOT}` for launchers and reference paths; DSH
// reads skill bodies directly, so make every token an absolute path.
for (const entry of readdirSync(destRoot, { withFileTypes: true })) {
  if (entry.isDirectory() && (entry.name === 'seo' || entry.name.startsWith('seo-'))) {
    rewriteDocs(join(destRoot, entry.name))
  }
}

const note = `

## DeepSeek Harness install

This copy is installed for DSH at \`${main}\`.
The Claude sub-agent prompts are in \`${main}/agents/*.md\`. When the
\`subagent\` tool is available, read the matching agent file and pass its body
as the child prompt; otherwise run the sub-skill inline.
`
const mainSkill = join(main, 'SKILL.md')
const body = readFileSync(mainSkill, 'utf8')
if (!body.includes('## DeepSeek Harness install')) {
  writeFileSync(mainSkill, body.trimEnd() + note)
}

const version = JSON.parse(readFileSync(join(main, 'runtime-plugin.json'), 'utf8')).version as string
writeFileSync(marker, JSON.stringify({ tag: TAG, version, installedAt: new Date().toISOString() }, null, 2))

console.log(`Installed claude-seo ${version} (${TAG}) to ${destRoot}`)

const setupArgs = [join(main, 'scripts', 'claude-seo'), 'setup']
if (process.argv.includes('--skip-browser')) setupArgs.push('--skip-browser')
const setup = Bun.spawnSync(setupArgs, { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit', env: process.env })
if ((setup.exitCode ?? 1) !== 0 && (setup.exitCode ?? 1) !== 10) {
  fail(`runtime setup failed with exit ${setup.exitCode ?? 1}`)
}

const doctor = run([join(main, 'scripts', 'claude-seo'), 'doctor', '--json'])
process.stdout.write(doctor.out)
if (doctor.code !== 0) {
  console.warn('claude-seo install: runtime is not ready; run the launcher setup again.')
}
