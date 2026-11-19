/**
 * Emoji shortcode rendering for the chat transcript.
 *
 * DSH renders message text literally, so `:wilted_rose:` stays a shortcode.
 * The Host and the model do not need to change: this client-side pass rewrites
 * known shortcodes in rendered chat text to their Unicode emoji, leaving code
 * blocks, inputs, and the durable message unchanged.
 *
 * @module dsh-totem/client/emoji
 */
import { get } from 'node-emoji'

/** Shortcodes whose names differ from the Unicode/GitHub canonical alias. */
const ALIASES: Record<string, string> = {
  wilted_rose: 'wilted_flower',
}

const SHORTCODE = /:([a-z0-9_+-]+):/gi

/** Replace known `:shortcodes:` with Unicode emoji; unknown ones stay intact. */
export function replaceShortcodes(text: string): string {
  return text.replace(SHORTCODE, (match, name: string) => {
    const key = name.toLowerCase()
    const emoji = get(ALIASES[key] ?? key)
    return emoji ?? match
  })
}

function eligible(node: Text): boolean {
  const parent = node.parentElement
  if (parent === null) return false
  if (parent.closest('pre, code, textarea, input, [contenteditable="true"]') !== null) return false
  // Only the rendered chat rows; sidebar previews and titles stay untouched.
  return parent.closest('[data-chat-flow-key]') !== null
}

/**
 * Observe rendered chat text and rewrite known shortcodes in place.
 *
 * Returns a disposer that disconnects the observer. Safe to call when
 * `document` is unavailable (tests, headless host): it becomes a no-op.
 */
export function installEmojiShortcodes(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): () => void {
  if (doc === undefined || doc.body === null) return () => {}
  const pending = new Set<Text>()
  let scheduled = false

  const flush = () => {
    scheduled = false
    for (const node of pending) {
      const value = node.nodeValue
      if (value === null) continue
      const next = replaceShortcodes(value)
      if (next !== value) node.nodeValue = next
    }
    pending.clear()
  }

  const enqueue = (node: Text) => {
    if (!eligible(node)) return
    pending.add(node)
    if (!scheduled) {
      scheduled = true
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush)
      else queueMicrotask(flush)
    }
  }

  const scan = (scope: Node) => {
    if (scope.nodeType === Node.TEXT_NODE) {
      enqueue(scope as Text)
      return
    }
    const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode()) !== null) enqueue(node as Text)
  }

  scan(doc.body)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        if (record.target.nodeType === Node.TEXT_NODE) enqueue(record.target as Text)
        continue
      }
      for (const node of record.addedNodes) scan(node)
    }
  })
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}
