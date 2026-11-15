import { describe, expect, test } from 'bun:test'
import { budgetFor, bulletBlock, clipToTokens, estimateTokens } from '../src/budget.ts'
import { CompactionMemory, formatRecovery, isCompactionEvent } from '../src/compaction.ts'
import { parseRemember, titleFor } from '../src/commands.ts'
import { isWorkflow, renderSkill, skillName } from '../src/skills.ts'
import { isSessionSummary, recallSessions, toRecalled } from '../src/recall.ts'

describe('budget', () => {
  test('estimates tokens and clips on a line boundary', () => {
    expect(estimateTokens('abcd')).toBe(1)
    const text = ['one', 'two', 'three'].join('\n').repeat(20)
    const clipped = clipToTokens(text, 10)
    expect(estimateTokens(clipped)).toBeLessThanOrEqual(10)
    expect(clipped).toContain('truncated')
  })

  test('a zero budget yields nothing rather than a footer', () => {
    expect(clipToTokens('anything', 0)).toBe('')
  })

  test('pressure shrinks the budget before anything else', () => {
    expect(budgetFor(undefined, 400)).toBe(400)
    expect(budgetFor(0.3, 400)).toBe(400)
    expect(budgetFor(0.75, 400)).toBe(200)
    expect(budgetFor(0.95, 400)).toBe(0)
    expect(budgetFor(0.95, 0)).toBe(0)
  })

  test('bullets stop before the budget instead of overrunning it', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      type: 'decision',
      title: `Decision ${index}`,
      statement: 'x'.repeat(120),
    }))
    const lines = bulletBlock(items, 30)
    expect(lines.length).toBeGreaterThan(0)
    expect(estimateTokens(lines.join('\n'))).toBeLessThanOrEqual(30)
  })
})

describe('compaction detection', () => {
  test('recognises both compaction markers', () => {
    expect(isCompactionEvent({ type: 'compaction/start' })).toBe(true)
    expect(isCompactionEvent({
      type: 'user/message',
      data: { message: { source: { kind: 'compact-checkpoint' } } },
    })).toBe(true)
  })

  test('ignores ordinary messages', () => {
    expect(isCompactionEvent({ type: 'user/message', data: { message: { source: { kind: 'user' } } } })).toBe(false)
    expect(isCompactionEvent({ type: 'assistant/message' })).toBe(false)
  })

  test('recovery restores durable claims and drops file state', () => {
    const text = formatRecovery([
      { type: 'decision', title: 'Use SQLite', statement: 'Chosen for portability.', importance: 0.9 },
      { type: 'implementation', title: 'File: a.ts', statement: 'A file.', importance: 1 },
      { type: 'gotcha', title: 'FTS breaks', statement: 'Rebuild the index.', importance: 0.5 },
    ], [{ type: 'observation', title: 'task:1', statement: 'Do the thing.', importance: 0.6 }], 300)
    expect(text).toContain('Use SQLite')
    expect(text).toContain('FTS breaks')
    expect(text).not.toContain('File: a.ts')
    expect(text).toContain('task:1')
  })

  test('recovery is empty when nothing durable exists', () => {
    expect(formatRecovery([{ type: 'implementation', title: 'File: a.ts' }], [], 300)).toBe('')
  })
})

describe('command parsing', () => {
  test('reads type and tags prefixes in any order', () => {
    expect(parseRemember('tags:db,retry type:gotcha Retries stop after three.')).toEqual({
      type: 'gotcha',
      tags: ['db', 'retry'],
      statement: 'Retries stop after three.',
    })
  })

  test('falls back to observation for an unknown type', () => {
    expect(parseRemember('type:nonsense The queue is bounded.')).toEqual({
      type: 'observation',
      tags: [],
      statement: 'The queue is bounded.',
    })
  })

  test('reports usage when no statement remains', () => {
    expect(parseRemember('type:decision')).toEqual({ error: expect.stringContaining('usage') })
  })

  test('titles use the first sentence', () => {
    expect(titleFor('First claim. Second claim.')).toBe('First claim.')
  })
})

