import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  InterruptedTurnResumer,
  continuationPrompt,
  interruptionOf,
  resumeRequestId,
  type ResumeEvent,
  type ResumeSummary,
} from '../src/resume.ts'

let seq = 0
function event(type: string, data: unknown = {}): ResumeEvent {
  seq += 1
  return { type, seq, time: 1_000 + seq, data }
}

function shutdownLog(turn = 1): ResumeEvent[] {
  return [
    event('turn/start', { turn }),
    event('turn/end', { turn, reason: { kind: 'aborted', reason: { kind: 'disposed' } } }),
  ]
}

function completedLog(turn = 1): ResumeEvent[] {
  return [
    event('turn/start', { turn }),
    event('turn/end', { turn, reason: { kind: 'completed' } }),
  ]
}

describe('interruption detection', () => {
  test('a disposed abort is a shutdown interruption', () => {
    expect(interruptionOf(shutdownLog())).toBe('shutdown')
  })

  test('an open tail turn is a crash interruption', () => {
    expect(interruptionOf([event('turn/start', { turn: 1 }), event('tool/call', {})])).toBe('crash')
  })

  test('completed turns and deliberate cancellations never resume', () => {
    expect(interruptionOf(completedLog())).toBeUndefined()
    expect(interruptionOf([
      event('turn/start', { turn: 1 }),
      event('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } }),
    ])).toBeUndefined()
    expect(interruptionOf([
      event('turn/start', { turn: 1 }),
      event('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'parent' } } }),
    ])).toBeUndefined()
    expect(interruptionOf([])).toBeUndefined()
  })
})

interface HarnessOptions {
  sessions: ResumeSummary[]
  logs: Record<string, ResumeEvent[]>
  now?: number
  maxSessions?: number
  maxAttempts?: number
  ledger?: string
}

function harness(options: HarnessOptions) {
  const prompts: { requestId: string; sessionId: string; text: string }[] = []
  const ledger = options.ledger ?? join(mkdtempSync(join(tmpdir(), 'dsh-totem-resume-')), 'resume.json')
  const resumer = new InterruptedTurnResumer({
    controller: {
      list: async () => ({ items: options.sessions }),
      prompt: async (request) => {
        prompts.push({
          requestId: request.requestId,
          sessionId: request.sessionId,
          text: (request.content[0] as { text: string }).text,
        })
        return { accepted: true }
      },
    },
    persistence: {
      open: async (id) => ({
        read: async () => ({ events: options.logs[id] ?? [] }),
        close: () => {},
      }),
    },
    ledgerPath: ledger,
    now: () => options.now ?? 1_000_000,
    windowMs: 30 * 60_000,
    maxSessions: options.maxSessions ?? 3,
    maxAttempts: options.maxAttempts ?? 3,
    cooldownMs: 30 * 60_000,
    maxScan: 20,
  })
  return { resumer, prompts, ledger }
}

function summary(sessionId: string, overrides: Partial<ResumeSummary> = {}): ResumeSummary {
  return { sessionId, updatedAt: 1_000_000, ...overrides }
}

describe('interrupted turn resumer', () => {
  test('queues one continuation for a shutdown-interrupted session', async () => {
    const logs = { s1: shutdownLog() }
    const { resumer, prompts } = harness({ sessions: [summary('s1')], logs })
    const report = await resumer.run()
    expect(report.resumed).toBe(1)
    expect(prompts).toHaveLength(1)
    expect(prompts[0].text).toContain('auto-resume')
    expect(prompts[0].sessionId).toBe('s1')
    expect(prompts[0].requestId).toBe(resumeRequestId('s1', logs.s1.at(-1)!.seq))

    // Same tail event: a second boot must not duplicate the continuation.
    await resumer.run()
    expect(prompts).toHaveLength(1)
  })

  test('skips running, non-continuable subagent, blank, and stale sessions', async () => {
    const old = 1_000_000 - 31 * 60_000
    const { resumer, prompts } = harness({
      sessions: [
        summary('running', { running: true }),
        summary('subagent', { origin: 'subagent' }),
        summary('blank', { blank: true }),
        summary('old', { updatedAt: old }),
      ],
      logs: { running: shutdownLog(), subagent: shutdownLog(), blank: shutdownLog(), old: shutdownLog() },
    })
    const report = await resumer.run()
    expect(report.resumed).toBe(0)
    expect(prompts).toEqual([])
  })

  test('wakes the parent once for interrupted continuable subagents', async () => {
    const logs = {
      parent: completedLog(),
      childA: [
        event('session', { parentSession: 'parent' }),
        event('subagent/descriptor', { mode: 'continuable', label: 'Technical audit' }),
        ...shutdownLog(),
      ],
      childB: [
        event('session', { parentSession: 'parent' }),
        event('subagent/descriptor', { mode: 'continuable', label: 'Schema audit' }),
        ...shutdownLog(),
      ],
    }
    const { resumer, prompts } = harness({
      sessions: [
        summary('parent'),
        summary('childA', { origin: 'subagent', parentSessionId: 'parent' }),
        summary('childB', { origin: 'subagent', parentSessionId: 'parent' }),
      ],
      logs,
    })
    const report = await resumer.run()
    expect(report.resumed).toBe(1)
    expect(prompts).toHaveLength(1)
    expect(prompts[0].sessionId).toBe('parent')
    expect(prompts[0].text).toContain('subagent recovery')
    expect(prompts[0].text).toContain('Technical audit')
    expect(prompts[0].text).toContain('childA')
    expect(prompts[0].text).toContain('childB')

    // The same child tails must not queue a second parent recovery.
    await resumer.run()
    expect(prompts).toHaveLength(1)
  })

  test('does not treat one-shot children as resumable', async () => {
    const logs = {
      parent: completedLog(),
      child: [
        event('session', { parentSession: 'parent' }),
        event('subagent/descriptor', { mode: 'one-shot', label: 'One shot' }),
        ...shutdownLog(),
      ],
    }
    const { resumer, prompts } = harness({
      sessions: [
        summary('parent'),
        summary('child', { origin: 'subagent', parentSessionId: 'parent' }),
      ],
      logs,
    })
    expect((await resumer.run()).resumed).toBe(0)
    expect(prompts).toEqual([])
  })

  test('skips subagents whose parent is not a live top-level Session', async () => {
    const logs = {
      nested: [
        event('session', { parentSession: 'parent' }),
        event('subagent/descriptor', { mode: 'continuable', label: 'Nested child' }),
        ...shutdownLog(),
      ],
    }
    const { resumer, prompts } = harness({
      sessions: [
        summary('parent', { origin: 'subagent' }),
        summary('nested', { origin: 'subagent', parentSessionId: 'parent' }),
      ],
      logs,
    })
    expect((await resumer.run()).resumed).toBe(0)
    expect(prompts).toEqual([])
  })

  test('resumes a crash tail', async () => {
    const logs = { crash: [event('turn/start', { turn: 1 }), event('tool/call', {})] }
    const { resumer, prompts } = harness({ sessions: [summary('crash')], logs })
    const report = await resumer.run()
    expect(report.resumed).toBe(1)
    expect(prompts[0].text).toContain('crash')
  })

  test('never resumes a user-cancelled or completed turn', async () => {
    const logs = {
      done: completedLog(),
      user: [
        event('turn/start', { turn: 1 }),
        event('turn/end', { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } }),
      ],
    }
    const { resumer, prompts } = harness({ sessions: [summary('done'), summary('user')], logs })
    expect((await resumer.run()).resumed).toBe(0)
    expect(prompts).toEqual([])
  })

  test('caps resumes per boot', async () => {
    const logs = { a: shutdownLog(), b: shutdownLog(), c: shutdownLog() }
    const { resumer, prompts } = harness({
      sessions: [summary('a'), summary('b'), summary('c')],
      logs,
      maxSessions: 2,
    })
    const report = await resumer.run()
    expect(report.resumed).toBe(2)
    expect(prompts).toHaveLength(2)
  })

  test('repeated interruptions of one session stop at the attempt cap', async () => {
    const first = harness({ sessions: [summary('s1')], logs: { s1: shutdownLog(1) } })
    await first.resumer.run()
    expect(first.prompts).toHaveLength(1)

    // Each restart leaves a new tail seq; only the attempt cap stops the loop.
    for (const turn of [2, 3]) {
      const next = harness({ sessions: [summary('s1')], logs: { s1: shutdownLog(turn) }, ledger: first.ledger })
      await next.resumer.run()
      expect(next.prompts).toHaveLength(1)
    }
    const capped = harness({ sessions: [summary('s1')], logs: { s1: shutdownLog(4) }, ledger: first.ledger })
    await capped.resumer.run()
    expect(capped.prompts).toHaveLength(0)
  })

  test('request ids and continuation text are deterministic', () => {
    expect(resumeRequestId('s1', 42)).toBe('totem-resume:s1:42')
    expect(continuationPrompt('shutdown')).toContain('graceful shutdown')
    expect(continuationPrompt('crash')).toContain('crash')
  })
})
