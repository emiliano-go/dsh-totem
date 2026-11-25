/**
 * Grade a repository task: copy the hidden tests into the candidate's checkout
 * and run the command from the problem's grading file.
 *
 * Usage: bun run bench/grade-repo.ts --problem 05-issue-fix --solution <dir>
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}
const problem = flag('problem')
const solution = flag('solution')
if (problem === undefined || solution === undefined) {
  console.error('usage: bun run bench/grade-repo.ts --problem <id> --solution <dir>')
  process.exit(2)
}

const root = resolve(import.meta.dir)
const config = JSON.parse(await Bun.file(join(root, 'grading', `${problem}.json`)).text()) as {
  hiddenTests: string[]
  command: string
}
const target = resolve(solution)
// Copy in, run, remove: a hidden suite left behind is a hidden suite the next
// arm can read and run, which is exactly what happened once.
mkdirSync(join(target, 'test'), { recursive: true })
const planted = config.hiddenTests.map(file => join(target, 'test', file.split('/').pop() as string))
for (const [index, file] of config.hiddenTests.entries()) {
  copyFileSync(join(root, 'problems', problem, file), planted[index] as string)
}

const proc = Bun.spawn(['bash', '-lc', `cd '${target}' && ${config.command}`], {
  env: { ...process.env },
  stdout: 'pipe',
  stderr: 'pipe',
})
const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
const exitCode = await proc.exited
for (const file of planted) rmSync(file, { force: true })
console.log(JSON.stringify({
  problem,
  solution: target,
  pass: exitCode === 0,
  exitCode,
  tail: `${stdout}\n${stderr}`.trim().split('\n').slice(-10).join('\n'),
}, null, 2))
process.exit(exitCode === 0 ? 0 : 1)