describe('workflow skills', () => {
  const workflow = {
    id: 'w1',
    title: 'Workflow: Release',
    statement: 'Release: tag -> publish',
    metadata: {
      kind: 'workflow',
      name: 'Release',
      responsibility: 'Cut a release safely.',
      steps: ['Tag', 'Publish'],
      preconditions: ['CI green'],
      verification: ['Install from the registry'],
      failureModes: ['Tag already exists'],
    },
  }

  test('names are kebab-case and stable', () => {
    expect(skillName('Release   Train!')).toBe('release-train')
  })

  test('only workflow rows are projected', () => {
    expect(isWorkflow(workflow)).toBe(true)
    expect(isWorkflow({ metadata: { kind: 'session_summary' } })).toBe(false)
  })

  test('renders steps as instructions with a verify section', () => {
    const body = renderSkill(workflow)
    expect(body).toContain('# Release')
    expect(body).toContain('1. Tag')
    expect(body).toContain('## Verify')
    expect(body).toContain('Tag already exists')
  })
})

describe('session recall', () => {
  const summary = {
    id: 's1',
    title: 'Session: fixed the queue',
    statement: 'Fixed the queue retry path.',
    metadata: { kind: 'session_summary', memoryClass: 'episodic', files: ['src/queue.py'], commit: 'abc' },
  }

  test('identifies summaries by metadata or type', () => {
    expect(isSessionSummary(summary)).toBe(true)
    expect(isSessionSummary({ type: 'session_summary' })).toBe(true)
    expect(isSessionSummary({ metadata: { kind: 'decision' } })).toBe(false)
  })

  test('projects file and commit fields', () => {
    expect(toRecalled(summary)).toEqual({
      id: 's1',
      title: 'Session: fixed the queue',
      summary: 'Fixed the queue retry path.',
      files: ['src/queue.py'],
      commit: 'abc',
    })
  })

  test('filters a mixed result page down to sessions', () => {
    const recalled = recallSessions([
      { id: 'a', metadata: { kind: 'decision' } },
      summary,
      { metadata: { memoryClass: 'episodic' }, id: 's2', statement: 'Second.' },
    ])
    expect(recalled.map(item => item.id)).toEqual(['s1', 's2'])
  })
})

describe('compaction tracker', () => {
  function tracker(items: unknown[]) {
    const calls: string[] = []
    const fake = {
      async projectFor() { return '/repo' },
      async call(name: string) { calls.push(name); return name === 'memory_tasks_tool' ? [] : items },
    }
    return { memory: new CompactionMemory(fake as never), calls }
  }

  test('the same session is answered once', async () => {
    const { memory } = tracker([{ type: 'decision', title: 'Use SQLite', statement: 'portable', importance: 1 }])
    expect(memory.note('s1', { type: 'compaction/start' })).toBe(true)
    expect(memory.needsRecovery('s1')).toBe(true)
    const text = await memory.take({}, 's1', new AbortController().signal, 200)
    expect(text).toContain('Use SQLite')
    expect(memory.needsRecovery('s1')).toBe(false)
    expect(await memory.take({}, 's1', new AbortController().signal, 200)).toBe('')
  })

  test('a non compaction event does not arm the session', () => {
    const { memory } = tracker([])
    expect(memory.note('s1', { type: 'assistant/message' })).toBe(false)
    expect(memory.needsRecovery('s1')).toBe(false)
  })

  test('a failed server produces no block but still clears the marker', async () => {
    const failing = {
      async projectFor() { return '/repo' },
      async call() { throw new Error('down') },
    }
    const memory = new CompactionMemory(failing as never)
    memory.note('s1', { type: 'compaction/start' })
    expect(await memory.take({}, 's1', new AbortController().signal, 200)).toBe('')
    expect(memory.needsRecovery('s1')).toBe(false)
  })
})
