import { describe, expect, test } from 'bun:test'
import { pasteFileName, pasteMarker, shouldOffloadPaste } from '../src/client/paste-to-file.ts'

const config = { enabled: true, chars: 100, lines: 5 }

describe('paste to file', () => {
  test('offloads only large text pastes', () => {
    expect(shouldOffloadPaste('short', 0, config)).toBe(false)
    expect(shouldOffloadPaste('x'.repeat(99), 0, config)).toBe(false)
    expect(shouldOffloadPaste('x'.repeat(100), 0, config)).toBe(true)
    expect(shouldOffloadPaste(Array.from({ length: 5 }, () => 'x').join('\n'), 0, config)).toBe(true)
    expect(shouldOffloadPaste('x'.repeat(500), 1, config)).toBe(false)
    expect(shouldOffloadPaste('x'.repeat(500), 0, { ...config, enabled: false })).toBe(false)
  })

  test('uses a sortable text filename and a compact marker', () => {
    const name = pasteFileName(new Date(2026, 10, 22, 21, 50, 41))
    expect(name).toBe('pasted-20261122-215041.txt')
    expect(pasteMarker(5001, name)).toBe('[pasted 5,001 chars as pasted-20261122-215041.txt]')
  })
})
