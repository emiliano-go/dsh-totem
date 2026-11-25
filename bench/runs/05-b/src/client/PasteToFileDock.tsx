import { useEffect } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import {
  pasteFileName,
  pasteMarker,
  shouldOffloadPaste,
  type PasteToFileConfig,
} from './paste-to-file.ts'

interface DraftAttachment {
  id: string
}

interface ConversationFace {
  createDrafts(sessionId: string, files: readonly File[], uploadImages: boolean): readonly DraftAttachment[]
  releaseDraftAttachments(attachments: readonly DraftAttachment[]): void
}

interface InputActionsFace {
  captureInsertion(): unknown
  insertText(text: string, span: unknown): boolean
  addAttachments(ids: readonly string[]): boolean
}

interface DockProps {
  sessionId?: string
  inputActions?: InputActionsFace
}

interface ConfigForm {
  getSnapshot(): { value?: unknown }
}

const DEFAULTS: PasteToFileConfig = { enabled: true, chars: 4_000, lines: 80 }

function readSettings(form: ConfigForm): PasteToFileConfig {
  const value = (form.getSnapshot().value ?? {}) as Record<string, unknown>
  const chars = typeof value.pasteToFileChars === 'number' ? value.pasteToFileChars : DEFAULTS.chars
  const lines = typeof value.pasteToFileLines === 'number' ? value.pasteToFileLines : DEFAULTS.lines
  return {
    enabled: value.pasteToFile !== false,
    chars: Math.max(1, Math.trunc(chars)),
    lines: Math.max(1, Math.trunc(lines)),
  }
}

/**
 * Invisible composer dock that intercepts large plain-text pastes.
 *
 * The listener runs in the capture phase on the document so it sees the paste
 * before Lexical inserts the text. Draft creation and the attachment rail are
 * public conversation APIs; no DSH core patch is involved.
 */
export function registerPasteToFile(ctx: ClientContext): void {
  const form = ctx.configForms.get('totem') as unknown as ConfigForm
  ;(ctx as unknown as {
    inject?: (deps: readonly string[], callback: (inner: unknown) => void) => unknown
  }).inject?.(['conversation'], (inner) => {
    const conversation = (inner as { conversation?: ConversationFace }).conversation
    if (conversation === undefined) return

    const Dock = (props: DockProps): null => {
      const { sessionId, inputActions } = props
      useEffect(() => {
        if (sessionId === undefined || inputActions === undefined) return () => {}
        const onPaste = (event: ClipboardEvent): void => {
          if (event.defaultPrevented) return
          const data = event.clipboardData
          if (data === null) return
          const target = event.target
          if (!(target instanceof HTMLElement) || !target.isContentEditable) return
          if (target.closest('[data-composer-seat]') === null) return
          const text = data.getData('text/plain')
          if (!shouldOffloadPaste(text, data.files.length, readSettings(form))) return

          const name = pasteFileName(new Date())
          const span = inputActions.captureInsertion()
          let drafts: readonly DraftAttachment[]
          try {
            drafts = conversation.createDrafts(
              sessionId,
              [new File([text], name, { type: 'text/plain' })],
              true,
            )
          } catch {
            return
          }
          if (!inputActions.addAttachments(drafts.map(draft => draft.id))) {
            conversation.releaseDraftAttachments(drafts)
            return
          }
          event.preventDefault()
          event.stopImmediatePropagation()
          inputActions.insertText(pasteMarker(text.length, name), span)
        }
        document.addEventListener('paste', onPaste, true)
        return () => document.removeEventListener('paste', onPaste, true)
      }, [form, sessionId, inputActions])
      return null
    }

    ctx.effect(() => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'totem.paste-to-file',
      order: 60,
    } as never, Dock as never)), 'dsh-totem: paste to file')
  })
}
