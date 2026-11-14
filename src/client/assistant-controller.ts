/** State controller for the Assistant settings section. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

/** A Totem memory row. */
export interface MemoryRow {
  id?: string
  type?: string
  title?: string
  statement?: string
  tags?: string[]
  status?: string
}

/** A pending turn-distilled memory candidate. */
export interface CandidateRow {
  id: string
  project: string
  type: string
  title: string
  statement: string
  tags: string[]
  createdAt: string
  status: string
}

/** A reminder row. */
export interface ReminderRow {
  id: string
  text: string
  nextAt: string
  recurrence: string
  done: boolean
}

/** A watch row. */
export interface WatchRow {
  id: string
  kind: string
  url: string
  condition?: string
  intervalMinutes: number
  active: boolean
  lastResult?: string
}

/** The notification/config fields edited here. */
export interface AssistantConfig {
  provider?: string
  model?: string
  apiToken?: string
  ntfyUrl?: string
  ntfyTopic?: string
  ntfyToken?: string
  telegramBotToken?: string
  telegramChatId?: string
}

export type AssistantTab = 'memory' | 'candidates' | 'reminders' | 'watches' | 'notifications'

/** Snapshot rendered by the section. */
export interface AssistantState {
  tab: AssistantTab
  project: string
  query: string
  memories: MemoryRow[]
  candidates: CandidateRow[]
  reminders: ReminderRow[]
  watches: WatchRow[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  notice: string | null
  config: AssistantConfig
  writing: boolean
}

/** Registration-side face for the section. */
export interface AssistantFace {
  hooks: { assistant: SnapshotStore<AssistantState> }
  setTab: (tab: AssistantTab) => void
  setProject: (project: string) => void
  setQuery: (query: string) => void
  search: () => void
  refresh: () => void
  approve: (id: string) => void
  reject: (id: string) => void
  snooze: (id: string, minutes: number) => void
  doneReminder: (id: string) => void
  cancelReminder: (id: string) => void
  runWatch: (id: string) => void
  cancelWatch: (id: string) => void
  addWatch: (draft: { kind: string; url: string; condition: string; interval: string }) => void
  saveConfig: (values: AssistantConfig) => void
  testNotification: () => void
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: unknown[] }).items
  }
  return []
}

/** Fetch, mutate, and project the assistant data together. */
export class AssistantController {
  private readonly store: SnapshotStore<AssistantState>
  private readonly unsubscribe: () => void
  private tab: AssistantTab = 'memory'
  private project = ''
  private query = ''
  private memories: MemoryRow[] = []
  private candidates: CandidateRow[] = []
  private reminders: ReminderRow[] = []
  private watches: WatchRow[] = []
  private status: AssistantState['status'] = 'idle'
  private error: string | null = null
  private notice: string | null = null
  private writing = false
  private disposed = false

