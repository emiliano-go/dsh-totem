import { readFileSync } from 'node:fs'

const entry = process.env.STORE_ENTRY
const dir = process.argv[2] ?? ''
const expected = process.argv[3] ?? ''
if (entry === undefined) throw new Error('STORE_ENTRY is required')

const acked = readFileSync(expected, 'utf8').split('\n').filter(line => line.length > 0)
const started = performance.now()
let missing = 0
let error: string | undefined
let opened = 0
try {
  const { openStore } = await import(entry)
  const store = await openStore(dir)
  opened = performance.now() - started
  for (const key of acked) {
    if (store.get(key) === undefined) missing += 1
  }
  await store.close()
} catch (cause) {
  error = (cause as Error)?.message ?? String(cause)
}
process.stdout.write(`RESULT ${JSON.stringify({
  acked: acked.length,
  missing,
  reopen_ms: Number(opened.toFixed(3)),
  error,
})}\n`)
