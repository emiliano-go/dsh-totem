// Child process for the crash harness: writes until SIGKILL, acknowledging each
// operation on stdout only after openStore's put/delete has resolved.
const entry = process.env.STORE_ENTRY
const dir = process.argv[2] ?? ''
if (entry === undefined) throw new Error('STORE_ENTRY is required')
const { openStore } = await import(entry)
const store = await openStore(dir)
const out = (line: string) => { process.stdout.write(`${line}\n`) }
const pad = 'x'.repeat(96)
let index = 0
for (;;) {
  await store.put(`k${index}`, JSON.stringify({ index, pad }))
  out(`PUT k${index}`)
  if (index > 0 && index % 3 === 0) {
    const victim = `k${index - 1}`
    await store.delete(victim)
    out(`DEL ${victim}`)
  }
  index += 1
}
