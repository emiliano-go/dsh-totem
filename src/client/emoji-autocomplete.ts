/**
 * Emoji autocomplete for the DSH composer.
 *
 * Typing `:` (or `:par`) in the contenteditable composer opens a small picker
 * of matching shortcodes. Up/Down move, Enter/Tab insert the Unicode emoji,
 * Escape closes. Insertion goes through the DOM selection and dispatches an
 * `input` event so the composer's React state stays in sync.
 *
 * @module dsh-totem/client/emoji-autocomplete
 */
import emojiData from 'emojilib'
import { EMOJI_ALIASES } from './emoji.ts'

/** Extra aliases that exist for the picker only (the renderer resolves the rest). */
const AUTOCOMPLETE_ALIASES: Record<string, string> = {
  ...EMOJI_ALIASES,
  tada: 'party_popper',
}

/** One suggestion row. */
export interface EmojiSuggestion {
  name: string
  emoji: string
  keywords: readonly string[]
  /** True for a compatibility alias such as `wilted_rose`. */
  alias?: boolean
}

/** Frequently used emoji shown for a bare `:`. */
const POPULAR = [
  'smile', 'heart', 'tada', 'rocket', 'fire', 'thumbsup', 'eyes', 'sparkles',
  'wilted_flower', 'sob', 'joy', 'pray',
]

const entries: EmojiSuggestion[] = Object.entries(emojiData).map(([emoji, keywords]) => ({
  name: keywords[0] ?? '',
  emoji,
  keywords: keywords.slice(1),
})).filter(entry => entry.name.length > 0)

const byName = new Map(entries.map(entry => [entry.name, entry]))
for (const [alias, target] of Object.entries(AUTOCOMPLETE_ALIASES)) {
  const entry = byName.get(target)
  if (entry !== undefined) {
    const aliasEntry = { ...entry, name: alias, keywords: [...entry.keywords, target], alias: true }
    entries.push(aliasEntry)
    byName.set(alias, aliasEntry)
  }
}

/** Rank shortcode suggestions for a partial query. */
export function suggestEmoji(query: string, limit = 8): EmojiSuggestion[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    const popular = POPULAR.flatMap((name) => {
      const entry = byName.get(name)
      return entry === undefined ? [] : [entry]
    })
    return popular.slice(0, limit)
  }
  const scored: { entry: EmojiSuggestion; score: number }[] = []
  for (const entry of entries) {
    const name = entry.name
    let score = -1
    if (name === needle) score = 10_000
    else if (name.startsWith(needle)) score = 8_000 - name.length
    else if (name.includes(needle)) score = 5_000 - name.indexOf(needle)
    else if (entry.keywords.some(keyword => keyword === needle)) score = 4_000
    else if (entry.keywords.some(keyword => keyword.startsWith(needle))) score = 3_000
    else if (entry.keywords.some(keyword => keyword.includes(needle))) score = 1_000
    // A compatibility alias never outranks the canonical name for the same
    // match class, while an exact alias (`wilted_rose`) still wins outright.
    if (entry.alias === true) score -= 250
    if (score >= 0) scored.push({ entry, score })
  }
  return scored
    .sort((left, right) => right.score - left.score
      || Number(left.entry.alias ?? false) - Number(right.entry.alias ?? false)
      || left.entry.name.length - right.entry.name.length
      || left.entry.name.localeCompare(right.entry.name))
    .slice(0, limit)
    .map(item => item.entry)
}

interface Token {
  node: Text
  start: number
  end: number
  query: string
  editable: HTMLElement
}

/** The slice of a Lexical editor this picker needs. */
interface LexicalEditorLike {
  dispatchCommand: (command: { type: string }, payload?: unknown) => boolean
  _commands?: Map<{ type?: string }, unknown>
}

/** Walk up from a composer text node to the Lexical editor bound to its root. */
export function lexicalEditorOf(node: Node): LexicalEditorLike | undefined {
  let element = node.parentElement
  while (element !== null) {
    const editor = (element as unknown as { __lexicalEditor?: LexicalEditorLike }).__lexicalEditor
    if (typeof editor?.dispatchCommand === 'function') return editor
    element = element.parentElement
  }
  return undefined
}

