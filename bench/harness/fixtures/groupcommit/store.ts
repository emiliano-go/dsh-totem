// Group commit: append to an open handle, fsync in batches, and only then
// resolve the puts that were batched with it.
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'

const BATCH = 16

export async function openStore(path: string) {
  const file = join(path, 'log.ndjson')
  const data = new Map<string, string>()
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.length === 0) continue
      const record = JSON.parse(line) as { op: string; key: string; value?: string }
      if (record.op === 'put' && record.value !== undefined) data.set(record.key, record.value)
      else if (record.op === 'del') data.delete(record.key)
    }
  } catch {}
  const fd = openSync(file, 'a')
  let waiting: (() => void)[] = []
  const flush = (): void => {
    fsyncSync(fd)
    const release = waiting
    waiting = []
    for (const resolve of release) resolve()
  }
  return {
    put(key: string, value: string): Promise<void> {
      data.set(key, value)
      writeSync(fd, `${JSON.stringify({ op: 'put', key, value })}\n`)
      return new Promise<void>(resolve => {
        waiting.push(resolve)
        if (waiting.length >= BATCH) flush()
      })
    },
    get(key: string): string | undefined { return data.get(key) },
    delete(key: string): Promise<void> {
      data.delete(key)
      writeSync(fd, `${JSON.stringify({ op: 'del', key })}\n`)
      return new Promise<void>(resolve => {
        waiting.push(resolve)
        if (waiting.length >= BATCH) flush()
      })
    },
    close(): void { if (waiting.length > 0) flush(); closeSync(fd) },
  }
}
