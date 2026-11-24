/** Totem memory-model settings card for the Plugins page. */
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { parseRouteKey, routeKey, type TotemMemoryCardFace } from './controller.ts'

const LABELS = {
  unavailable: 'This deployment does not serve the Totem settings row.',
  readOnly: 'This deployment stores settings read-only.',
  saveFailed: 'The deployment did not accept this model; the previous choice is still active.',
  save: 'Save',
  saving: 'Saving…',
}

const SELECT_STYLE = {
  width: '100%',
  maxWidth: 460,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border, #3a3a3a)',
  background: 'var(--dsw-alias-bg-secondary, transparent)',
  color: 'inherit',
  fontSize: 13,
} as const

const HELP_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-text-secondary, #9a9a9a)',
} as const

/** Framework-derived props for the Totem settings card. */
export type TotemMemoryCardProps = PropsRuntime<'plugins.item'> & InjectFace<TotemMemoryCardFace>

/**
 * Render the Totem memory-model picker.
 * @param props - The card snapshot and its staged actions.
 * @returns The settings form or the unavailable line.
 */
export function TotemMemoryCard(props: TotemMemoryCardProps) {
  const state = props.useTotemMemoryCard(snapshot => snapshot)
  // The Plugins page renders this entry twice: a roster summary and the
  // selected detail page. Only the detail page owns the form.
  if (props.view === 'summary') return <span>Choose the models that write Totem memories and session titles.</span>
  const requested = parseRouteKey(state.requested)
  const storedUnavailable = state.requested !== '' && !state.dirty
    && !state.groups.some(group => group.id === requested.provider
      && group.models.some(model => model.id === requested.model))
  const requestedTitle = parseRouteKey(state.requestedTitle)
  const titleUnavailable = state.requestedTitle !== '' && !state.dirty
    && !state.groups.some(group => group.id === requestedTitle.provider
      && group.models.some(model => model.id === requestedTitle.model))
  return (
    <SettingsForm labels={LABELS} state={state} onSave={props.save} onDiscard={props.discard}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="dsh-totem-memory-model" style={{ fontSize: 13, fontWeight: 600 }}>
          Memory model
        </label>
        <select
          id="dsh-totem-memory-model"
          style={SELECT_STYLE}
          value={state.requested}
          disabled={!state.writable || state.saving || state.catalogStatus === 'loading'}
          onChange={event => { props.select(event.target.value) }}
        >
          <option value="">Deployment default</option>
          {state.groups.map(group => (
            <optgroup key={group.id} label={group.name.length > 0 ? group.name : group.id}>
              {group.models.map(model => (
                <option key={routeKey(group.id, model.id)} value={routeKey(group.id, model.id)}>
                  {model.name.length > 0 ? model.name : model.id}
                </option>
              ))}
            </optgroup>
          ))}
          {storedUnavailable
            ? (
              <option value={state.requested}>
                {`${requested.provider} / ${requested.model} (unavailable)`}
              </option>
            )
            : null}
        </select>
        <p style={HELP_STYLE}>
          The model that writes Totem memories after file reads and edits. Leave the deployment
          default to reuse your main agent model, or pick any model from any configured provider.
        </p>
        <label htmlFor="dsh-totem-title-model" style={{ fontSize: 13, fontWeight: 600 }}>
          Titles model
        </label>
        <select
          id="dsh-totem-title-model"
          style={SELECT_STYLE}
          value={state.requestedTitle}
          disabled={!state.writable || state.saving || state.catalogStatus === 'loading'}
          onChange={event => { props.selectTitle(event.target.value) }}
        >
          <option value="">Same as memory model</option>
          {state.groups.map(group => (
            <optgroup key={group.id} label={group.name.length > 0 ? group.name : group.id}>
              {group.models.map(model => (
                <option key={routeKey(group.id, model.id)} value={routeKey(group.id, model.id)}>
                  {model.name.length > 0 ? model.name : model.id}
                </option>
              ))}
            </optgroup>
          ))}
          {titleUnavailable
            ? (
              <option value={state.requestedTitle}>
                {`${requestedTitle.provider} / ${requestedTitle.model} (unavailable)`}
              </option>
            )
            : null}
        </select>
        <p style={HELP_STYLE}>
          The model that writes session titles through the first five turns and the hover TLDR.
          Leave it on the memory model to keep this auxiliary work on the same cheap route.
        </p>
        <label htmlFor="dsh-totem-embedding-backend" style={{ fontSize: 13, fontWeight: 600 }}>
          Retrieval encoder
        </label>
        <select
          id="dsh-totem-embedding-backend"
          style={SELECT_STYLE}
          value={state.requestedBackend}
          disabled={!state.writable || state.saving}
          onChange={event => { props.selectBackend(event.target.value) }}
        >
          <option value="auto">Automatic (Model2Vec when installed)</option>
          <option value="model2vec">Model2Vec (potion-retrieval-32M)</option>
          <option value="hash">Offline hash (no extra dependency)</option>
        </select>
        <p style={HELP_STYLE}>
          The dense retrieval leg used by Totem. Model2Vec needs the optional
          {' '}<code>totem-mcp[embeddings]</code> package and downloads
          {' '}<code>minishlab/potion-retrieval-32M</code> on first use; the hash encoder is the
          dependency-free fallback. Applies the next time the Totem server starts.
        </p>
        {state.catalogStatus === 'error'
          ? (
            <p style={HELP_STYLE} role="status">
              The model catalog is unavailable.{' '}
              <button type="button" onClick={props.retryCatalog}>Retry</button>
            </p>
          )
          : null}
        {state.catalogPartial
          ? <p style={HELP_STYLE} role="status">Some providers could not be listed; their saved routes remain selectable.</p>
          : null}
        {state.conflicted
          ? <p style={HELP_STYLE} role="status">Settings changed elsewhere; reopen this page before saving.</p>
          : null}
      </div>
    </SettingsForm>
  )
}
