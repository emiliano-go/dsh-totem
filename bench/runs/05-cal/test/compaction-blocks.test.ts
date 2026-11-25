import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { ContextBlockStore } from '../src/compaction/blocks.ts'

const dirs: string[] = []
async function store(): Promise<ContextBlockStore> {
  const dir = await mkdtemp(join(tmpdir(), 'totem-blocks-'))
  dirs.push(dir)
  return new ContextBlockStore(dir)
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('ContextBlockStore', () => {
  test('persists a block and resolves a replacement seq', async () => {
    const blocks = await store()
    const block = await blocks.append({
      sessionId: 'session-a',
      compactionId: 'compact-1',
      summarySeq: 10,
      startSeq: 1,
      endSeq: 9,
      shadowedSeqs: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      shadowedTokenCount: 1200,
      summary: 'We kept the API stable and moved storage to SQLite.',
      provider: 'p',
      model: 'm',
    })
    expect(block.tier).toBe(1)
    expect(block.parentIds).toEqual([])
    await blocks.setReplacement('session-a', 'compact-1', 11)
    const read = await blocks.read('session-a')
    expect(read).toHaveLength(1)
    expect(read[0].replacementSeq).toBe(11)
  })

  test('links a later compact to the compact it shadowed', async () => {
    const blocks = await store()
    const first = await blocks.append({
      sessionId: 'session-a',
      compactionId: 'compact-1',
      summarySeq: 10,
      startSeq: 1,
      endSeq: 9,
      shadowedSeqs: [1, 2, 3],
      shadowedTokenCount: 100,
      summary: 'First compact.',
      provider: 'p',
      model: 'm',
    })
    await blocks.setReplacement('session-a', 'compact-1', 11)
    const second = await blocks.append({
      sessionId: 'session-a',
      compactionId: 'compact-2',
      summarySeq: 30,
      startSeq: 4,
      endSeq: 29,
      shadowedSeqs: [4, 5, 10, 11, 20],
      shadowedTokenCount: 500,
      summary: 'Second compact mentioning First compact.',
      provider: 'p',
      model: 'm',
    })
    expect(second.tier).toBe(2)
    expect(second.parentIds).toEqual([first.id])
  })

  test('dedupes by compaction id', async () => {
    const blocks = await store()
    const input = {
      sessionId: 'session-a',
      compactionId: 'compact-1',
      summarySeq: 10,
      startSeq: 1,
      endSeq: 9,
      shadowedSeqs: [1, 2],
      shadowedTokenCount: 100,
      summary: 'One compact.',
      provider: 'p',
      model: 'm',
    }
    const first = await blocks.append(input)
    const second = await blocks.append({ ...input, summary: 'duplicate text' })
    expect(second.id).toBe(first.id)
    expect(await blocks.read('session-a')).toHaveLength(1)
  })

  test('searches newest first and clamps the limit', async () => {
    const blocks = await store()
    await blocks.append({
      sessionId: 's', compactionId: 'a', summarySeq: 1, startSeq: 1, endSeq: 1,
      shadowedSeqs: [1], shadowedTokenCount: 1, summary: 'SQLite decision', provider: 'p', model: 'm',
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    await blocks.append({
      sessionId: 's', compactionId: 'b', summarySeq: 2, startSeq: 2, endSeq: 2,
      shadowedSeqs: [2], shadowedTokenCount: 1, summary: 'SQLite follow-up', provider: 'p', model: 'm',
    })
    const found = await blocks.search('s', 'sqlite', 1)
    expect(found).toHaveLength(1)
    expect(found[0].compactionId).toBe('b')
    expect(await blocks.search('s', 'missing')).toEqual([])
    expect((await blocks.search('s', '', 0))).toHaveLength(1)
  })
})
