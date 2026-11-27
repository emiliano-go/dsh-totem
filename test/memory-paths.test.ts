import { describe, expect, test } from 'bun:test'
import { ignoreFileMemory } from '../src/memory-paths.ts'

const patterns = ['.spike/**', '.tmp-*/**', 'bench/runs/**', 'designs/**', 'research/**']

describe('memory path filter', () => {
  test('matches scratch directories and files below them', () => {
    expect(ignoreFileMemory('/repo/.spike/spike-1/2/impl.ts', patterns, '/repo')).toBe(true)
    expect(ignoreFileMemory('/repo/.tmp-probe/list-tools.ts', patterns, '/repo')).toBe(true)
    expect(ignoreFileMemory('/repo/bench/runs/07/manifest.json', patterns, '/repo')).toBe(true)
    expect(ignoreFileMemory('/repo/designs/hero/index.html', patterns, '/repo')).toBe(true)
    expect(ignoreFileMemory('/repo/research/paper/report.md', patterns, '/repo')).toBe(true)
  })

  test('keeps source, tests, and benchmark fixtures', () => {
    expect(ignoreFileMemory('/repo/src/service.ts', patterns, '/repo')).toBe(false)
    expect(ignoreFileMemory('/repo/test/service.test.ts', patterns, '/repo')).toBe(false)
    expect(ignoreFileMemory('/repo/bench/fixtures/input.json', patterns, '/repo')).toBe(false)
  })
})
