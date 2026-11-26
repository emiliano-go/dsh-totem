/** Shared approval queue: polls the tracker and feeds the Overview page and its sidebar dot. */
export interface ApprovalItem {
  key: string
  kind: string
  repo: string
  title: string
  draft: string
  url: string
  attempts: number
  queued?: boolean
  lastError?: string
}

export interface ApprovalsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: ApprovalItem[]
  error: string
}

type Listener = (state: ApprovalsState) => void

const POLL_MS = 30_000

class ApprovalsStore {
  private state: ApprovalsState = { status: 'idle', items: [], error: '' }
  private readonly listeners = new Set<Listener>()
  private timer: ReturnType<typeof setInterval> | undefined
  private token: () => string = () => ''
  private inFlight = false
  private retry: ReturnType<typeof setTimeout> | undefined

  /** Point the store at the Totem settings token. */
  configure(token: () => string): void {
    this.token = token
  }

  /** Poll once and then keep the queue fresh for the sidebar dot. */
  start(): void {
    if (this.timer !== undefined) return
    void this.refresh()
    this.timer = setInterval(() => { void this.refresh() }, POLL_MS)
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    if (this.retry !== undefined) clearTimeout(this.retry)
    this.timer = undefined
    this.retry = undefined
  }

  getState(): ApprovalsState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(patch: Partial<ApprovalsState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }

  async refresh(): Promise<void> {
    if (this.inFlight) return
    // The settings document can arrive after the first paint; polling with an
    // empty token only produces a misleading "unauthorized".
    if (!this.token()) {
      this.emit({ status: 'loading' })
      if (this.retry !== undefined) clearTimeout(this.retry)
      this.retry = setTimeout(() => { void this.refresh() }, 1500)
      return
    }
    this.inFlight = true
    try {
      const response = await fetch('/totem/approvals', {
        headers: { authorization: `Bearer ${this.token()}` },
      })
      const body = (await response.json()) as { pending?: ApprovalItem[]; error?: string }
      if (!response.ok) {
        this.emit({ status: 'error', error: body.error || `HTTP ${response.status}` })
        return
      }
      this.emit({ status: 'ready', items: body.pending ?? [], error: '' })
    } catch (cause) {
      this.emit({ status: 'error', error: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      this.inFlight = false
    }
  }

  async enqueue(note: string, url: string): Promise<boolean> {
    try {
      const response = await fetch('/totem/approvals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token()}` },
        body: JSON.stringify({ op: 'enqueue', note, url }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        this.emit({ status: 'error', error: body.error || `HTTP ${response.status}` })
        return false
      }
      this.emit({ status: this.state.status === 'error' ? 'ready' : this.state.status, error: '' })
      await this.refresh()
      return true
    } catch (cause) {
      this.emit({ status: 'error', error: cause instanceof Error ? cause.message : String(cause) })
      return false
    }
  }

  async act(key: string, action: 'ok' | 're' | 'no'): Promise<boolean> {
    try {
      const response = await fetch('/totem/approvals', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token()}` },
        body: JSON.stringify({ key, action }),
      })
      if (!response.ok) {
        const body = (await response.json()) as { error?: string }
        this.emit({ status: 'error', error: body.error || `HTTP ${response.status}` })
        return false
      }
      await this.refresh()
      return true
    } catch (cause) {
      this.emit({ status: 'error', error: cause instanceof Error ? cause.message : String(cause) })
      return false
    }
  }
}

export const approvals = new ApprovalsStore()
