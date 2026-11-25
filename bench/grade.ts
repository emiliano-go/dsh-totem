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
const proc = Bun.spawn(['bash', '-lc', `cd ${quote(resolved)} && bun test ${quote(`${problemDir}tests`)}`], {
  env: { ...process.env, STORE_ENTRY: entry },
  stdout: 'pipe',
  stderr: 'pipe',
})
const [stdout, stderr] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
])
const exitCode = await proc.exited
const tail = `${stdout}\n${stderr}`.trim().split('\n').slice(-12).join('\n')
console.log(JSON.stringify({
  problem,
  solution: entry,
  pass: exitCode === 0,
  exitCode,
  tail,
}, null, 2))
process.exit(exitCode === 0 ? 0 : 1)
