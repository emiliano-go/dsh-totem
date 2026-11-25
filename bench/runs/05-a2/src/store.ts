/** Small JSON-file store with serialized atomic writes. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

/** DSH home directory used for assistant state. */
export function dshHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** Directory for dsh-totem assistant state. */
export function stateDir(): string {
  return join(dshHome(), 'totem')
}

/** Path inside the assistant state directory. */
export function statePath(name: string): string {
  return join(stateDir(), name)
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T
}

/**
 * One JSON document with serialized read-modify-write cycles.
 *
 * Writes go through a sibling temp file and rename, so a crash never leaves a
 * partial document. Multiple Host processes are not supported; the web Host is
 * the sole writer.
 */
export class JsonStore<T> {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly path: string, private readonly initial: T) {}

  /** Read the current document (initial value when missing or unreadable). */
  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as T
    } catch {
      return clone(this.initial)
    }
  }

  /** Apply one mutation atomically and return the next document. */
  async update(mutate: (current: T) => T | Promise<T>): Promise<T> {
    const task = this.queue.then(async () => {
      const current = await this.read()
      const next = await mutate(current)
      await mkdir(dirname(this.path), { recursive: true })
      const temp = `${this.path}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temp, JSON.stringify(next, null, 2))
      await rename(temp, this.path)
      return next
    })
    this.queue = task.then(() => {}, () => {})
    return task
  }
}
