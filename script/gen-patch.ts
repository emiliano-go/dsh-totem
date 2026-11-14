/**
 * Regenerate cordis.patch.yml from the installed DSH web presets.
 *
 * DSH mounts the file tools inside each agent preset, so a fork must override
 * every shipped preset row (a whole-row override, because preset child lists
 * are not addressable by patch id). This script reads the installed preset
 * patch files and swaps the `@deepseek-ai/dsh-tool-fs` row for
 * `dsh-totem/tool-fs`, preserving every other line (including `!!js` expressions).
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
  )
  if (!text.includes("name: 'dsh-totem/tool-fs'")) {
    throw new Error(`${preset}.patch.yml: no tool-fs row to replace`)
  }
  return text.trimEnd()
}

const HEADER = `# dsh-totem bundle layer.
#
# 1. Replace the host file-tool row with the fork that requires a memory marker.
# 2. Mount the Totem service, native memory_* tools, workflow prompt, and digest.
# 3. Override each shipped Web agent preset so its scoped file tools are the fork.
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
`

const root = globalRoot()
const rows = await Promise.all(PRESETS.map(async (preset) => {
  const source = await readFile(join(root, `${preset}.patch.yml`), 'utf8')
  return overrideRow(source, preset)
}))

const output = `${HEADER}\n${rows.join('\n\n')}\n`
await writeFile(new URL('../cordis.patch.yml', import.meta.url), output)
console.log(`wrote cordis.patch.yml with ${rows.length} preset overrides from ${root}`)
