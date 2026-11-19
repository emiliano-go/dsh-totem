import { describe, expect, test } from 'bun:test'
import { replaceShortcodes } from '../src/client/emoji.ts'

describe('emoji shortcodes', () => {
  test('renders canonical aliases', () => {
    expect(replaceShortcodes(':tada:')).toBe('🎉')
    expect(replaceShortcodes('ship it :rocket:')).toBe('ship it 🚀')
  })

  test('maps aliases DSH users type', () => {
    expect(replaceShortcodes(':wilted_rose:')).toBe('🥀')
    expect(replaceShortcodes(':thinking:')).toBe('🤔')
  })

  test('leaves unknown and code-like text alone', () => {
    expect(replaceShortcodes(':not_a_real_emoji_xyz:')).toBe(':not_a_real_emoji_xyz:')
    expect(replaceShortcodes('time 12:30:45')).toBe('time 12:30:45')
  })
})
