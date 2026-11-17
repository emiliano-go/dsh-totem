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
import { VerifyController } from './verify-card.ts'
import { VerifyTurnCard } from './VerifyTurnCard.tsx'
import { SessionUnreadIcon } from './SessionUnreadIcon.tsx'
import { SessionUnreadController, type UiSessionLike } from './session-unread.ts'
import { UNREAD_MENU_ORDER, unreadMenuActions, type ContextMenusLike } from './unread-menu.ts'
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
  const overview = new OverviewController(ctx.configForms.get('totem'))
  // The green "done" dot is browser state (`uiSession.completionUnread`) with no
  // built-in way back. The `...` menu restores it: unlike the row's hover strip,
  // the menu exists on every input modality (touch included) and device. A mark
  // is persisted so it also survives a reload.
  ctx.effect(() => ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
    name: 'contextMenu.icon',
    key: 'totem.unread',
  } as never, SessionUnreadIcon as never)), 'dsh-totem: unread menu icon')
  let unread: SessionUnreadController | undefined
  // Wait for the session service instead of depending on it statically: the
  // settings UI must still work when no session UI is loaded. The call stays a
  // property access because cordis's `inject` uses `this`.
  ;(ctx as unknown as {
    inject?: (deps: readonly string[], callback: (inner: unknown) => void) => unknown
  }).inject?.(['uiSession'], (inner) => {
    const session = (inner as { uiSession?: UiSessionLike }).uiSession
    if (session?.completionUnread === undefined) return
    unread = new SessionUnreadController(session)
    unread.restore()
    ctx.effect(() => unread?.watch() ?? (() => {}), 'dsh-totem: unread mark expiry')

    // Native context-menu contribution: label, icon, ordering, and keyboard
    // navigation come from the shared menu renderer.
    const controller = unread
    ;(ctx as unknown as {
      inject?: (deps: readonly string[], callback: (inner: unknown) => void) => unknown
    }).inject?.(['contextMenus'], (menuInner) => {
      const menus = (menuInner as { contextMenus?: ContextMenusLike }).contextMenus
      if (menus?.register === undefined) return
      ctx.effect(() => menus.register({
        id: 'totem.unread',
        target: 'session',
        order: UNREAD_MENU_ORDER,
        observe: () => [session.sessionStatus],
        resolve: target => unreadMenuActions(target, {
          isCurrent: id => controller.isCurrent(id),
          statusOf: id => session.sessionStatus.getSnapshot().get(id),
          mark: id => controller.mark(id),
        }),
      }), 'dsh-totem: mark unread menu')
    })
  })

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

  // Deterministic verification card: the Host ran the rules at turn end, the
  // card only reads the stored findings back.
  const verify = new VerifyController(ctx.configForms.get('totem'))
  ctx.effect(() => (ctx.slots as unknown as {
    inject: (name: string, register: () => unknown) => () => void
  }).inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    id: 'verify-turn',
    order: 10,
    inject: () => ({ lookupTurn: verify.lookupTurn }),
  } as never, VerifyTurnCard as never)), 'dsh-totem: verify turn card')

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
