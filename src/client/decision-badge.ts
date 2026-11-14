/** Fetches the Laya decision recorded for one assistant message. */
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

/** One recorded decision. */
export interface LayaDecision {
  verdict: string
  composite: number | null
  at: string
  session: string
  turn: number
}

interface BadgeConfig {
  apiToken?: string
}

/** Lookup face used by the assistant-message badge. */
export class DecisionBadgeController {
  constructor(private readonly form: SettingsFormScope<BadgeConfig>) {}

  /** Read the decision for one message id, or null when none is recorded yet. */
  lookup = async (messageId: string): Promise<LayaDecision | null> => {
    const token = (this.form.getSnapshot().value as BadgeConfig | undefined)?.apiToken?.trim() ?? ''
    if (token.length === 0 || messageId.length === 0) return null
    try {
      const response = await fetch(`/totem/decisions?message=${encodeURIComponent(messageId)}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) return null
      const data = await response.json() as { decision?: LayaDecision | null }
      return data.decision ?? null
    } catch {
      return null
    }
  }
}
