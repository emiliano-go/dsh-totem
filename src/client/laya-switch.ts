/** Laya switch state: status polling and enable/disable over the authenticated route. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFormScope } from '@deepseek-ai/dsh-client-ui-primitives'

/** Settings value shape used only for the shared API token. */
interface SwitchConfig {
  apiToken?: string
}

/** Rendered switch state. */
export interface LayaSwitchState {
  enabled: boolean
  healthy: boolean
  loaded: boolean
  busy: boolean
  error: string | null
}

/** Face exposed to the composer switch. */
export interface LayaSwitchFace {
  hooks: { layaSwitch: SnapshotStore<LayaSwitchState> }
  toggle: () => void
  refresh: () => void
}

/** Polls the Host route and toggles the managed laya server. */
export class LayaSwitchController {
  private readonly store: SnapshotStore<LayaSwitchState>
  private readonly unsubscribe: () => void
  private readonly timer: ReturnType<typeof setInterval>
  private disposed = false

  constructor(
    private readonly form: SettingsFormScope<SwitchConfig>,
    private readonly ctx: ClientContext,
  ) {
    this.store = createSnapshotStore({ enabled: false, healthy: false, loaded: false, busy: false, error: null })
    this.unsubscribe = form.subscribe(() => { this.publish() })
    this.timer = setInterval(() => { void this.refresh() }, 5000)
    void this.refresh()
  }

  dispose(): void {
    this.disposed = true
    clearInterval(this.timer)
    this.unsubscribe()
  }

  inject(): LayaSwitchFace {
    return {
      hooks: { layaSwitch: this.store },
      toggle: () => { void this.toggle() },
      refresh: () => { void this.refresh() },
    }
  }

  private token(): string {
    return (this.form.getSnapshot().value as SwitchConfig | undefined)?.apiToken?.trim() ?? ''
  }

  private publish(): void {
    if (!this.disposed) this.store.set(this.store.getSnapshot())
  }

  private update(patch: Partial<LayaSwitchState>): void {
    if (this.disposed) return
    this.store.set({ ...this.store.getSnapshot(), ...patch })
  }

  private async request<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
    const token = this.token()
    if (token.length === 0) throw new Error('Set the assistant apiToken in the Totem plugin config first.')
    const response = await fetch(`/totem${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(detail.error ?? `request failed (${response.status})`)
    }
    return await response.json() as T
  }

  private async refresh(): Promise<void> {
    try {
      const status = await this.request<{ enabled: boolean; healthy: boolean; loaded: boolean }>('/laya/status', 'GET')
      this.update({ enabled: status.enabled, healthy: status.healthy, loaded: status.loaded, error: null })
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) })
    }
  }

  private async toggle(): Promise<void> {
    if (this.store.getSnapshot().busy) return
    const next = !this.store.getSnapshot().enabled
    this.update({ busy: true, enabled: next, loaded: false, error: null })
    try {
      const status = await this.request<{ enabled: boolean; healthy: boolean; loaded: boolean }>(
        next ? '/laya/enable' : '/laya/disable',
        'POST',
      )
      this.update({ enabled: status.enabled, healthy: status.healthy, loaded: status.loaded, busy: false })
    } catch (error) {
      this.update({ busy: false, error: error instanceof Error ? error.message : String(error) })
      void this.refresh()
    }
  }
}
