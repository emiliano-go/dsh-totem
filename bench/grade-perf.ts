/**
 * Grade a performance task: measure the workload, then run the project's tests.
 *
 * Usage: bun run bench/grade-perf.ts --problem 07-perf-optimization [--repo <dir>]
 */
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}
const problem = flag('problem') ?? '07-perf-optimization'
const root = resolve(import.meta.dir)
const config = JSON.parse(await Bun.file(`${root}/grading/${problem}.json`).text()) as {
  repo: string
  python: string
  workload: string
  baseline_mean_s: number
  min_speedup: number
  tests: string[]
}
const repo = resolve(flag('repo') ?? `${root}/${config.repo.replace(/^bench\//u, '')}`)

const means: number[] = []
for (let run = 0; run < 3; run += 1) {
  const proc = Bun.spawn([config.python, resolve(config.workload)], { cwd: repo, stdout: 'pipe', stderr: 'pipe' })
  const out = await new Response(proc.stdout).text()
  await proc.exited
  const match = /Mean:\s*([0-9.]+)/u.exec(out)
  if (match !== null) means.push(Number(match[1]))
}
if (means.length === 0) {
  console.log(JSON.stringify({ problem, pass: false, reason: 'workload produced no timing' }, null, 2))
  process.exit(1)
}
means.sort((a, b) => a - b)
const median = means[Math.floor(means.length / 2)] as number
const speedup = config.baseline_mean_s / median

const test = Bun.spawn([config.python, '-m', 'pytest', '-q', ...config.tests], { cwd: repo, stdout: 'pipe', stderr: 'pipe' })
const testOut = await new Response(test.stdout).text()
const testErr = await new Response(test.stderr).text()
const testCode = await test.exited

const pass = testCode === 0 && speedup >= config.min_speedup
console.log(JSON.stringify({
  problem,
  repo,
  median_s: Number(median.toFixed(4)),
  baseline_s: config.baseline_mean_s,
  speedup: Number(speedup.toFixed(3)),
  min_speedup: config.min_speedup,
  tests_pass: testCode === 0,
  pass,
  tail: `${testOut}\n${testErr}`.trim().split('\n').slice(-4).join('\n'),
}, null, 2))
process.exit(pass ? 0 : 1)
