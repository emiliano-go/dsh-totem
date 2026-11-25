import { describe, expect, test } from 'bun:test'
import type { DistillTarget } from '../src/distill.ts'
import { renderCompactionInput, summarizeWithTotem } from '../src/compaction/summarize.ts'

const target: DistillTarget = {
  provider: 'memory-provider',
  model: 'memory-model',
  maxTokens: 2048,
  maxInputBytes: 64000,
  timeoutMs: 15000,
}

describe('compaction summarization', () => {
  test('renders roles, text, and tool calls', () => {
    const text = renderCompactionInput({
      tools: [{ name: 'read' }, { name: 'bash' }],
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Keep the API stable.' }] },
        { role: 'assistant', content: [{ type: 'tool-call', name: 'read', arguments: '{"file_path":"src/a.ts"}' }] },
        { role: 'tool', content: [{ type: 'tool-result', content: 'export const a = 1' }] },
      ],
    }, 64_000)
    expect(text).toContain('Available tools: read, bash')
    expect(text).toContain('USER:\nKeep the API stable.')
    expect(text).toContain('Tool call read({"file_path":"src/a.ts"})')
    expect(text).toContain('Tool result:\nexport const a = 1')
  })

  test('clips oversized transcripts without splitting the budget contract', () => {
    const text = renderCompactionInput({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(5000) }] }],
    }, 1024)
    expect(text).toContain('[transcript truncated at 1024 bytes]')
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(1200)
  })

  test('returns the memory agent text and passes the compact purpose', async () => {
    let seen: { system: string; input: string; purpose: string } | undefined
    const text = await summarizeWithTotem({} as never, target, {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Build the thing.' }] }],
    }, undefined, 'session-a', async (_ctx, _target, system, input, _signal, _session, purpose) => {
      seen = { system, input, purpose }
      return '  A compact.  '
    })
    expect(text).toBe('A compact.')
    expect(seen?.purpose).toBe('totem-compact')
    expect(seen?.system).toContain('Preserve')
    expect(seen?.input).toContain('Build the thing.')
  })

  test('falls back without a target or output', async () => {
    expect(await summarizeWithTotem({} as never, undefined, { messages: [] })).toBeUndefined()
    expect(await summarizeWithTotem({} as never, target, { messages: [] })).toBeUndefined()
    expect(await summarizeWithTotem({} as never, target, {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }],
    }, undefined, undefined, async () => '   ')).toBeUndefined()
  })

  test('a runner failure is not turned into an empty success', async () => {
    const failing = summarizeWithTotem({} as never, target, {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }],
    }, undefined, undefined, async () => { throw new Error('down') })
    await expect(failing).rejects.toThrow('down')
  })
})
