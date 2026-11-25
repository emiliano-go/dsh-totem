/** Settings that decide whether a pasted draft becomes a file attachment. */
export interface PasteToFileConfig {
  enabled: boolean
  chars: number
  lines: number
}

/**
 * Whether a plain-text paste is large enough to detach from the prompt.
 *
 * A paste that also carries files is never intercepted: the composer's own
 * attachment intake owns that event.
 */
export function shouldOffloadPaste(text: string, files: number, config: PasteToFileConfig): boolean {
  if (!config.enabled || files > 0 || text.trim().length === 0) return false
  return text.length >= config.chars || text.split('\n').length >= config.lines
}

/** A sortable local-time filename for one detached paste. */
export function pasteFileName(at: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `pasted-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}.txt`
}

/** Short visible note left in the draft beside the attachment chip. */
export function pasteMarker(length: number, name: string): string {
  return `[pasted ${length.toLocaleString('en-US')} chars as ${name}]`
}
