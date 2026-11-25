const entry = process.env.STORE_ENTRY
const dir = process.argv[2] ?? ''
const count = Number(process.argv[3] ?? 100_000)
if (entry === undefined) throw new Error('STORE_ENTRY is required')

const { openStore } = await import(entry)
const store = await openStore(dir)
const durations: number[] = []
const loopStart = performance.now()

for (let index = 0; index < count; index += 1) {
  const started = performance.now()
  await store.put(`k${index}`, JSON.stringify({ index, pad: 'x'.repeat(64) }))
  durations.push(performance.now() - started)
  process.stdout.write(`ACK k${index}\n`)
}
await store.close()
const total = performance.now() - loopStart
durations.sort((a, b) => a - b)
const p99 = durations.length === 0 ? 0 : durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.99))]!
process.stdout.write(`RESULT ${JSON.stringify({
  puts: durations.length,
  p99_ms: Number(p99.toFixed(3)),
  duration_ms: Number(total.toFixed(1)),
  puts_per_second: Number((durations.length / (total / 1000)).toFixed(1)),
})}\n`)
