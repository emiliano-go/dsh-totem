/**
 * Make assistant "Think" rows expanded by default in the installed dsh web client.
 *
 * dsh's chat client starts every disclosure collapsed. This patch adds an
 * `initiallyOpen` argument to the shared disclosure hook and passes it only
 * from ReasoningRow, leaving tool/process disclosures unchanged. It edits the
 * installed `@deepseek-ai/dsh-client-ui-chat/lib/client.js` because the row
 * component is not exposed through a replaceable slot.
 *
 * Idempotent. A dsh upgrade/reinstall overwrites the file, so rerun this after
 * upgrading. Usage: bun run script/patch-think-default.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const file = join(npmRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js')
if (!existsSync(file)) {
  console.error(`not found: ${file}`)
  process.exit(1)
}
const source = readFileSync(file, 'utf8')
if (source.includes('useDisclosure(true)')) {
  console.log('already patched')
  process.exit(0)
}
const replacements: [string, string][] = [
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
]
let next = source
for (const [before, after] of replacements) {
  if (!next.includes(before)) {
    console.error(`patch anchor missing (dsh client changed?): ${before.slice(0, 60)}...`)
    process.exit(1)
  }
  next = next.replace(before, after)
}
const backup = `${file}.bak-totem`
if (!existsSync(backup)) writeFileSync(backup, source)
writeFileSync(file, next)
console.log(`patched ${file}`)
