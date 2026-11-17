#!/usr/bin/env bun
/**
 * Install the research stack the bundle wires in `cordis.patch.yml`.
 *
 * Three moving parts:
 *   1. SearXNG with the JSON API enabled (Docker, loopback only).
 *   2. Chromium for the Playwright MCP server and for browser-use.
 *   3. Warm the `uvx`/`npx` caches so the first MCP connection does not race
 *      a multi-hundred-megabyte download against the startup retry budget.
 *
 * Idempotent: running it again only performs the missing steps. Pass
 * `--no-browsers` to prepare search only, or set SEARXNG_URL to use an
 * instance hosted elsewhere (the Docker step is skipped for a remote URL).
 *
 * @module dsh-totem/script/research-setup
 */
import { existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const root = join(import.meta.dir, '..')
const deployDir = join(root, 'deploy', 'searxng')
const searxngUrl = (process.env.SEARXNG_URL ?? 'http://127.0.0.1:8888').replace(/\/$/u, '')
const withBrowsers = !process.argv.includes('--no-browsers')

interface RunOptions {
  cwd?: string
  allowFailure?: boolean
  stdin?: 'inherit' | 'ignore'
}

function run(command: string, args: string[], options: RunOptions = {}): number {
  const result = Bun.spawnSync([command, ...args], {
    cwd: options.cwd ?? root,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: options.stdin ?? 'inherit',
  })
  const code = result.exitCode ?? 1
  if (code !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${args.join(' ')} exited ${code}`)
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

async function waitForSearxng(url: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let last = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/search?q=searxng&format=json`, { signal: AbortSignal.timeout(10_000) })
      if (response.ok) {
        const body = await response.json() as { results?: unknown[] }
        if (Array.isArray(body.results) && body.results.length > 0) {
          console.log(`  SearXNG answered with ${body.results.length} results`)
          return
        }
        last = 'JSON API returned no results (engines may still be warming up)'
      } else {
        last = `HTTP ${response.status}`
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    await Bun.sleep(2000)
  }
  throw new Error(`SearXNG at ${url} did not become ready: ${last}`)
}

async function main(): Promise<void> {
  for (const command of ['docker', 'uvx', 'npx']) {
    if (!have(command)) throw new Error(`missing required command: ${command}`)
  }

  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(searxngUrl)
  if (local) {
    log('SearXNG (Docker)')
    const envFile = join(deployDir, '.env')
    if (!existsSync(envFile)) {
      writeFileSync(envFile, `SEARXNG_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 })
      console.log(`  wrote ${envFile}`)
    }
    // `--wait` is absent from old Compose releases; fall back to a plain up and
    // let the health poll below decide readiness either way.
    const started = run('docker', ['compose', 'up', '-d', '--wait'], { cwd: deployDir, allowFailure: true })
    if (started !== 0) run('docker', ['compose', 'up', '-d'], { cwd: deployDir })
  } else {
    log(`SearXNG (remote: ${searxngUrl})`)
  }
  await waitForSearxng(searxngUrl)

  log('Warming uvx caches (searxncrawl, cluefinch, browser-use)')
  for (const args of [
    ['searxncrawl'],
    ['--from', 'cluefinch', 'cluefinch'],
    ['--from', 'browser-use[cli]', 'browser-use', '--version'],
  ]) {
    run('uvx', args, { stdin: 'ignore', allowFailure: true })
  }

  if (withBrowsers) {
    log('Chromium for the Playwright MCP server')
    // Install through the MCP package itself: it pins the exact Chromium
    // revision its bundled playwright-core expects. A plain
    // `playwright install chromium` may fetch a newer revision and leave the
    // server looking for a browser that does not exist.
    run('npx', ['-y', '@playwright/mcp@latest', 'install-browser', 'chromium'], { allowFailure: true })

    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), '.cache', 'ms-playwright')
    if (!existsSync(cache)) {
      console.warn(`  warning: no Playwright browser cache at ${cache}; the first browser launch may download Chromium`)
    }

    // browser-use drives the system Chrome/Chromium when one is installed and
    // otherwise fetches its own build with `browser-use install` (which asks
    // sudo for Linux system dependencies). Do not run that here: the download
    // is large and the sudo prompt makes the script non-interactive-hostile.
    if (!have('chromium') && !have('google-chrome') && !have('google-chrome-stable')) {
      console.warn('  warning: no system Chrome/Chromium found; run `uvx --from "browser-use[cli]" browser-use install` once if browser-use cannot start a browser')
    }
  }

  log('Next steps')
  console.log(`  SearXNG URL: ${searxngUrl}`)
  console.log('  The bundle wires these servers on the next DSH start:')
  console.log('    mcp__searxncrawl__{search,crawl,crawl_site}')
  console.log('    mcp__cluefinch__{web_search,web_fetch,web_links,research_collect}')
  console.log('    mcp__playwright__browser_*')
  console.log('    mcp__browser-use__browser_exec')
  console.log('  Restart the profile (or let cordis.patch.yml reload), then run:')
  console.log('    bun run research:verify')
}

try {
  await main()
} catch (error) {
  console.error(`\nresearch setup failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
