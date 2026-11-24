/**
 * Regenerate cordis.patch.yml from the installed DSH web presets.
 *
 * DSH mounts the file tools inside each agent preset, so a fork must override
 * every shipped preset row (a whole-row override, because preset child lists
 * are not addressable by patch id). This script reads the installed preset
 * patch files, swaps the `@deepseek-ai/dsh-tool-fs` row for
 * `dsh-totem/tool-fs`, and swaps the stock compaction backend for the Totem
 * backend, preserving every other line (including `!!js` expressions).
 *
 * Usage: bun run script/gen-patch.ts [globalsRoot]
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const PRESETS = ['standard', 'ptc', 'cordis', 'minimal'] as const

function globalRoot(): string {
  if (process.argv[2] !== undefined) return process.argv[2]
  const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
  return join(npmRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app/presets')
}

function overrideRow(source: string, preset: string): string {
  const lines = source.split('\n')
  const start = lines.findIndex(line => line.trim() === '- insert:')
  if (start < 0) throw new Error(`${preset}.patch.yml: no top-level insert`)
  const body = lines.slice(start + 1).map(line => line.startsWith('    ') ? line.slice(4) : line)
  const text = body.join('\n').replaceAll(
    "name: '@deepseek-ai/dsh-tool-fs'",
    "name: 'dsh-totem/tool-fs'",
  ).replaceAll(
    "name: '@deepseek-ai/dsh-compaction-basic'",
    "name: 'dsh-totem/compaction'",
  )
  if (!text.includes("name: 'dsh-totem/tool-fs'")) {
    throw new Error(`${preset}.patch.yml: no tool-fs row to replace`)
  }
  if (!text.includes("name: 'dsh-totem/compaction'")) {
    throw new Error(`${preset}.patch.yml: no compaction-basic row to replace`)
  }
  return text.trimEnd()
}

/**
 * Keep the profile-only MCP rows that live in the same top-level insert as the
 * Totem service. They are not part of a shipped preset, so regenerating from
 * presets alone would silently delete them.
 */
async function globalRows(): Promise<string> {
  try {
    const current = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    const lines = current.split('\n')
    const start = lines.findIndex(line => /^ {4}- id: mcp-/u.test(line))
    if (start < 0) return ''
    const rows: string[] = []
    for (let index = start; index < lines.length; index += 1) {
      if (/^- id: preset-/u.test(lines[index])) break
      rows.push(lines[index])
    }
    return rows.join('\n').trimEnd()
  } catch {
    return ''
  }
}

const extra = await globalRows()

const HEADER = `# dsh-totem bundle layer.
#
# 1. Replace the host file-tool row with the fork that requires a memory marker.
# 2. Mount the Totem service, native memory_* tools, workflow prompt, and digest.
# 3. Override each shipped Web agent preset so its scoped file tools are the fork
#    and its native compaction backend writes through Totem's memory model.
#
# The preset section is generated from the installed @deepseek-ai/dsh-web-app by
# script/gen-patch.ts. Regenerate it after upgrading DSH.

- id: tool-fs
  disabled: true

- insert:
    - id: tool-fs-totem
      name: dsh-totem/tool-fs
      config:
        applyPatch: true

    - id: totem
      name: dsh-totem
      config:
        command: totem-mcp
        args: []
        provider: ''
        model: ''
        readRegister: true
        autoRegister: true
        distill: true
        digest: true
        maxTokens: 512
        maxInputBytes: 24000
        timeoutMs: 15000
        debug: false

    # Research and browser MCP servers
    # One research pipeline, not a pile of search MCPs:
    #   searxncrawl  discovery + page/site Markdown extraction (SearXNG)
    #   cluefinch    chunked full-text reading + link navigation + collection
    #   playwright   deterministic Chromium control for JS/auth pages
    #   browser-use  agentic browsing via a Python REPL against a live browser
    #
    # The search servers need SearXNG with the JSON API enabled. Start the
    # bundled instance with docker compose up -d in deploy/searxng, or point
    # SEARXNG_URL / MCP_SEARCH_SEARXNG_URL at a remote instance (for example
    # one hosted on solsticio). uvx and npx must be on the Host PATH.
    # Browser servers need Chromium: bun run research:setup installs it.

${extra}
`

const root = globalRoot()
const rows = await Promise.all(PRESETS.map(async (preset) => {
  const source = await readFile(join(root, `${preset}.patch.yml`), 'utf8')
  return overrideRow(source, preset)
}))

const output = `${HEADER}\n${rows.join('\n\n')}\n`
await writeFile(new URL('../cordis.patch.yml', import.meta.url), output)
console.log(`wrote cordis.patch.yml with ${rows.length} preset overrides from ${root}`)
