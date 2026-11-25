// Deliberately weak reference: one JSON file rewritten on every put, no fsync.
// It shows the suite catching a design that reasoning often picks first.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function openStore(path: string) {
  const file = join(path, 'data.json')
  let data: Record<string, string> = {}
  try {
    data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
  } catch {
    data = {}
  }
  const flush = (): void => { writeFileSync(file, JSON.stringify(data)) }
  return {
    put(key: string, value: string): void { data[key] = value; flush() },
    get(key: string): string | undefined { return data[key] },
    delete(key: string): void { delete data[key]; flush() },
    close(): void {},
  }
}
