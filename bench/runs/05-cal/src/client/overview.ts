/** Fetches token-usage aggregates for the Overview page. */
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

export type OverviewSource = 'all' | 'dsh' | 'opencode' | 'encoder'

export interface OverviewDay {
  date: string
  tokens: number
  input: number
  output: number
  cacheRead: number
  prompts: number
  sessions: number
}

export interface OverviewData {
  generatedAt: string
  source: OverviewSource
  totals: {
    tokens: number
    input: number
    output: number
    cacheRead: number
    prompts: number
    sessions: number
    activeDays: number
  }
  stats: {
    peak: { date: string; tokens: number }
    longestStreak: number
    currentStreak: number
    avgTokensPerDay: number
    avgPromptsPerDay: number
    avgTokensPerPrompt: number
    avgSessionTokens: number
  }
  models: { provider: string; model: string; tokens: number }[]
  days: OverviewDay[]
  import: {
    importedAt: string | null
    sources: { source: string; path: string; days: number; sessions: number }[]
  }
}

export type OverviewResult =
  | { ok: true; data: OverviewData }
  | { ok: false; reason: 'unauthorized' | 'missing-route' | 'offline' | 'error'; status?: number }

interface OverviewConfig {
  apiToken?: string
}

async function readResult(response: Response): Promise<OverviewResult> {
  if (response.status === 401 || response.status === 403) return { ok: false, reason: 'unauthorized', status: response.status }
  if (response.status === 404) return { ok: false, reason: 'missing-route', status: 404 }
  if (!response.ok) return { ok: false, reason: 'error', status: response.status }
  try {
    return { ok: true, data: await response.json() as OverviewData }
  } catch {
    return { ok: false, reason: 'error', status: response.status }
  }
}

/** Loads the Host's usage overview through the authenticated `/totem` route. */
export class OverviewController {
  constructor(private readonly form: SettingsFormScope<OverviewConfig>) {}

  private token(): string {
    return (this.form.getSnapshot().value as OverviewConfig | undefined)?.apiToken?.trim() ?? ''
  }

  load = async (source: OverviewSource = 'all'): Promise<OverviewResult> => {
    const token = this.token()
    if (token.length === 0) return { ok: false, reason: 'unauthorized' }
    try {
      const response = await fetch(`/totem/overview?source=${encodeURIComponent(source)}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      return await readResult(response)
    } catch {
      return { ok: false, reason: 'offline' }
    }
  }

  importHistory = async (): Promise<OverviewResult> => {
    const token = this.token()
    if (token.length === 0) return { ok: false, reason: 'unauthorized' }
    try {
      const response = await fetch('/totem/overview/import', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: '{}',
      })
      return await readResult(response)
    } catch {
      return { ok: false, reason: 'offline' }
    }
  }
}
