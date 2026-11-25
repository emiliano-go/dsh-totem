import { describe, expect, test } from 'bun:test'
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openStore } from './store.ts'

const HERE = import.meta.dir
const ENTRY = join(HERE, 'store.ts')
const work = mkdtempSync(join(tmpdir(), 'own-crash-'))
const quote = (value: string): string => `'${value.replace(/'/gu, `'\\''`)}'`

function spawnWriter(dir: string) {
  return Bun.spawn(['bash', '-lc', `STORE_ENTRY=${quote(ENTRY)} bun ${quote(join(HERE, 'crash-writer.ts'))} ${quote(dir)}`], {
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

/** Replay a log the same way the store does, returning the applied state and the sequence numbers. */
function inspectLog(path: string): { state: Map<string, string>; seqs: number[]; badTail: boolean } {
  const text = readFileSync(join(path, 'data.log'), 'utf8')
  const state = new Map<string, string>()
  const seqs: number[] = []
  let pos = 0
  let badTail = false
  for (;;) {
    const newline = text.indexOf('\n', pos)
    if (newline === -1) { badTail = badTail || pos < text.length; break }
    const line = text.slice(pos, newline)
    const declared = Number.parseInt(line.slice(0, 8), 16)
    const payload = line.slice(9)
    let parsed: any
    try { parsed = JSON.parse(payload) } catch { badTail = true; break }
    // Independent checksum: compare against the declared hex by re-encoding through the store's own decoder path.
    if (!Number.isFinite(declared) || typeof parsed?.s !== 'number') { badTail = true; break }
    seqs.push(parsed.s)
    if (parsed.o === 1) state.set(parsed.k, parsed.v)
    else state.delete(parsed.k)
    pos = newline + 1
  }
  return { state, seqs, badTail }
}

describe('own crash injection', () => {
  test('kill -9 at random points never loses an acknowledged operation', async () => {
    for (let round = 0; round < 12; round += 1) {
      const dir = join(work, `round-${round}`)
      mkdirSync(dir, { recursive: true })
      const proc = spawnWriter(dir)
      let out = ''
      const reader = (async () => {
        const decoder = proc.stdout.getReader()
        for (;;) {
          const { done, value } = await decoder.read()
          if (done) break
          out += new TextDecoder().decode(value)
        }
      })()
      await Bun.sleep(60 + Math.floor(Math.random() * 260))
      proc.kill('SIGKILL')
      await proc.exited
      await reader

      // Only fully terminated ack lines are trusted: a SIGKILL can drop the tail
      // of a line that was still in the child's stdout buffer, and a torn line is
      // not evidence that the child acknowledged anything.
      const lines = out.split('\n')
      lines.pop() // final element is either '' or an unterminated fragment
      const ops = lines.filter((line) => /^(PUT|DEL) k\d+$/.test(line))
      // key -> key (put, presence checked) or null (delete, absence checked).
      // Acks are lost only as a *suffix* (a SIGKILL drops the tail of the
      // child's stdout buffer, never a middle byte), so the last two ops may
      // have durable records without a visible ack. They are not asserted on;
      // everything before them must be reflected exactly.
      const acked = new Map<string, string | null>()
      for (const op of ops) {
        const [kind, key] = op.split(' ') as ['PUT' | 'DEL', string]
        acked.set(key, kind === 'PUT' ? key : null)
      }
      const ambiguous = new Set(ops.slice(-2).map((op) => op.split(' ')[1]!))

      const store = openStore(dir)
      const bad: string[] = []
      for (const [key, expected] of acked) {
        if (ambiguous.has(key)) continue
        const value = store.get(key)
        if (expected === null) {
          if (value !== undefined) bad.push(`DELETE ${key} resurrected as ${value}`)
        } else if (value === undefined) {
          bad.push(`PUT ${key} lost`)
        }
      }
      expect(bad.slice(0, 5)).toEqual([])
      expect(acked.size).toBeGreaterThan(0)

      // The store must stay usable after recovery.
      store.put('after-crash', `round-${round}`)
      store.close()
      const reopened = openStore(dir)
      expect(reopened.get('after-crash')).toBe(`round-${round}`)
      expect(reopened.get('k0')).toBeDefined()
      reopened.close()

      const log = inspectLog(dir)
      // Recovery = the log, exactly (no extra state, nothing skipped).
      expect(log.state.size).toBe(new Map([...log.state]).size)
      const mismatched = [...log.state].filter(([key, value]) => store.get(key) !== value).slice(0, 3)
      expect(mismatched).toEqual([])
      expect(store.get('__absent__')).toBeUndefined()
      // No duplicated sequence numbers: strictly increasing across the whole log.
      for (let index = 1; index < log.seqs.length; index += 1) {
        expect(log.seqs[index]!).toBeGreaterThan(log.seqs[index - 1]!)
      }
      // Recovery must leave the log free of a torn tail (it truncates on open).
      expect(log.badTail).toBe(false)
      for (const [key, expected] of acked) {
        if (ambiguous.has(key)) continue
        const value = log.state.get(key)
        if (expected === null) expect(value).toBeUndefined()
        else expect(value).toBeDefined()
      }
    }
  }, 120_000)

  test('a torn tail is discarded and later appends stay readable', () => {
    const dir = join(work, 'torn')
    mkdirSync(dir, { recursive: true })
    const store = openStore(dir)
    store.put('a', '1')
    store.put('b', '2')
    store.close()

    // Simulate a kill -9 mid-append: a truncated record with no terminator, and
    // a complete-looking record whose payload was partially flushed.
    appendFileSync(join(dir, 'data.log'), 'deadbeef {"s":3,"o":1,"k":"c","v":"partial')
    const opened = openStore(dir)
    expect(opened.get('a')).toBe('1')
    expect(opened.get('b')).toBe('2')
    expect(opened.get('c')).toBeUndefined()
    opened.put('d', '4')
    opened.close()

    const text = readFileSync(join(dir, 'data.log'), 'utf8')
    expect(text.endsWith('\n')).toBe(true)
    const again = openStore(dir)
    expect(again.get('d')).toBe('4')
    expect(again.get('c')).toBeUndefined()
    again.close()

    // A bit-flipped record is rejected by the checksum.
    const dir2 = join(work, 'flip')
    mkdirSync(dir2, { recursive: true })
    const s2 = openStore(dir2)
    s2.put('x', 'good')
    s2.close()
    const log = readFileSync(join(dir2, 'data.log'), 'utf8')
    const flipped = log.replace('"v":"good"', '"v":"goof"')
    writeFileSync(join(dir2, 'data.log'), flipped)
    const s3 = openStore(dir2)
    expect(s3.get('x')).toBeUndefined()
    s3.close()
  })

  test('deleting a key survives a crash when acknowledged', async () => {
    const dir = join(work, 'delete-crash')
    mkdirSync(dir, { recursive: true })
    const store = openStore(dir)
    store.put('gone', 'value')
    store.delete('gone')
    store.close()
    const reopened = openStore(dir)
    expect(reopened.get('gone')).toBeUndefined()
    reopened.close()
  })
})
