// Reference design: append-only log, fsync per acknowledged write, replay on open.
import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'

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
  } catch {
    // Empty log.
  }
  const fd = openSync(file, 'a')
  const append = (record: unknown): void => {
    writeSync(fd, `${JSON.stringify(record)}\n`)
    fsyncSync(fd)
  }
  return {
    put(key: string, value: string): void { data.set(key, value); append({ op: 'put', key, value }) },
    get(key: string): string | undefined { return data.get(key) },
    delete(key: string): void { data.delete(key); append({ op: 'del', key }) },
    close(): void { closeSync(fd) },
  }
}
