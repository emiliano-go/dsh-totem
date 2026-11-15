/**
 * Staged editor for the Totem memory model.
 *
 * The card edits the `totem` plugin row's volatile `provider`/`model` fields
 * through the shared settings form, and joins the Host's model catalog so the
 * choice lists every model of every configured provider.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ModelCatalogFailure, ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFormScope, SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'

/** The two volatile fields this page edits on the `totem` row. */
export interface TotemMemorySettings {
  provider?: string
  model?: string
  embeddingBackend?: string
}

/** State rendered by the memory-model card. */
export interface TotemMemoryCardState extends SettingsFormShell {
  /** Route stored in the settings row; `''` means the deployment default. */
  current: string
  /** Route staged in the card; `''` means the deployment default. */
  requested: string
  /** Encoder stored in the settings row. */
  currentBackend: string
  /** Encoder staged in the card. */
  requestedBackend: string
  /** Provider groups from the Host model catalog. */
  groups: readonly ModelProviderGroup[]
  /** Providers whose catalog could not be read. */
  failures: readonly ModelCatalogFailure[]
  /** Adapter-directory request state. */
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  /** Whether any provider-local catalog request failed. */
  catalogPartial: boolean
  /** Whether a newer Host revision invalidated the staged route. */
  conflicted: boolean
}

/** Registration-side face for the memory-model card. */
export interface TotemMemoryCardFace {
  hooks: {
    /** Card snapshot bound by the renderer as useTotemMemoryCard. */
    totemMemoryCard: SnapshotStore<TotemMemoryCardState>
  }
  /** Stage one route key; `''` selects the deployment default. */
  select: (key: string) => void
  /** Stage the retrieval encoder. */
  selectBackend: (value: string) => void
  /** Persist the staged route. */
  save: () => void
  /** Drop the staged route. */
  discard: () => void
  /** Retry the model catalog. */
  retryCatalog: () => void
}

/** Stable route key; callers never parse it. */
export function routeKey(provider: string, model: string): string {
  return `${provider}\0${model}`
}

/** Split a route key into its provider and model. */
export function parseRouteKey(key: string): { provider: string; model: string } {
  if (key === '') return { provider: '', model: '' }
  const at = key.indexOf('\0')
  return at < 0
    ? { provider: key, model: '' }
    : { provider: key.slice(0, at), model: key.slice(at + 1) }
}

function storedRoute(value: TotemMemorySettings | undefined): string {
  if (value === undefined) return ''
  const provider = typeof value.provider === 'string' ? value.provider.trim() : ''
  const model = typeof value.model === 'string' ? value.model.trim() : ''
  return provider.length > 0 && model.length > 0 ? routeKey(provider, model) : ''
}

const EMBEDDING_BACKENDS = ['auto', 'hash', 'model2vec'] as const

function storedBackend(value: TotemMemorySettings | undefined): string {
  const backend = typeof value?.embeddingBackend === 'string' ? value.embeddingBackend.trim() : ''
  return (EMBEDDING_BACKENDS as readonly string[]).includes(backend) ? backend : 'auto'
}

/** Bridges the `totem` settings form and the live model catalog onto a staged card. */
export class TotemMemoryCardController {
  private groups: readonly ModelProviderGroup[] = []
  private failures: readonly ModelCatalogFailure[] = []
  private catalogStatus: TotemMemoryCardState['catalogStatus'] = 'idle'
  private draft: string | undefined
  private draftBackend: string | undefined
  private draftRevision: number | undefined
  private saving = false
  private failed = false
  private conflicted = false
  private disposed = false
  private saveGeneration = 0
  private catalogGeneration = 0
  private readonly store: SnapshotStore<TotemMemoryCardState>
  private readonly unsubscribe: () => void

