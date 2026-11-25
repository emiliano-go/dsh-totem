import { describe, expect, test } from 'bun:test'
import { insertEmojiViaEditor, lexicalEditorOf, suggestEmoji } from '../src/client/emoji-autocomplete.ts'

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

  test('walks up from a text node to the Lexical editor on the root', () => {
    const editor = { dispatchCommand: () => true }
    const root = { parentElement: null, __lexicalEditor: editor }
    const span = { parentElement: root }
    const text = { parentElement: span }
    expect(lexicalEditorOf(text as never)).toBe(editor)
  })

  test('replaces the typed query with the emoji through the registered commands', () => {
    const remove = { type: 'DELETE_CHARACTER_COMMAND' }
    const insert = { type: 'CONTROLLED_TEXT_INSERTION_COMMAND' }
    const calls: [unknown, unknown][] = []
    insertEmojiViaEditor({
      _commands: new Map([[remove, true], [insert, true]]),
      dispatchCommand: (command, payload) => {
        calls.push([command, payload])
        return true
      },
    }, 'sm', '😄')
    expect(calls).toEqual([
      [remove, true],
      [remove, true],
      [remove, true],
      [insert, '😄'],
    ])
  })

  test('falls back to plain command descriptors when the registry is hidden', () => {
    const calls: string[] = []
    insertEmojiViaEditor({
      dispatchCommand: (command) => {
        calls.push(command.type)
        return true
      },
    }, ':', '😄')
    expect(calls).toEqual(['DELETE_CHARACTER_COMMAND', 'DELETE_CHARACTER_COMMAND', 'CONTROLLED_TEXT_INSERTION_COMMAND'])
  })
})
