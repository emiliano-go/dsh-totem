import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { ContextBlockStore } from '../src/compaction/blocks.ts'
import { registerCompactionTools } from '../src/compaction/tools.ts'

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('compaction_search', () => {
  test('scopes reads to the calling session and returns compact metadata', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-compaction-tool-'))
    dirs.push(dir)
    const blocks = new ContextBlockStore(dir)
    await blocks.append({
      sessionId: 'session-a',
      compactionId: 'compact-1',
      summarySeq: 4,
      startSeq: 1,
      endSeq: 3,
      shadowedSeqs: [1, 2, 3],
      shadowedTokenCount: 900,
      summary: 'We chose SQLite for portability.',
      provider: 'p',
      model: 'm',
    })
    await blocks.append({
      sessionId: 'session-b',
      compactionId: 'compact-2',
      summarySeq: 7,
      startSeq: 5,
      endSeq: 6,
      shadowedSeqs: [5, 6],
      shadowedTokenCount: 50,
      summary: 'Another session secret.',
      provider: 'p',
      model: 'm',
    })
    let definition: any
    registerCompactionTools({
      tools: { register: (value: unknown) => { definition = value } },
    } as never, blocks)
    const result = await definition.execute(
      { query: 'sqlite' },
      { agent: { session: { id: 'session-a' } } },
    )
    expect(result.sessionId).toBe('session-a')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].summary).toContain('SQLite')
    expect(result.blocks[0].compactionId).toBe('compact-1')
  })

  test('refuses a call without a session', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-compaction-tool-'))
    dirs.push(dir)
    let definition: any
    registerCompactionTools({
      tools: { register: (value: unknown) => { definition = value } },
    } as never, new ContextBlockStore(dir))
    const result = await definition.execute({ query: 'x' }, {})
    expect(result.error).toBe('no active session')
    expect(result.blocks).toEqual([])
  })
})
