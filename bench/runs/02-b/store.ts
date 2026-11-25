// Durable single-file store: group-commit append log.
//
// Design (spike winner c1): every put/delete is an NDJSON record appended to
// `data.log`. Callers that arrive together are collected into one batch, written
// with a single writeSync and made durable by one fsyncSync; their promises
// resolve only after that fsync returns. Sequential callers therefore pay one
// fsync per put, while concurrent callers share fsyncs.
//
// Crash safety: an acknowledged record is on disk before its resolver runs. A
// torn trailing record (interrupted append) fails to parse and is skipped on
// replay. If the log does not end in a newline, the next append is prefixed with
// one so the torn fragment cannot swallow a later, acknowledged record.
import {
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import { join } from 'node:path'

export interface Store {
  put(key: string, value: string): Promise<void> | void
  get(key: string): string | undefined
  delete(key: string): Promise<void> | void
  close(): Promise<void> | void
}

type Record_ = { k: string; v: string } | { k: string; d: 1 }

interface Entry {
  line: string
  key: string
  value: string | undefined // undefined means tombstone
  resolve: () => void
  reject: (error: unknown) => void
}

class LogStore implements Store {
  private readonly map = new Map<string, string>()
  private readonly fd: number
  private pending: Entry[] = []
  private flushing = false
  private closed = false
  private needsNewline: boolean
  private closeWaiters: Array<() => void> = []
  private closeError: unknown
  private finished = false

  private constructor(fd: number, needsNewline: boolean) {
    this.fd = fd
    this.needsNewline = needsNewline
  }

  static open(dir: string): LogStore {
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'data.log')

    let text = ''
    const existed = existsSync(file)
    if (existed) {
      try {
        text = String(readFileSync(file, 'utf8'))
      } catch {
        text = ''
      }
    }

    const store = new LogStore(openSync(file, 'a'), text.length > 0 && !text.endsWith('\n'))
    if (!existed) store.syncDirectory(dir)

    for (const line of text.split('\n')) {
      if (line === '') continue
      let record: Record_
      try {
        record = JSON.parse(line) as Record_
      } catch {
        // Torn trailing record from an interrupted append: not acknowledged, so
        // dropping it is safe.
        continue
      }
      if (record !== null && typeof record === 'object') {
        if ('d' in record) store.map.delete(record.k)
        else if ('v' in record) store.map.set(record.k, record.v)
      }
    }
    return store
  }

  // A newly created data.log needs its directory entry fsynced too, or a power
  // loss can forget the file even though its contents were fsynced.
  private syncDirectory(dir: string): void {
    let dirFd = -1
    try {
      dirFd = openSync(dir, 'r')
      fsyncSync(dirFd)
    } catch {
      // best effort: not all platforms allow fsync on a directory
    } finally {
      if (dirFd >= 0) {
        try {
          closeSync(dirFd)
        } catch {
          // ignore
        }
      }
    }
  }

  put(key: string, value: string): Promise<void> {
    return this.enqueue(JSON.stringify({ k: key, v: value }), key, value)
  }

  delete(key: string): Promise<void> {
    return this.enqueue(JSON.stringify({ k: key, d: 1 }), key, undefined)
  }

  get(key: string): string | undefined {
    return this.map.get(key)
  }

  close(): Promise<void> | void {
    if (this.closed) return this.closing()
    this.closed = true
    if (this.pending.length > 0 || this.flushing) {
      const done = this.closing()
      this.startFlush()
      return done
    }
    return this.closing()
  }

  private closing(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.closeError !== undefined) {
        reject(this.closeError)
        return
      }
      if (this.finished) {
        if (this.closeError !== undefined) reject(this.closeError)
        else resolve()
        return
      }
      this.closeWaiters.push(() => {
        if (this.closeError !== undefined) reject(this.closeError)
        else resolve()
      })
      this.finishIfIdle()
    })
  }

  private enqueue(line: string, key: string, value: string | undefined): Promise<void> {
    if (this.closed) return Promise.reject(new Error('store is closed'))
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ line, key, value, resolve, reject })
      this.startFlush()
    })
  }

  private startFlush(): void {
    if (this.flushing) return
    this.flushing = true
    // Defer so calls made in the same tick land in one batch and share a fsync.
    queueMicrotask(() => this.flushLoop())
  }

  private flushLoop(): void {
    while (this.pending.length > 0) {
      const batch = this.pending
      this.pending = []
      let payload = ''
      for (const entry of batch) payload += entry.line + '\n'
      if (this.needsNewline) {
        payload = '\n' + payload
        this.needsNewline = false
      }
      try {
        writeSync(this.fd, payload)
        fsyncSync(this.fd)
      } catch (error) {
        this.closeError = error
        for (const entry of batch) entry.reject(error)
        for (const entry of this.pending) entry.reject(error)
        this.pending = []
        this.flushing = false
        this.finishIfIdle()
        return
      }
      for (const entry of batch) {
        if (entry.value === undefined) this.map.delete(entry.key)
        else this.map.set(entry.key, entry.value)
        entry.resolve()
      }
    }
    this.flushing = false
    this.finishIfIdle()
  }

  private finishIfIdle(): void {
    if (this.finished || !this.closed || this.flushing || this.pending.length > 0) return
    try {
      fsyncSync(this.fd)
    } catch (error) {
      if (this.closeError === undefined) this.closeError = error
    }
    try {
      closeSync(this.fd)
    } catch (error) {
      if (this.closeError === undefined) this.closeError = error
    }
    this.finished = true
    const waiters = this.closeWaiters
    this.closeWaiters = []
    for (const waiter of waiters) waiter()
  }
}

export function openStore(path: string): Promise<Store> {
  return Promise.resolve(LogStore.open(path))
}
