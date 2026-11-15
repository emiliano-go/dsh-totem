/**
 * Totem settings page, browser half: one model picker for the secondary model
 * that authors memories, over the `totem` plugin row's settings form.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only Context merges for the services and slots this page uses.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { TotemMemoryCard } from './TotemMemoryCard.tsx'
import { TotemMemoryCardController } from './controller.ts'
import { AssistantSection } from './AssistantSection.tsx'
import { AssistantController } from './assistant-controller.ts'
import { LayaSwitch } from './LayaSwitch.tsx'
import { LayaSwitchController } from './laya-switch.ts'
import { DecisionBadge } from './DecisionBadge.tsx'
import { DecisionBadgeController } from './decision-badge.ts'
import { LayaTurnCard } from './LayaTurnCard.tsx'
import { LayaToolView } from './LayaToolView.tsx'
import { LayaCallsController } from './laya-calls.ts'
import { OverviewPage } from './OverviewPage.tsx'
import { OverviewIcon } from './OverviewIcon.tsx'
import { OverviewController } from './overview.ts'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Required browser services. */
export const inject = ['slots', 'remote', 'remote.session', 'configForms']

/**
 * Register the Totem settings card while the Host serves the `totem` row.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const card = new TotemMemoryCardController(ctx.configForms.get('totem'), ctx)
  ctx.effect(() => () => { card.dispose() }, 'dsh-totem: model card lifetime')
  const face = card.inject()
  // Adapters and document commits can change which routes are stored or
  // advertised; a reconnect drops Host-specific catalog state.
  ctx.effect(
    () => ctx.remote.$on('llm/adapters-updated', () => { card.refreshCatalog() }),
    'dsh-totem: adapter invalidations',
  )
  ctx.effect(
    () => ctx.remote.$on('settings/document-updated', () => { card.refreshCatalog() }),
    'dsh-totem: settings invalidations',
  )
  ctx.effect(
    () => ctx.on('connection/reset', () => { card.refreshCatalog() }),
    'dsh-totem: connection resets',
  )
  const layaSwitch = new LayaSwitchController(ctx.configForms.get('totem'), ctx)
  ctx.effect(() => () => { layaSwitch.dispose() }, 'dsh-totem: laya switch lifetime')
  ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'laya',
    order: 10,
    inject: () => layaSwitch.inject(),
  }, LayaSwitch)), 'dsh-totem: laya switch')

  const decisionBadge = new DecisionBadgeController(ctx.configForms.get('totem'))
  ctx.effect(() => ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'laya-decision',
    order: 20,
    inject: () => ({ lookup: decisionBadge.lookup }),
  }, DecisionBadge)), 'dsh-totem: decision badge')

  // The judge card belongs in the turn tail: a full-width block before the
  // action row. The action row is a 28px icon strip that fades on hover, which
  // is the wrong geometry for a card and hid it most of the time.
  const layaCalls = new LayaCallsController(ctx.configForms.get('totem'))
  ctx.effect(() => ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    id: 'laya-turn',
    order: 10,
    inject: () => ({ lookupTurn: layaCalls.lookupTurn, lookupDetail: layaCalls.lookupDetail }),
  }, LayaTurnCard)), 'dsh-totem: laya turn card')

  // `decision_ask` renders as a verdict card instead of a generic tool row: the
  // keyed tool view replaces the row, so the call itself shows what Laya said.
  ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'decision_ask',
  }, LayaToolView)), 'dsh-totem: laya tool view')

  const overview = new OverviewController(ctx.configForms.get('totem'))
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: 'overview',
    order: -10,
    label: () => 'Overview',
  }, OverviewIcon)), 'dsh-totem: overview sidebar entry')
  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: 'overview',
    inject: () => ({ load: overview.load, importHistory: overview.importHistory }),
  }, OverviewPage)), 'dsh-totem: overview panel')

  const assistant = new AssistantController(ctx.configForms.get('totem'), ctx)
  ctx.effect(() => () => { assistant.dispose() }, 'dsh-totem: assistant section lifetime')
  const assistantFace = assistant.inject()
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'assistant',
    order: 30,
    label: () => 'Assistant',
    inject: () => assistantFace,
  }, AssistantSection)), 'dsh-totem: assistant section')

  ctx.effect(() => ctx.configForms.whileServed(['totem'], () => ctx.slots.inject(
    'plugins.item',
    () => ctx.slots.register({
      name: 'plugins.item',
      id: 'totem',
      order: 60,
      label: () => 'Totem memory',
      inject: () => face,
    }, TotemMemoryCard),
  )), 'dsh-totem: settings page')
}
