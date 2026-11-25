import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ENTRY = process.env.STORE_ENTRY
const HERE = import.meta.dir
const TARGETS = JSON.parse(process.env.BENCH_TARGETS ?? '{}') as {
  durable_write_p99_ms: number
  reopen_after_1mib_ms: number
  torn_records: number
  min_puts_per_second: number
}


const work = mkdtempSync(join(tmpdir(), 'crash-store-'))
const runs: { killed: number; acked: number; missing: number; reopenMs: number; error?: string }[] = []

const quote = (value: string): string => `'${value.replace(/'/gu, `'\\''`)}'`

function spawnBash(command: string) {
  return Bun.spawn(['bash', '-lc', command], {
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

function spawnWriter(dir: string, count: number) {
  return spawnBash(`bun ${quote(join(HERE, 'writer.ts'))} ${quote(dir)} ${count}`)
}

function spawnVerify(dir: string, ackedFile: string) {
  return spawnBash(`bun ${quote(join(HERE, 'verify.ts'))} ${quote(dir)} ${quote(ackedFile)}`)
}

// Skipped unless the grader supplies the module under test, so a plain `bun test`
// over the repository stays green.
(ENTRY === undefined ? describe.skip : describe)('crash-safe store', () => {
  test('an acknowledged write survives an immediate kill -9 and nothing is torn', async () => {
    for (let round = 0; round < 3; round += 1) {
      const dir = join(work, `run-${round}`)
      mkdirSync(dir, { recursive: true })
      const proc = spawnWriter(dir, 200_000)
      let acked = ''
      const reader = (async () => {
        const decoder = proc.stdout.getReader()
        for (;;) {
          const { done, value } = await decoder.read()
          if (done) break
          acked += new TextDecoder().decode(value)
        }
      })()
      await Bun.sleep(150 + round * 120)
      proc.kill('SIGKILL')
      await proc.exited
      await reader

      const keys = acked.split('\n').filter(line => line.startsWith('ACK ')).map(line => line.slice(4))
      const ackedFile = join(work, `acked-${round}.txt`)
      writeFileSync(ackedFile, keys.join('\n'))
      const verify = spawnVerify(dir, ackedFile)
      const output = await new Response(verify.stdout).text()
      await verify.exited
      const line = output.split('\n').find(entry => entry.startsWith('RESULT '))
      if (line === undefined) throw new Error(`no RESULT from verify: ${await new Response(verify.stderr).text()}`)
      const result = JSON.parse((line as string).slice('RESULT '.length)) as { acked: number; missing: number; reopen_ms: number; error?: string }
      runs.push({ killed: keys.length, acked: result.acked, missing: result.missing, reopenMs: result.reopen_ms, ...result.error === undefined ? {} : { error: result.error } })

      expect(result.error).toBeUndefined()
      expect(result.missing).toBe(TARGETS.torn_records)
      expect(result.acked).toBeGreaterThan(0)
    }
  }, 120_000)

  test('durable write latency and reopen time stay inside the pre-registered targets', async () => {
    const dir = join(work, 'latency')
    mkdirSync(dir, { recursive: true })
    const writer = spawnWriter(dir, 5_000)
    const output = await new Response(writer.stdout).text()
    await writer.exited
    const line = output.split('\n').find(entry => entry.startsWith('RESULT '))
    if (line === undefined) throw new Error(`no RESULT from writer: ${await new Response(writer.stderr).text()}`)
    const result = JSON.parse((line as string).slice('RESULT '.length)) as {
      puts: number
      p99_ms: number
      puts_per_second: number
    }
    expect(result.puts).toBe(5_000)
    expect(result.p99_ms).toBeLessThanOrEqual(TARGETS.durable_write_p99_ms)
    expect(result.puts_per_second).toBeGreaterThanOrEqual(TARGETS.min_puts_per_second)

    const ackedFile = join(work, 'acked-latency.txt')
    writeFileSync(ackedFile, Array.from({ length: 5_000 }, (_, index) => `k${index}`).join('\n'))
    const verify = spawnVerify(dir, ackedFile)
    const verifyOut = await new Response(verify.stdout).text()
    await verify.exited
    const verifyLine = verifyOut.split('\n').find(entry => entry.startsWith('RESULT '))
    expect(verifyLine).toBeDefined()
    const reopen = JSON.parse((verifyLine as string).slice('RESULT '.length)) as { missing: number; reopen_ms: number }
    expect(reopen.missing).toBe(0)
    expect(reopen.reopen_ms).toBeLessThanOrEqual(TARGETS.reopen_after_1mib_ms)
  }, 120_000)
})
