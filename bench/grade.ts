import { resolve } from 'node:path'

/**
 * Grade one arm's solution against a problem's hidden suite.
 *
 * Usage: bun run bench/grade.ts --problem 01-crash-safe-store --solution <dir>
 */
const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}

const problem = flag('problem')
const solution = flag('solution')
if (problem === undefined || solution === undefined) {
  console.error('usage: bun run bench/grade.ts --problem <id> --solution <dir>')
  process.exit(2)
}

const problemDir = new URL(`./problems/${problem}/`, import.meta.url).pathname
const resolved = resolve(solution)
const entry = `${resolved.replace(/\/+$/u, '')}/store.ts`

const quote = (value: string): string => `'${value.replace(/'/gu, `'\\''`)}'`

// Each test file runs in its own process: a suite that mocks node:fs must not
// leak that mock into the suite that measures the real disk.
const suiteDir = `${problemDir}tests`
const files = (await Array.fromAsync(new Bun.Glob('*.test.ts').scan(suiteDir))).sort()
const results: { file: string; pass: boolean; tail: string }[] = []
for (const file of files) {
  const proc = Bun.spawn(['bash', '-lc', `cd ${quote(resolved)} && bun test ${quote(`${suiteDir}/${file}`)}`], {
    env: { ...process.env, STORE_ENTRY: entry },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const exitCode = await proc.exited
  results.push({
    file,
    pass: exitCode === 0,
    tail: `${stdout}\n${stderr}`.trim().split('\n').slice(-6).join('\n'),
  })
}
const failed = results.filter(result => !result.pass)
const tail = failed.length === 0
  ? results.map(result => `${result.file}: pass`).join('\n')
  : failed.map(result => `${result.file}:\n${result.tail}`).join('\n\n')
const exitCode = failed.length === 0 ? 0 : 1
console.log(JSON.stringify({
  problem,
  solution: entry,
  pass: exitCode === 0,
  exitCode,
  files: results.map(result => ({ file: result.file, pass: result.pass })),
  tail,
}, null, 2))
process.exit(exitCode === 0 ? 0 : 1)
