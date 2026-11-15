/**
 * Open selected rows by default in the installed dsh web client.
 *
 * - Reasoning ("Think") rows start expanded.
 * - Bash/PowerShell and file mutation (write/edit/apply_patch) rows start
 *   expanded so the command and the changed text are visible immediately.
 *
 * dsh starts every disclosure collapsed. The shared disclosure hook accepts an
 * `initiallyOpen` argument after this patch; only the rows above pass it.
 * These components are not exposed through replaceable slots, so the installed
 * package bundles are edited directly.
 *
 * Idempotent. A dsh upgrade/reinstall overwrites the files, so rerun this after
 * upgrading. Usage: bun run script/patch-think-default.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const dshModules = join(npmRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai')

function patch(file: string, replacements: [string, string][], done: (source: string) => boolean): void {
  if (!existsSync(file)) {
    console.error(`not found: ${file}`)
    process.exit(1)
  }
  const source = readFileSync(file, 'utf8')
  if (done(source)) {
    console.log(`already patched: ${file}`)
    return
  }
  let next = source
  for (const [before, after] of replacements) {
    if (!next.includes(before)) {
      console.error(`patch anchor missing in ${file} (dsh client changed?): ${before.slice(0, 60)}...`)
      process.exit(1)
    }
    next = next.replace(before, after)
  }
  const backup = `${file}.bak-totem`
  if (!existsSync(backup)) writeFileSync(backup, source)
  writeFileSync(file, next)
  console.log(`patched ${file}`)
}

const chat = join(dshModules, 'dsh-client-ui-chat/lib/client.js')
patch(chat, [
  [
    '\t\tfunction useDisclosure(version = 0) {\n\t\t\tconst [expandedVersion, setExpandedVersion] = (0, react.useState)(null);',
    '\t\tfunction useDisclosure(version = 0, initiallyOpen = false) {\n\t\t\tconst [expandedVersion, setExpandedVersion] = (0, react.useState)(() => initiallyOpen ? version : null);',
  ],
  [
    '\t\t\treturn function useBoundDisclosure() {\n\t\t\t\treturn useDisclosure((0, react.useSyncExternalStore)(subscribe, getSnapshot));\n\t\t\t};',
    '\t\t\treturn function useBoundDisclosure(initiallyOpen = false) {\n\t\t\t\treturn useDisclosure((0, react.useSyncExternalStore)(subscribe, getSnapshot), initiallyOpen);\n\t\t\t};',
  ],
  [
    'const { expanded, toggle } = useDisclosure();',
    'const { expanded, toggle } = useDisclosure(true);',
  ],
], source => source.includes('function useDisclosure(version = 0, initiallyOpen = false)')
  && source.includes('const { expanded, toggle } = useDisclosure(true);'))

const tool = join(dshModules, 'dsh-client-ui-tool/lib/client.js')
patch(tool, [
  [
    'const { expanded, toggle: toggleExpand } = useDisclosure();',
    'const { expanded, toggle: toggleExpand } = useDisclosure(toolName === "bash" || toolName === "pwsh" || toolName === "write" || toolName === "edit" || toolName === "apply_patch");',
  ],
], source => source.includes('const { expanded, toggle: toggleExpand } = useDisclosure(toolName ==='))
