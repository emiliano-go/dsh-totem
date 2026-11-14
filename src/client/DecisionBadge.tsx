/** Small “· Decision <verdict> <composite>” badge in the assistant message actions. */
import { useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { LayaDecision } from './decision-badge.ts'

/** Face injected into the badge. */
export interface DecisionBadgeFace {
  lookup: (messageId: string) => Promise<LayaDecision | null>
}

/** Framework-derived props for the decision badge. */
export type DecisionBadgeProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<DecisionBadgeFace>

/**
 * Poll briefly for the turn's decision, then show it next to the message actions.
 * @param props - message identity and lookup face.
 */
export function DecisionBadge(props: DecisionBadgeProps) {
  const [decision, setDecision] = useState<LayaDecision | null>(null)
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const tick = async (): Promise<void> => {
      const found = await props.lookup(props.messageId)
      if (!active) return
      if (found !== null) {
        setDecision(found)
        return
      }
      if (tries++ < 10) timer = setTimeout(() => { void tick() }, 1500)
    }
    void tick()
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [props.messageId])

  if (decision === null) return null
  const color = decision.verdict === 'pass'
    ? 'var(--dsw-alias-text-success, #46a758)'
    : decision.verdict === 'fail'
      ? 'var(--dsw-alias-text-error, #e5484d)'
      : 'var(--dsw-alias-text-warning, #f5a524)'
  const score = decision.composite === null ? '' : ` ${decision.composite.toFixed(2)}`
  return (
    <span
      title={`Laya decision: ${decision.verdict}${score}`}
      style={{ fontSize: 11, lineHeight: '16px', color, whiteSpace: 'nowrap', userSelect: 'none' }}
    >
      · Decision {decision.verdict}{score}
    </span>
  )
}
