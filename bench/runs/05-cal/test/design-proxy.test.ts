import { describe, expect, test } from 'bun:test'
import { designPagePath } from '../src/design-proxy.ts'

describe('design editor proxy', () => {
  test('derives the editor page path from a canvas root', () => {
    const path = designPagePath('/home/eclipse/Documents/GitHub/datryo/designs/datryo-mark')
    expect(path).toBe('/design/C9JNruTAfpBuiwGYg5H_hD/')
  })

  test('keeps different canvases on different paths', () => {
    expect(designPagePath('/tmp/a')).not.toBe(designPagePath('/tmp/b'))
  })
})
