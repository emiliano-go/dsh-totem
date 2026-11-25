/**
 * Lay out one arm's working directory: the brief and the spec only, so the arm
 * has no reason to browse the repository for the tests it is graded against.
 *
 * Usage: bun run bench/prepare-run.ts --problem 03-retrieval-index --arm a
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}

const problem = flag('problem')
const arm = flag('arm')
if (problem === undefined || arm === undefined) {
  console.error('usage: bun run bench/prepare-run.ts --problem <id> --arm <a|b>')
  process.exit(2)
}

const root = resolve(import.meta.dir)
const problemDir = join(root, 'problems', problem)
const existing = readdirSync(join(root, 'runs'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.startsWith(problem.slice(0, 2)))
  .map(entry => entry.name)
const runName = `${problem.slice(0, 2)}-${arm}`
const runDir = join(root, 'runs', runName)
mkdirSync(runDir, { recursive: true })

const brief = join(root, 'harness', `arm-${arm}-${problem.slice(0, 2)}.md`)
const briefSource = existsSync(brief) ? brief : join(root, 'harness', `arm-${arm}.md`)
copyFileSync(briefSource, join(runDir, 'brief.md'))
copyFileSync(join(problemDir, 'spec.md'), join(runDir, 'spec.md'))

const entry = problem.startsWith('03') ? 'index.ts' : 'store.ts'
writeFileSync(join(runDir, 'README.md'), [
  `# ${runName}`,
  '',
  'Read `brief.md` and `spec.md`. The deliverable is',
  `\`${entry}\` in this directory.`,
  '',
  'Everything needed is here. Do not read the benchmark tests or the grading',
  'thresholds; they are not part of the brief.',
  '',
].join('\n'))

console.log(JSON.stringify({ runDir, entry, brief: briefSource, otherRuns: existing.length }))
