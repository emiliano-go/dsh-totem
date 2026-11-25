// Durable append-only key/value store with group commit.
//
// Every acknowledged `put`/`delete` has been written and fsync'd before its
// promise resolves. To keep that affordable, appends made by concurrent callers
// are coalesced: one writeSync + one fsyncSync covers every record that was
// enqueued in the same turn of the event loop, then all of those callers are
// resolved. A single caller therefore pays one fsync per call; N concurrent
// callers pay one fsync per batch of N.
//
// The log is a sequence of ASCII lines, `<op>|<crc>|<keyB64>|<valB64>`:
//   - base64 keeps every record byte ASCII, so a line's byte length is its
//     character length and framing survives any encoding without surprises;
//   - the checksum makes a torn tail detectable, and recovery simply stops at
//     the first unreadable line (records after a torn tail cannot exist: the
//     file is only ever appended to, by one process).
//
// Recovery builds an in-memory map by replaying valid records in order; a
// partial final line left by a crash is discarded, which is exactly the
// "unacknowledged writes may be lost, but never corrupt" rule.

import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'

export interface Store {
  put(key: string, value: string): Promise<void>
  get(key: string): string | undefined
  delete(key: string): Promise<void>
  close(): Promise<void> | void
}

const LOG_NAME = 'log'
const OP_PUT = 'p'
const OP_DELETE = 'd'
const MAX_RECORD_CHARS = 1 << 24

const encode = (text: string): string => Buffer.from(text, 'utf8').toString('base64')
const decode = (text: string): string => Buffer.from(text, 'base64').toString('utf8')

// FNV-1a, 32 bit, hex. Cheap integrity check for torn/partial records.
const checksum = (text: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const frame = (op: string, key: string, value: string): string => {
  const key64 = encode(key)
  const value64 = value.length === 0 ? '' : encode(value)
  const body = `${op}|${key64}|${value64}`
  return `${checksum(body)}|${body}\n`
}

interface Record {
  op: string
  key: string
  value: string
}

const parseLine = (line: string): Record | undefined => {
  if (line.length === 0 || line.length > MAX_RECORD_CHARS) return undefined
  const parts = line.split('|')
  if (parts.length !== 4) return undefined
  const [crc, op, key64, value64] = parts as [string, string, string, string]
  if (op !== OP_PUT && op !== OP_DELETE) return undefined
  if (checksum(`${op}|${key64}|${value64}`) !== crc) return undefined
  let key: string
  let value: string
  try {
    key = decode(key64)
    value = value64.length === 0 ? '' : decode(value64)
  } catch {
    return undefined
  }
  return { op, key, value }
}

export function openStore(path: string): Store {
  mkdirSync(path, { recursive: true })
  const file = join(path, LOG_NAME)

  const data = new Map<string, string>()
  let existing = ''
  try {
    existing = readFileSync(file, 'utf8')
  } catch {
    existing = ''
  }

  let validEnd = 0
  let torn = false
  if (existing.length > 0) {
    const complete = existing.endsWith('\n')
    const lines = existing.split('\n')
    // The element after the final newline is always '' when complete; when the
    // last write was torn it is the partial record and must be dropped.
    if (!complete) lines.pop()
    for (const line of lines) {
      const record = parseLine(line)
      if (record === undefined) {
        torn = true
        break // torn or corrupt tail: stop replaying
      }
      validEnd += line.length + 1
      if (record.op === OP_PUT) data.set(record.key, record.value)
      else data.delete(record.key)
    }
    if (!complete) torn = true
  }

  // A crash can leave a half-written record at the end. Appending after it
  // would bury the tear in the middle of the file, so rewrite the log with only
  // the durable prefix first: the store then has exactly one tail, always at a
  // record boundary. This only happens after an unclean shutdown.
  if (torn) {
    const temp = `${file}.repair`
    writeFileSync(temp, existing.slice(0, validEnd))
    const repairFd = openSync(temp)
    fsyncSync(repairFd)
    closeSync(repairFd)
    renameSync(temp, file)
  }

  const fd = openSync(file, 'a')
  let pending = ''
  let waiters: { resolve: () => void; reject: (error: unknown) => void }[] = []
  let scheduled = false
  let flushing = false
  let closed = false
  let failure: unknown

  const writeAll = (text: string): void => {
    let offset = 0
    while (offset < text.length) {
      // Records are pure ASCII, so a character offset is a byte offset.
      const written = writeSync(fd, offset === 0 ? text : text.slice(offset))
      if (written <= 0) throw new Error('short write')
      offset += written
    }
  }

  const flush = (): void => {
    scheduled = false
    if (flushing || closed || pending.length === 0) return
    flushing = true
    const text = pending
    const batch = waiters
    pending = ''
    waiters = []
    try {
      writeAll(text)
      fsyncSync(fd)
      for (const waiter of batch) waiter.resolve()
    } catch (error) {
      failure = error
      for (const waiter of batch) waiter.reject(error)
    } finally {
      flushing = false
      if (pending.length > 0 && !closed) schedule()
    }
  }

  const schedule = (): void => {
    if (scheduled || flushing || closed) return
    scheduled = true
    // A microtask, not a timer: every caller that enqueued during the current
    // turn is already in the batch, so this adds coalescing without latency.
    queueMicrotask(flush)
  }

  const append = (op: string, key: string, value: string): Promise<void> => {
    if (closed) return Promise.reject(new Error('store is closed'))
    if (failure !== undefined) return Promise.reject(failure)
    pending += frame(op, key, value)
    const promise = new Promise<void>((resolve, reject) => {
      waiters.push({ resolve, reject })
    })
    schedule()
    return promise
  }

  return {
    put(key: string, value: string): Promise<void> {
      if (closed) return Promise.reject(new Error('store is closed'))
      if (failure !== undefined) return Promise.reject(failure)
      data.set(key, value)
      return append(OP_PUT, key, value)
    },

    get(key: string): string | undefined {
      return data.get(key)
    },

    delete(key: string): Promise<void> {
      if (closed) return Promise.reject(new Error('store is closed'))
      if (failure !== undefined) return Promise.reject(failure)
      data.delete(key)
      return append(OP_DELETE, key, '')
    },

    close(): Promise<void> {
      if (closed) return Promise.resolve()
      if (pending.length > 0) flush()
      closed = true
      try {
        closeSync(fd)
      } catch (error) {
        failure ??= error
      }
      return failure === undefined
        ? Promise.resolve()
        : Promise.reject(failure)
    },
  }
}
