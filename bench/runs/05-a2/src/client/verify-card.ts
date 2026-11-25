/**
 * Deterministic verify findings for one turn.
 *
 * The Host runs the rules at turn end (see `src/verify-lane.ts`); this module
 * only reads the result back for the in-chat card and the settings tab.
 *
 * @module dsh-totem/client/verify-card
 */
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

/** One deterministic finding. */
export interface VerifyFinding {
  rule: string
  severity: string
  detail: string
  tool?: string
  path?: string
  source?: string
}

/** One turn's verification result. */
export interface VerifyResult {
  session: string
  turn: number
  at: string
  ms: number
  findings: VerifyFinding[]
  command?: { ran: boolean; ok: boolean; ms: number }
}

/** One rule, as listed in the settings tab. */
export interface VerifyRuleRow {
  id: string
  severity: string
  description: string
}

interface VerifyConfig {
  apiToken?: string
  verifyCommand?: string
  verifyDisable?: string[]
}

/** How long one response serves every card on the page. */
const CACHE_MS = 600

/** Reads a turn's findings and the rule catalogue. */
export class VerifyController {
  private cache = new Map<number, { at: number; result: VerifyResult | null }>()

  constructor(private readonly form: SettingsFormScope<VerifyConfig>) {}

  private token(): string {
    return (this.form.getSnapshot().value as VerifyConfig | undefined)?.apiToken?.trim() ?? ''
  }

  private async request<T>(path: string): Promise<T | undefined> {
    const token = this.token()
    if (token.length === 0) return undefined
    try {
      const response = await fetch(`/totem${path}`, { headers: { authorization: `Bearer ${token}` } })
      if (!response.ok) return undefined
      return await response.json() as T
    } catch {
      return undefined
    }
  }

  /** Findings for one turn; a closed turn's card fetches once and keeps it. */
  lookupTurn = async (turn: number): Promise<VerifyResult | null> => {
    const hit = this.cache.get(turn)
    if (hit !== undefined && Date.now() - hit.at < CACHE_MS) return hit.result
    const data = await this.request<{ result?: VerifyResult | null }>(`/verify?turn=${turn}`)
    const result = data?.result ?? null
    this.cache.set(turn, { at: Date.now(), result })
    return result
  }

  /** The rule catalogue plus the current command/disable settings. */
  async rules(): Promise<{ rules: VerifyRuleRow[]; command: string; disable: string[] }> {
    const data = await this.request<{
      rules?: VerifyRuleRow[]
      settings?: { command?: string; disable?: string[] }
    }>('/verify/rules')
    return {
      rules: data?.rules ?? [],
      command: data?.settings?.command ?? '',
      disable: data?.settings?.disable ?? [],
    }
  }
}
