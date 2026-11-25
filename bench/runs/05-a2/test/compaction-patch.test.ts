import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'bun:test'

describe('generated bundle patch', () => {
  test('replaces every stock compaction backend with the Totem backend', async () => {
    const text = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(text).not.toContain("name: '@deepseek-ai/dsh-compaction-basic'")
    expect(text.match(/name: 'dsh-totem\/compaction'/g)?.length).toBe(4)
    expect(text).toContain("name: '@deepseek-ai/dsh-command-compact'")
    expect(text).toContain("name: '@deepseek-ai/dsh-compaction-tool-result-pruner'")
  })
})
