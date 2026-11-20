import { describe, expect, test } from 'bun:test'
import { suggestEmoji } from '../src/client/emoji-autocomplete.ts'

describe('emoji autocomplete', () => {
  test('offers popular emoji for a bare colon', () => {
    const suggestions = suggestEmoji('')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some(item => item.name === 'tada')).toBe(true)
  })

  test('matches names, prefixes and keywords', () => {
    expect(suggestEmoji('tada')[0]?.name).toBe('tada')
    expect(suggestEmoji('wilted')[0]?.name).toBe('wilted_flower')
    expect(suggestEmoji('drooping')[0]?.emoji).toBe('🥀')
  })

  test('accepts the wilted_rose alias', () => {
    const first = suggestEmoji('wilted_rose')[0]
    expect(first?.name).toBe('wilted_rose')
    expect(first?.emoji).toBe('🥀')
  })

  test('returns nothing for an unknown query', () => {
    expect(suggestEmoji('not_a_real_emoji_zzz')).toEqual([])
  })

  test('caps the result count', () => {
    expect(suggestEmoji('a', 5)).toHaveLength(5)
  })
})
