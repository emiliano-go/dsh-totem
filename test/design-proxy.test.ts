import { describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  canvasUrlFor,
  designPagePath,
  findCanvasRoot,
  normalizePublicUrl,
} from '../src/design-proxy.ts'

describe('design editor proxy', () => {
  test('derives the editor page path from a canvas root', () => {
    const path = designPagePath('/home/eclipse/Documents/GitHub/datryo/designs/datryo-mark')
    expect(path).toBe('/design/C9JNruTAfpBuiwGYg5H_hD/')
  })

  test('keeps different canvases on different paths', () => {
    expect(designPagePath('/tmp/a')).not.toBe(designPagePath('/tmp/b'))
  })

  test('builds a same-origin URL with the configured public origin', () => {
    expect(canvasUrlFor('/tmp/canvas', 'https://dsh.emiliano-go.com/'))
      .toBe(`https://dsh.emiliano-go.com${designPagePath('/tmp/canvas')}`)
    expect(normalizePublicUrl(' https://dsh.emiliano-go.com/ ')).toBe('https://dsh.emiliano-go.com')
  })

  test('finds a recorded canvas by path, folder name, or title', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-design-home-'))
    const root = join(home, 'project', 'designs', 'hero')
    const old = process.env.DSH_HOME
    try {
      process.env.DSH_HOME = home
      await mkdir(root, { recursive: true })
      await mkdir(join(home, 'baoyu-design', 'artifacts'), { recursive: true })
      await writeFile(join(home, 'baoyu-design', 'artifacts', 'one.json'), JSON.stringify({
        root,
        title: 'Hero Canvas',
      }))
      expect(findCanvasRoot(root)).toBe(root)
      expect(findCanvasRoot('hero')).toBe(root)
      expect(findCanvasRoot('Hero Canvas')).toBe(root)
      expect(findCanvasRoot('missing')).toBeUndefined()
    } finally {
      if (old === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = old
      await rm(home, { recursive: true, force: true })
    }
  })
})
