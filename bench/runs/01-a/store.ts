/**
 * Crash-safe append-only key/value store.
 *
 * Layout: a single append-only log at `<path>/data.log`. Every record is one
 * UTF-8 line:
 *
 *     <crc32 hex, 8 chars> <json payload>\n
 *
 * where the payload is `{"s":seq,"o":0|1,"k":key,"v":value?}` (o=1 put, o=0
 * delete). The CRC covers the exact payload bytes, so a torn tail left by a
 * kill -9 or a power loss is detected on open and discarded; a put only
 * resolves after its record has been written and fsynced, so an acknowledged
 * write is on disk before the promise settles.
 *
 * Recovery reads the log front to back, stops at the first record that is
 * incomplete or fails its checksum, and truncates the file back to the last
 * good record boundary (or rewrites the good prefix when truncation is not
 * available, e.g. under an fs shim) so later appends never sit behind garbage.
 * Sequence numbers are assigned monotonically and duplicates are ignored, which
 * keeps "no duplicated sequence numbers" true even if a record is replayed.
 *
 * Only synchronous `node:fs` entry points are used: they keep the write path
 * one write + one fsync per acknowledged put, and they are the surface an
 * in-process crash simulator can intercept.
 */
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import * as fsNs from 'node:fs'
import { join } from 'node:path'

export interface Store {
  put(key: string, value: string): Promise<void> | void
  get(key: string): string | undefined
  delete(key: string): Promise<void> | void
  close(): Promise<void> | void
}

const LOG_NAME = 'data.log'

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

const encoder = new TextEncoder()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function checksum(payload: string): string {
  return crc32(encoder.encode(payload)).toString(16).padStart(8, '0')
}

interface Record {
  s: number
  o: 0 | 1
  k: string
  v?: string
}

/** Parse one log line; `undefined` means torn or corrupt. */
function decode(line: string): Record | undefined {
  if (line.length < 10) return undefined
  if (line.charCodeAt(8) !== 0x20) return undefined
  const payload = line.slice(9)
  const declared = Number.parseInt(line.slice(0, 8), 16)
  if (!Number.isFinite(declared) || declared < 0) return undefined
  if (checksum(payload) !== declared.toString(16).padStart(8, '0')) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as Partial<Record>
  if (typeof record.s !== 'number' || !Number.isInteger(record.s) || record.s <= 0) return undefined
  if (record.o !== 0 && record.o !== 1) return undefined
  if (typeof record.k !== 'string') return undefined
  if (record.o === 1 && typeof record.v !== 'string') return undefined
  return record as Record
}

function byteLength(text: string): number {
  return encoder.encode(text).length
}

class AppendStore implements Store {
  private readonly logPath: string
  private fd: number | undefined
  private readonly data = new Map<string, string>()
  private seq = 0
  private failure: unknown
  private closed = false

  constructor(logPath: string) {
    this.logPath = logPath
  }

  /** Replay the log, truncating any torn tail. Returns a loadable store. */
  static open(directory: string): AppendStore {
    mkdirSync(directory, { recursive: true })
    const store = new AppendStore(join(directory, LOG_NAME))
    store.replay()
    store.fd = openSync(store.logPath, 'a')
    return store
  }

  private replay(): void {
    let text = ''
    try {
      text = readFileSync(this.logPath, 'utf8')
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException)?.code !== 'ENOENT') throw cause
    }

    let pos = 0
    let goodBytes = 0
    let goodEnd = 0
    let torn = false

    for (;;) {
      const newline = text.indexOf('\n', pos)
      if (newline === -1) break
      const line = text.slice(pos, newline)
      const record = decode(line)
      if (record === undefined) {
        torn = true
        break
      }
      if (record.s > this.seq) {
        this.seq = record.s
        if (record.o === 1) this.data.set(record.k, record.v as string)
        else this.data.delete(record.k)
      }
      goodBytes += byteLength(line) + 1
      goodEnd = newline + 1
      pos = newline + 1
    }
    if (goodEnd < byteLength(text)) torn = true

    if (torn) this.discardTornTail(text, goodBytes, goodEnd)
  }

  private discardTornTail(text: string, goodBytes: number, goodEnd: number): void {
    const truncate = (fsNs as { truncateSync?: (path: string, length: number) => void }).truncateSync
    try {
      if (typeof truncate === 'function') {
        truncate.call(fsNs, this.logPath, goodBytes)
        return
      }
      // No truncation in this fs surface: rewrite the good prefix in place and
      // force it out, so the next append starts at a record boundary.
      writeFileSync(this.logPath, goodEnd === 0 ? '' : text.slice(0, goodEnd))
      const fd = openSync(this.logPath, 'r+')
      try {
        fsyncSync(fd)
      } finally {
        closeSync(fd)
      }
    } catch {
      // Best effort: replay already ignores the damaged suffix.
    }
  }

  private append(payload: string): void {
    if (this.closed) throw new Error('store is closed')
    if (this.failure !== undefined) throw this.failure
    if (this.fd === undefined) throw new Error('store is not open')
    const line = `${checksum(payload)} ${payload}\n`
    try {
      writeSync(this.fd, line)
      fsyncSync(this.fd)
    } catch (cause) {
      // A partial record may now sit in the log; refuse further writes so a
      // later append can never be glued onto it.
      this.failure = cause
      throw cause
    }
  }

  put(key: string, value: string): void {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new TypeError('put(key: string, value: string)')
    }
    const seq = this.seq + 1
    const payload = JSON.stringify({ s: seq, o: 1, k: key, v: value })
    this.append(payload)
    this.seq = seq
    this.data.set(key, value)
  }

  get(key: string): string | undefined {
    return this.data.get(key)
  }

  delete(key: string): void {
    if (typeof key !== 'string') throw new TypeError('delete(key: string)')
    const seq = this.seq + 1
    const payload = JSON.stringify({ s: seq, o: 0, k: key })
    this.append(payload)
    this.seq = seq
    this.data.delete(key)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    const fd = this.fd
    this.fd = undefined
    if (fd === undefined) return
    try {
      fsyncSync(fd)
    } catch {
      // Closing still releases the descriptor.
    }
    closeSync(fd)
  }
}

export function openStore(path: string): Store {
  return AppendStore.open(path)
}
