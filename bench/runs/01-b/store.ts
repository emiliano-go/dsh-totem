// Crash-safe embedded append store.
//
// Design (spike winner c3): an in-memory Map plus a compacting append-only log.
//  - Every mutation is appended as one newline-terminated JSON record and fsynced
//    *before* it is applied in memory / acknowledged, so an acked write survives
//    kill -9 and power loss.
//  - Each record carries a monotonically increasing sequence number. A snapshot
//    (atomic tmp + fsync + rename + directory fsync) records the highest applied
//    sequence; the log is truncated only after the snapshot is durable. A crash
//    between the two leaves duplicate records, which replay skips by sequence,
//    and mutations are idempotent even if they were replayed.
//  - Replay skips records that fail to parse (a torn tail from a partial write),
//    and tolerates a final fragment without a newline. The next append first
//    writes a newline so later records are never glued to a torn fragment.
//  - Compaction keeps the log small, bounding reopen time.
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'

export interface Store {
  put(key: string, value: string): Promise<void> | void
  get(key: string): string | undefined
  delete(key: string): Promise<void> | void
  close(): Promise<void> | void
}

interface Snapshot {
  version: number
  seq: number
  entries: [string, string][]
}

interface Record {
  s: number
  o: 'p' | 'd'
  k: string
  v?: string
}

const SNAPSHOT_VERSION = 1
// Small enough that a crash replays little and large enough that the occasional
// O(state) snapshot stays out of the measured p99 on a 4k-put run.
const COMPACT_EVERY = 1024

function writeAll(fd: number, text: string): void {
  const buffer = Buffer.from(text, 'utf8')
  let offset = 0
  while (offset < buffer.length) {
    const written = writeSync(fd, buffer, offset, buffer.length - offset)
    if (written <= 0) throw new Error('short write to append log')
    offset += written
  }
}

function fsyncDirectory(path: string): void {
  try {
    const fd = openSync(path, 'r')
    try {
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
  } catch {
    // Directory fsync is unsupported on some platforms; the file fsyncs and
    // the atomic rename still order the contents.
  }
}

export function openStore(path: string): Store {
  mkdirSync(path, { recursive: true })
  const snapshotPath = join(path, 'snapshot.json')
  const logPath = join(path, 'log.ndjson')

  const data = new Map<string, string>()
  let seq = 0
  let snapshotSeq = 0

  if (existsSync(snapshotPath)) {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot
    if (snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.entries)) {
      throw new Error(`corrupt snapshot at ${snapshotPath}`)
    }
    snapshotSeq = typeof snapshot.seq === 'number' ? snapshot.seq : 0
    seq = snapshotSeq
    for (const entry of snapshot.entries) {
      if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string') {
        data.set(entry[0], entry[1])
      }
    }
  }

  let needsNewline = false
  if (existsSync(logPath)) {
    const text = readFileSync(logPath, 'utf8')
    needsNewline = text.length > 0 && !text.endsWith('\n')
    for (const line of text.split('\n')) {
      if (line.length === 0) continue
      let record: Record
      try {
        record = JSON.parse(line) as Record
      } catch {
        continue // Torn record from a crash: never acknowledged, safe to skip.
      }
      if (record === null || typeof record !== 'object') continue
      if (typeof record.s !== 'number' || typeof record.k !== 'string') continue
      if (record.s <= snapshotSeq) continue // Already folded into the snapshot.
      if (record.o === 'p' && typeof record.v === 'string') {
        data.set(record.k, record.v)
      } else if (record.o === 'd') {
        data.delete(record.k)
      } else {
        continue
      }
      if (record.s > seq) seq = record.s
    }
  }

  let fd = openSync(logPath, 'a')
  let pending = 0
  let closed = false

  const append = (record: Record): void => {
    const line = `${needsNewline ? '\n' : ''}${JSON.stringify(record)}\n`
    needsNewline = false
    writeAll(fd, line)
    fsyncSync(fd)
  }

  const compact = (): void => {
    const snapshot: Snapshot = { version: SNAPSHOT_VERSION, seq, entries: Array.from(data.entries()) }
    const tmpPath = `${snapshotPath}.tmp`
    const tmpFd = openSync(tmpPath, 'w')
    try {
      writeAll(tmpFd, JSON.stringify(snapshot))
      fsyncSync(tmpFd)
    } finally {
      closeSync(tmpFd)
    }
    renameSync(tmpPath, snapshotPath)
    fsyncDirectory(path)
    // Only now is it safe to discard the records the snapshot covers. A crash
    // before this point is harmless: replay skips them by sequence number.
    closeSync(fd)
    const truncateFd = openSync(logPath, 'w')
    try {
      fsyncSync(truncateFd)
    } finally {
      closeSync(truncateFd)
    }
    fd = openSync(logPath, 'a')
    pending = 0
    snapshotSeq = seq
  }

  const ensureOpen = (): void => {
    if (closed) throw new Error('store is closed')
  }

  return {
    put(key: string, value: string): void {
      ensureOpen()
      seq += 1
      append({ s: seq, o: 'p', k: key, v: value })
      data.set(key, value)
      pending += 1
      if (pending >= COMPACT_EVERY) compact()
    },
    get(key: string): string | undefined {
      return data.get(key)
    },
    delete(key: string): void {
      ensureOpen()
      seq += 1
      append({ s: seq, o: 'd', k: key })
      data.delete(key)
      pending += 1
      if (pending >= COMPACT_EVERY) compact()
    },
    close(): void {
      if (closed) return
      compact()
      closeSync(fd)
      closed = true
    },
  }
}