/**
 * Replace the typed `:query` with the chosen emoji through Lexical commands.
 * @param editor - composer editor bound to the contenteditable root.
 * @param query - shortcode text after the colon.
 * @param emoji - Unicode emoji to insert.
 */
export function insertEmojiViaEditor(editor: LexicalEditorLike, query: string, emoji: string): void {
  // Lexical keys its command registry by command OBJECT identity, so a plain
  // `{ type }` object is ignored. Reuse the exact command instances the editor
  // registered, found by their type string.
  const registered = (type: string): { type: string } => {
    for (const command of editor._commands?.keys() ?? []) {
      if (command.type === type) return command as { type: string }
    }
    return { type }
  }
  const deleteCommand = registered('DELETE_CHARACTER_COMMAND')
  const insertCommand = registered('CONTROLLED_TEXT_INSERTION_COMMAND')
  for (let index = 0; index < query.length + 1; index += 1) {
    editor.dispatchCommand(deleteCommand, true)
  }
  editor.dispatchCommand(insertCommand, emoji)
}

/**
 * Colours for the current DSH theme. DSH sets theme aliases on the root when
 * available; otherwise the page background decides light vs dark.
 */
function themeColors(doc: Document): {
  background: string
  color: string
  border: string
  hover: string
  shadow: string
  scheme: 'light' | 'dark'
} {
  const root = getComputedStyle(doc.documentElement)
  const pick = (name: string): string => root.getPropertyValue(name).trim()
  const match = /rgba?\(([^)]+)\)/u.exec(getComputedStyle(doc.body).backgroundColor)
  const channels = match?.[1].split(',').map(part => Number.parseFloat(part.trim())) ?? [255, 255, 255, 1]
  const alpha = channels[3] ?? 1
  const luminance = 0.2126 * (channels[0] ?? 255) + 0.7152 * (channels[1] ?? 255) + 0.0722 * (channels[2] ?? 255)
  const light = alpha > 0 ? luminance > 128 : !matchMedia('(prefers-color-scheme: dark)').matches
  return {
    background: pick('--dsw-alias-bg-layer-2') || (light ? '#ffffff' : '#1b1b1f'),
    color: pick('--dsw-alias-label-primary') || (light ? '#0f1115' : '#f2f2f2'),
    border: pick('--dsw-alias-border-l2') || (light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.18)'),
    hover: pick('--dsw-alias-interactive-bg-hover') || (light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.10)'),
    shadow: light ? '0 12px 32px rgba(0,0,0,.16)' : '0 12px 32px rgba(0,0,0,.45)',
    scheme: light ? 'light' : 'dark',
  }
}

