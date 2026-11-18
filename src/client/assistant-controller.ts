/** State controller for the Assistant settings section. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'
import type { VerifyRuleRow } from './verify-card.ts'

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
  dueAt: string
  kind: string
  priority: number
  done: boolean
  snoozedUntil?: string
  next?: { at: string; label: string; priority: number }
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

/** One contradictory memory pair retained for review. */
export interface ConflictRow {
  id: string
  project: string
  itemA: string
  itemB: string
  claimA: string
  claimB: string
  condition: string
  options: string[]
  recommended?: string
  createdAt: string
}

/** Counts shown above the conflict inbox. */
export interface MemorySummary {
  staleItems: number
  staleRatio: number
  openConflicts: number
  durable: number
  total: number
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
  verifyCommand?: string
  verifyDisable?: string[]
}

export type AssistantTab =
  | 'memory'
  | 'candidates'
  | 'conflicts'
  | 'reminders'
  | 'watches'
  | 'notifications'
  | 'verify'
  | 'server'

/** Live host facts shown by the Server tab. */
export interface HostStatus {
  pid: number
  busy: boolean
  launcher: string | null
  /** Stable browser login link, valid across restarts. */
  loginUrl?: string | null
  /** PNG data URL for the login link, when the host could render one. */
  loginQr?: string | null
}