  constructor(
    private readonly form: SettingsFormScope<AssistantConfig>,
    private readonly ctx: ClientContext,
  ) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = form.subscribe(() => { this.publish() })
    void this.loadState()
  }

  /** Stop observing settings. */
  dispose(): void {
    this.disposed = true
    this.unsubscribe()
  }

  /** Build the renderer face. */
  inject(): AssistantFace {
    return {
      hooks: { assistant: this.store },
      setTab: tab => { this.setTab(tab) },
      setProject: project => { this.project = project; this.publish() },
      setQuery: query => { this.query = query; this.publish() },
      search: () => { void this.search() },
      refresh: () => { void this.refresh() },
      approve: id => { void this.action(`/candidates/${encodeURIComponent(id)}/approve`, 'Memory approved.') },
      reject: id => { void this.action(`/candidates/${encodeURIComponent(id)}/reject`, 'Candidate rejected.') },
      snooze: (id, minutes) => { void this.action(`/reminders/${encodeURIComponent(id)}/snooze`, 'Reminder snoozed.', { minutes }) },
      doneReminder: id => { void this.action(`/reminders/${encodeURIComponent(id)}/done`, 'Reminder done.') },
      cancelReminder: id => { void this.action(`/reminders/${encodeURIComponent(id)}/cancel`, 'Reminder canceled.') },
      runWatch: id => { void this.action(`/watches/${encodeURIComponent(id)}/run`, 'Watch checked.') },
      cancelWatch: id => { void this.action(`/watches/${encodeURIComponent(id)}/cancel`, 'Watch stopped.') },
      addWatch: draft => { void this.addWatch(draft) },
      saveConfig: values => { void this.saveConfig(values) },
      testNotification: () => { void this.testNotification() },
    }
  }

  private config(): AssistantConfig {
    return (this.form.getSnapshot().value ?? {}) as AssistantConfig
  }

  private token(): string {
    return this.config().apiToken?.trim() ?? ''
  }

  private projection(): AssistantState {
    return {
      tab: this.tab,
      project: this.project,
      query: this.query,
      memories: this.memories,
      candidates: this.candidates,
      reminders: this.reminders,
      watches: this.watches,
      status: this.status,
      error: this.error,
      notice: this.notice,
      config: this.config(),
      writing: this.writing,
    }
  }

  private publish(): void {
    if (this.disposed) return
    this.store.set(this.projection())
  }

  private async loadState(): Promise<void> {
    try {
      const state = await this.request<{ lastProject: string }>('/state')
      if (this.project.length === 0) this.project = state.lastProject ?? ''
      await this.refresh()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.status = 'error'
      this.publish()
    }
  }

  private setTab(tab: AssistantTab): void {
    this.tab = tab
    this.notice = null
    this.error = null
    void this.refresh()
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.token()
    if (token.length === 0) throw new Error('Set the assistant apiToken in the Totem plugin config first.')
    const response = await fetch(`/totem${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${token}`,
        ...init?.body === undefined ? {} : { 'content-type': 'application/json' },
      },
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(detail.error ?? `request failed (${response.status})`)
    }
    return await response.json() as T
  }

  private async refresh(): Promise<void> {
    this.status = 'loading'
    this.error = null
    this.publish()
    try {
      if (this.tab === 'memory') await this.search(false)
      else if (this.tab === 'candidates') {
        const data = await this.request<{ items: CandidateRow[] }>('/candidates')
        this.candidates = data.items.filter(item => item.status === 'pending')
      } else if (this.tab === 'reminders') {
        const data = await this.request<{ items: ReminderRow[] }>('/reminders')
        this.reminders = data.items.filter(item => !item.done)
      } else if (this.tab === 'watches') {
        const data = await this.request<{ items: WatchRow[] }>('/watches')
        this.watches = data.items
      }
      this.status = 'ready'
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.status = 'error'
    }
    this.publish()
  }

  private async search(publishLoading = true): Promise<void> {
    if (publishLoading) {
      this.status = 'loading'
      this.publish()
    }
    const params = new URLSearchParams({ project: this.project, limit: '100' })
    if (this.query.trim().length > 0) params.set('query', this.query.trim())
    const data = await this.request<{ items: MemoryRow[] }>(`/memories?${params.toString()}`)
    this.memories = data.items
    this.status = 'ready'
    this.publish()
  }

  private async action(path: string, notice: string, bodyValue?: Record<string, unknown>): Promise<void> {
    this.writing = true
    this.error = null
    this.publish()
    try {
      await this.request(path, {
        method: 'POST',
        ...bodyValue === undefined ? {} : { body: JSON.stringify(bodyValue) },
      })
      this.notice = notice
      await this.refresh()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.status = 'error'
      this.publish()
    } finally {
      this.writing = false
      this.publish()
    }
  }

  private async addWatch(draft: { kind: string; url: string; condition: string; interval: string }): Promise<void> {
    const interval = Number(draft.interval)
    this.writing = true
    this.error = null
    this.publish()
    try {
      await this.request('/watches', {
        method: 'POST',
        body: JSON.stringify({
          kind: draft.kind,
          url: draft.url,
          condition: draft.condition,
          intervalMinutes: Number.isFinite(interval) && interval > 0 ? interval : 15,
        }),
      })
      this.notice = 'Watch added.'
      await this.refresh()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.status = 'error'
    } finally {
      this.writing = false
      this.publish()
    }
  }

  private async saveConfig(values: AssistantConfig): Promise<void> {
    const snapshot = this.form.getSnapshot()
    const fields: (keyof AssistantConfig)[] = [
      'ntfyUrl', 'ntfyTopic', 'ntfyToken', 'telegramBotToken', 'telegramChatId',
    ]
    this.writing = true
    this.publish()
    const ok = await this.form.mutate(fields.map(field => ({
      op: 'set' as const,
      path: [field],
      value: (values[field] ?? '') as never,
    })), snapshot.revision)
    this.writing = false
    this.notice = ok ? 'Notification settings saved.' : null
    this.error = ok ? null : 'The Host did not accept the notification settings.'
    this.publish()
  }

  private async testNotification(): Promise<void> {
    this.writing = true
    this.publish()
    try {
      const result = await this.request('/notify-test', {
        method: 'POST',
        body: JSON.stringify({ title: 'dsh-totem', message: 'Notifications are configured correctly.' }),
      })
      this.notice = `Test sent: ${JSON.stringify(result)}`
      this.error = null
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    } finally {
      this.writing = false
      this.publish()
    }
  }
}