function tokenAtCaret(doc: Document): Token | undefined {
  const selection = doc.getSelection()
  if (selection === null || !selection.isCollapsed || selection.rangeCount === 0) return undefined
  const node = selection.anchorNode
  if (node === null || node.nodeType !== Node.TEXT_NODE) return undefined
  const editable = (node.parentElement?.closest('[contenteditable="true"]') ?? null) as HTMLElement | null
  if (editable === null) return undefined
  if (editable.closest('[data-slot="conversation.composer.bar"]') === null && editable.getAttribute('role') !== 'textbox') return undefined
  const text = node.nodeValue ?? ''
  const end = selection.anchorOffset
  const before = text.slice(0, end)
  const match = /(?:^|[\s(]):([a-z0-9_+-]{0,40})$/iu.exec(before)
  if (match === null) return undefined
  const query = match[1] ?? ''
  return { node: node as Text, start: end - query.length - 1, end, query, editable }
}

/**
 * Install the composer autocomplete. Returns a disposer; a missing `document`
 * makes it a no-op.
 */
export function installEmojiAutocomplete(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): () => void {
  if (doc === undefined || doc.body === null) return () => {}
  let popup: HTMLDivElement | undefined
  let suggestions: EmojiSuggestion[] = []
  let active = 0
  let token: Token | undefined

  const close = () => {
    popup?.remove()
    popup = undefined
    suggestions = []
    token = undefined
  }

  const accept = () => {
    if (token === undefined) return
    const entry = suggestions[active]
    if (entry === undefined) return
    // The DSH composer is Lexical. Mutating its DOM by hand and dispatching a
    // plain `input` event desynchronises the editor state, and the next
    // reconciliation wipes the draft. Drive the editor's own commands instead:
    // backspace the `:query` from the live caret, then insert the emoji.
    const editor = lexicalEditorOf(token.node)
    if (editor !== undefined) {
      insertEmojiViaEditor(editor, token.query, entry.emoji)
      close()
      return
    }
    // Plain contenteditable fallback (no Lexical root found).
    const selection = doc.getSelection()
    if (selection === null) return
    const range = doc.createRange()
    range.setStart(token.node, token.start)
    range.setEnd(token.node, token.end)
    range.deleteContents()
    const inserted = doc.createTextNode(entry.emoji)
    range.insertNode(inserted)
    const caret = doc.createRange()
    caret.setStart(inserted, inserted.length)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)
    token.editable.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: entry.emoji,
    }))
    close()
  }

  const paint = () => {
    if (popup === undefined || token === undefined) return
    const colors = themeColors(doc)
    const selection = doc.getSelection()
    if (selection === null || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0).cloneRange()
    range.collapse(true)
    let rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) rect = token.editable.getBoundingClientRect()
    popup.replaceChildren(...suggestions.map((entry, index) => {
      const row = doc.createElement('button')
      row.type = 'button'
      row.dataset.index = String(index)
      row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:8px', 'width:100%',
        'padding:6px 8px', 'border:0', 'border-radius:6px', 'cursor:pointer',
        'background:' + (index === active ? colors.hover : 'transparent'),
        'color:inherit', 'font:inherit', 'text-align:left',
      ].join(';')
      const glyph = doc.createElement('span')
      glyph.textContent = entry.emoji
      glyph.style.cssText = 'font-size:18px;line-height:1'
      const label = doc.createElement('span')
      label.textContent = `:${entry.name}:`
      label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
      row.append(glyph, label)
      row.addEventListener('mousedown', (event) => { event.preventDefault() })
      row.addEventListener('click', (event) => {
        event.preventDefault()
        active = index
        accept()
      })
      return row
    }))
    popup.style.background = colors.background
    popup.style.color = colors.color
    popup.style.border = `1px solid ${colors.border}`
    popup.style.boxShadow = colors.shadow
    popup.style.colorScheme = colors.scheme
    popup.style.top = `${rect.bottom + 6}px`
    const maxLeft = (doc.defaultView?.innerWidth ?? 0) - 268
    popup.style.left = `${Math.max(8, Math.min(rect.left, maxLeft))}px`
    const height = popup.offsetHeight
    if (rect.bottom + 6 + height > (doc.defaultView?.innerHeight ?? 0) - 8) {
      popup.style.top = `${Math.max(8, rect.top - height - 6)}px`
    }
  }

  const update = () => {
    token = tokenAtCaret(doc)
    if (token === undefined) {
      close()
      return
    }
    suggestions = suggestEmoji(token.query)
    if (suggestions.length === 0) {
      close()
      return
    }
    active = Math.min(active, suggestions.length - 1)
    if (popup === undefined) {
      popup = doc.createElement('div')
      popup.setAttribute('role', 'listbox')
      popup.setAttribute('aria-label', 'Emoji suggestions')
      popup.style.cssText = [
        'position:fixed', 'z-index:2147483000', 'width:260px', 'max-height:280px',
        'overflow:auto', 'padding:4px', 'border-radius:10px',
        'font:13px/1.4 system-ui,sans-serif',
      ].join(';')
      doc.body.append(popup)
    }
    paint()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (popup === undefined || event.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      active = (active + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length
      paint()
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      accept()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  const onInput = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.isContentEditable) return
    update()
  }

  const onPointerDown = (event: Event) => {
    if (popup === undefined) return
    if (event.target instanceof Node && popup.contains(event.target)) return
    close()
  }

  const onScroll = () => { if (popup !== undefined) paint() }

  doc.addEventListener('input', onInput, true)
  doc.addEventListener('keydown', onKeyDown, true)
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('selectionchange', update)
  doc.defaultView?.addEventListener('scroll', onScroll, true)

  return () => {
    doc.removeEventListener('input', onInput, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('selectionchange', update)
    doc.defaultView?.removeEventListener('scroll', onScroll, true)
    close()
  }
}