/** Snapshot rendered by the section. */
export interface AssistantState {
  tab: AssistantTab
  project: string
  query: string
  memories: MemoryRow[]
  candidates: CandidateRow[]
  conflicts: ConflictRow[]
  conflictSummary: MemorySummary | null
  reminders: ReminderRow[]
  watches: WatchRow[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  notice: string | null
  config: AssistantConfig
  writing: boolean
  verifyRules: VerifyRuleRow[]
  verifyCommand: string
  verifyDisable: string
  host: HostStatus | null
  restarting: boolean
  restartMessage: string | null
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
  resolveConflict: (id: string, resolution: string) => void
  snooze: (id: string, minutes: number) => void
  doneReminder: (id: string) => void
  ackReminder: (id: string) => void
  cancelReminder: (id: string) => void
  runWatch: (id: string) => void
  cancelWatch: (id: string) => void
  addWatch: (draft: { kind: string; url: string; condition: string; interval: string }) => void
  saveConfig: (values: AssistantConfig) => void
  saveVerify: (command: string, disable: string) => void
  testNotification: () => void
  restartServer: () => void
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
  private conflicts: ConflictRow[] = []
  private conflictSummary: MemorySummary | null = null
  private reminders: ReminderRow[] = []
  private watches: WatchRow[] = []
  private verifyRules: VerifyRuleRow[] = []
  private verifyCommand = ''
  private verifyDisable = ''
  private host: HostStatus | null = null
  private restarting = false
  private restartMessage: string | null = null
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
      resolveConflict: (id, resolution) => {
        void this.action(`/conflicts/${encodeURIComponent(id)}/resolve`, 'Conflict resolved.', { resolution })
      },
      snooze: (id, minutes) => { void this.action(`/reminders/${encodeURIComponent(id)}/snooze`, 'Reminder snoozed.', { minutes }) },
      doneReminder: id => { void this.action(`/reminders/${encodeURIComponent(id)}/done`, 'Reminder done.') },
      ackReminder: id => { void this.action(`/reminders/${encodeURIComponent(id)}/ack`, 'Notification acknowledged.') },
      cancelReminder: id => { void this.action(`/reminders/${encodeURIComponent(id)}/cancel`, 'Reminder canceled.') },
      runWatch: id => { void this.action(`/watches/${encodeURIComponent(id)}/run`, 'Watch checked.') },
      cancelWatch: id => { void this.action(`/watches/${encodeURIComponent(id)}/cancel`, 'Watch stopped.') },
      addWatch: draft => { void this.addWatch(draft) },
      saveConfig: values => { void this.saveConfig(values) },
      saveVerify: (command, disable) => { void this.saveVerify(command, disable) },
      testNotification: () => { void this.testNotification() },
      restartServer: () => { void this.restartServer() },
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
      conflicts: this.conflicts,
      conflictSummary: this.conflictSummary,
      reminders: this.reminders,
      watches: this.watches,
      status: this.status,
      error: this.error,
      notice: this.notice,
      config: this.config(),
      writing: this.writing,
      verifyRules: this.verifyRules,
      verifyCommand: this.verifyCommand,
      verifyDisable: this.verifyDisable,
      host: this.host,
      restarting: this.restarting,
      restartMessage: this.restartMessage,
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
      }
      else if (this.tab === 'conflicts') {
        const params = new URLSearchParams()
        if (this.project.length > 0) params.set('project', this.project)
        const data = await this.request<{ items: ConflictRow[]; summary?: MemorySummary }>(`/conflicts?${params.toString()}`)
        this.conflicts = data.items
        this.conflictSummary = data.summary ?? null
      } else if (this.tab === 'reminders') {
        const data = await this.request<{ items: ReminderRow[] }>('/reminders')
        this.reminders = data.items.filter(item => !item.done)
      } else if (this.tab === 'watches') {
        const data = await this.request<{ items: WatchRow[] }>('/watches')
        this.watches = data.items
      } else if (this.tab === 'verify') {
        const data = await this.request<{
          rules: VerifyRuleRow[]
          settings: { command: string; disable: string[] }
        }>('/verify/rules')
        this.verifyRules = data.rules
        this.verifyCommand = data.settings.command
        this.verifyDisable = data.settings.disable.join(', ')
      } else if (this.tab === 'server') {
        this.host = await this.request<HostStatus>('/host')
      }
      this.status = 'ready'
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      this.status = 'error'
    }
    this.publish()
  }

  /**
   * Ask the host to relaunch itself, wait for the new process, then reload.
   *
   * The reload is what puts the browser on the new host: the websocket dies
   * with the old process, and polling `/host` is the only signal that the
   * replacement is actually serving. The pid comparison matters — while the
   * old process drains, its own `/host` still answers and would look healthy.
   */
  private async restartServer(): Promise<void> {
    if (this.restarting) return
    this.restarting = true
    this.error = null
    this.restartMessage = 'Scheduling the restart…'
    this.publish()
    try {
      const before = this.host ?? await this.request<HostStatus>('/host')
      this.host = before
      const { plan } = await this.request<{ plan: { mode: 'now' | 'idle' } }>('/restart', {
        method: 'POST',
        body: JSON.stringify({ idle: true }),
      })
      this.restartMessage = plan.mode === 'idle'
        ? 'Waiting for the running turn to finish…'
        : 'Restarting the host…'
      this.publish()
      await this.waitForNewHost(before.pid)
      this.restartMessage = 'Host is back — reloading…'
      this.publish()
      const location = (globalThis as { location?: { reload: () => void } }).location
      location?.reload()
    } catch (error) {
      this.restarting = false
      this.restartMessage = null
      this.error = error instanceof Error ? error.message : String(error)
      this.publish()
    }
  }

  /**
   * Poll until a different host answers.
   * @param pid - pid of the host being replaced.
   */
  private async waitForNewHost(pid: number): Promise<void> {
    const deadline = Date.now() + 120_000
    let sawDown = false
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1_000))
      try {
        const host = await this.request<HostStatus>('/host')
        if (host.pid !== pid) return
      } catch {
        sawDown = true
      }
    }
    throw new Error(sawDown
      ? 'the host went down but did not come back within two minutes'
      : 'the host did not restart within two minutes')
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

  private async saveVerify(command: string, disable: string): Promise<void> {
    const snapshot = this.form.getSnapshot()
    const ids = disable.split(',').map(part => part.trim()).filter(Boolean)
    this.writing = true
    this.publish()
    const ok = await this.form.mutate([
      { op: 'set' as const, path: ['verifyCommand'], value: command as never },
      { op: 'set' as const, path: ['verifyDisable'], value: ids as never },
    ], snapshot.revision)
    this.writing = false
    this.verifyCommand = command
    this.verifyDisable = ids.join(', ')
    this.notice = ok ? 'Verification settings saved.' : null
    this.error = ok ? null : 'The Host did not accept the verification settings.'
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