  /**
   * @param scope - bound `totem` configuration form.
   * @param ctx - the card plugin's context, whose `remote.session` namespace
   * answers the Host model catalog.
   */
  constructor(
    private readonly scope: SettingsFormScope<TotemMemorySettings>,
    private readonly ctx: ClientContext,
  ) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = scope.subscribe(() => {
      const snapshot = this.scope.getSnapshot()
      const dirty = this.draft !== undefined || this.draftBackend !== undefined
      if (!this.saving && dirty && snapshot.revision !== this.draftRevision) {
        const sameRoute = this.draft === undefined || storedRoute(snapshot.value) === this.draft
        const sameBackend = this.draftBackend === undefined
          || storedBackend(snapshot.value) === this.draftBackend
        if (sameRoute && sameBackend) this.clearDraft()
        else this.conflicted = true
      }
      this.publish()
    })
    void this.loadCatalog()
  }

  /** Stop observing settings and suppress late catalog/write settlements. */
  dispose(): void {
    this.disposed = true
    this.saveGeneration += 1
    this.catalogGeneration += 1
    this.unsubscribe()
  }

  /** Build the renderer face for this card. */
  inject(): TotemMemoryCardFace {
    return {
      hooks: { totemMemoryCard: this.store },
      select: key => { this.select(key) },
      selectBackend: value => { this.selectBackend(value) },
      save: () => { void this.save() },
      discard: () => { this.discard() },
      retryCatalog: () => { void this.loadCatalog() },
    }
  }

  /** Invalidate and reload the model catalog after a Host model input changes. */
  refreshCatalog(): void {
    if (this.disposed) return
    this.catalogGeneration += 1
    this.catalogStatus = 'idle'
    void this.loadCatalog()
  }

  private current(): string {
    return storedRoute(this.scope.getSnapshot().value)
  }

  private currentBackend(): string {
    return storedBackend(this.scope.getSnapshot().value)
  }

  private requested(): string {
    return this.draft ?? this.current()
  }

  private requestedBackend(): string {
    return this.draftBackend ?? this.currentBackend()
  }

  private select(key: string): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    if (this.draft === undefined) this.draftRevision = snapshot.revision
    this.draft = key
    this.failed = false
    this.conflicted = false
    this.publish()
  }

  private selectBackend(value: string): void {
    const snapshot = this.scope.getSnapshot()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving) return
    if (!(EMBEDDING_BACKENDS as readonly string[]).includes(value)) return
    if (this.draft === undefined && this.draftBackend === undefined) {
      this.draftRevision = snapshot.revision
    }
    this.draftBackend = value
    this.failed = false
    this.conflicted = false
    this.publish()
  }

  private discard(): void {
    if (this.saving) return
    this.clearDraft()
    this.publish()
  }

  private clearDraft(): void {
    this.draft = undefined
    this.draftBackend = undefined
    this.draftRevision = undefined
    this.failed = false
    this.conflicted = false
  }

  private async save(): Promise<void> {
    const snapshot = this.scope.getSnapshot()
    const desired = this.requested()
    const desiredBackend = this.requestedBackend()
    if (this.disposed || snapshot.status !== 'ready' || !snapshot.writable || this.saving
      || (desired === this.current() && desiredBackend === this.currentBackend())) return
    const staged = this.draft !== undefined || this.draftBackend !== undefined
    if (staged && snapshot.revision !== this.draftRevision) {
      this.conflicted = true
      this.publish()
      return
    }
    const route = parseRouteKey(desired)
    const generation = this.saveGeneration
    this.saving = true
    this.failed = false
    this.conflicted = false
    this.publish()
    await this.scope.mutate([
      { op: 'set', path: ['provider'], value: route.provider },
      { op: 'set', path: ['model'], value: route.model },
      { op: 'set', path: ['embeddingBackend'], value: desiredBackend },
    ], this.draftRevision)
    if (generation !== this.saveGeneration) return
    const landed = this.current() === desired
      && this.currentBackend() === desiredBackend
    this.saving = false
    this.failed = !landed
    if (landed) this.clearDraft()
    this.publish()
  }

  private async loadCatalog(): Promise<void> {
    if (this.disposed || this.catalogStatus === 'loading') return
    const generation = this.catalogGeneration
    this.catalogStatus = 'loading'
    this.publish()
    const response = await this.ctx.remote.session.modelCatalog()
    if (generation !== this.catalogGeneration) return
    if (response.ok) {
      this.groups = response.value.groups
      this.failures = response.value.failures
      this.catalogStatus = 'ready'
    } else {
      this.catalogStatus = 'error'
    }
    this.publish()
  }

  private projection(): TotemMemoryCardState {
    const snapshot = this.scope.getSnapshot()
    const current = this.current()
    const requested = this.requested()
    const currentBackend = this.currentBackend()
    const requestedBackend = this.requestedBackend()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: current !== requested || currentBackend !== requestedBackend,
      invalid: requested !== '' && requested !== current && !this.known(requested),
      saving: this.saving,
      failed: this.failed,
      current,
      requested,
      currentBackend,
      requestedBackend,
      groups: this.groups,
      failures: this.failures,
      catalogStatus: this.catalogStatus,
      catalogPartial: this.failures.length > 0,
      conflicted: this.conflicted,
    }
  }

  private known(key: string): boolean {
    const route = parseRouteKey(key)
    return this.groups.some(group => group.id === route.provider
      && group.models.some(model => model.id === route.model))
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
