import { expect, test } from 'bun:test'

// The client bundle is a browser artifact: it registers a lazy factory on the
// page's module loader. Evaluate it once with a stub loader, then drive the
// factory directly against stub platform modules.
let registered: { id: string; factory: (require: (id: string) => unknown) => any } | undefined
;(globalThis as any).window = {
  __ModuleLoader__: {
    load: (entry: typeof registered) => { registered = entry },
  },
}
const fakeLocalStorage = {
  data: new Map<string, string>(),
  getItem: (key: string) => fakeLocalStorage.data.get(key) ?? null,
  setItem: (key: string, value: string) => { fakeLocalStorage.data.set(key, value) },
  removeItem: (key: string) => { fakeLocalStorage.data.delete(key) },
  clear: () => { fakeLocalStorage.data.clear() },
}
;(globalThis as any).localStorage = fakeLocalStorage
await import('../lib/client.js?test')

type JsxNode = { type: string; props: any }
// Function components are invoked so nested cards actually render; host
// components that are not functions stay as inert nodes.
const jsx = (type: unknown, props: any): JsxNode | unknown => {
  if (typeof type === 'function') return (type as (p: any) => unknown)(props)
  return {
    type: typeof type === 'string' ? type : (type as { name?: string })?.name ?? 'component',
    props,
  }
}

function platformRequire(id: string): unknown {
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
  if (id === 'react') {
    return {
      useState: (value: unknown) => [value, () => {}],
      useEffect: () => {},
      useMemo: (compute: () => unknown) => compute(),
    }
  }
  if (id === '@deepseek-ai/dsh-client-store') {
    return {
      createSnapshotStore: (initial: unknown) => {
        let value = initial
        const subs = new Set<() => void>()
        return {
          getSnapshot: () => value,
          set: (next: unknown) => { value = next; for (const fn of subs) fn() },
          subscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn) } },
        }
      },
    }
  }
  if (id === '@deepseek-ai/dsh-client-ui-primitives') {
    // A host primitive: keep it addressable as a node so assertions can find it.
    return { SettingsForm: function SettingsForm(props: any) { return { type: 'SettingsForm', props } } }
  }
  throw new Error(`unexpected require: ${id}`)
}

test('client bundle registers the totem factory', () => {
  expect(registered?.id).toBe('dsh-totem')
  expect(typeof registered?.factory).toBe('function')
})

function boot(options: { provider?: string; model?: string } = {}) {
  const state: Record<string, unknown> = {
    provider: options.provider ?? 'opencode-go',
    model: options.model ?? 'mimo-v2.6-flash',
    embeddingBackend: 'auto',
  }
  let revision = 1
  const listeners = new Set<() => void>()
  const form = {
    getSnapshot: () => ({ status: 'ready', value: { ...state }, base: {}, user: {}, writable: true, revision }),
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    mutate: async (ops: any[]) => {
      for (const op of ops) if (op.op === 'set') state[op.path[0]] = op.value
      revision += 1
      for (const listener of listeners) listener()
      return true
    },
  }
  const catalog = {
    ok: true,
    value: {
      groups: [
        { id: 'opencode-go', name: 'OpenCode Go', models: [{ id: 'mimo-v2.6-flash', name: 'MiMo V2.6 Flash' }] },
        { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] },
      ],
      failures: [],
    },
  }
  const slots: any[] = []
  const unread = { sessions: new Set<string>(), published: 0, current: 'elsewhere' }
  const statuses = new Map<string, any>()
  const uiSession = {
    completionUnread: unread.sessions,
    publishStatus: () => { unread.published += 1 },
    current: { getSnapshot: () => ({ key: unread.current }) },
    sessionStatus: { getSnapshot: () => statuses, subscribe: () => () => {} },
  }
  const menus: any[] = []
  const contextMenus = {
    register: (contribution: any) => { menus.push(contribution); return () => {} },
  }
  const ctx: any = {
    get: (id: string) => {
      expect(id).toBe('totem')
      return form
    },
    inject: (_deps: readonly string[], callback: (inner: any) => void) => {
      callback({ uiSession, contextMenus })
      return () => {}
    },
    configForms: {
      get: (id: string) => { expect(id).toBe('totem'); return form },
      whileServed: (ids: string[], register: () => () => void) => {
        expect(ids).toEqual(['totem'])
        return register()
      },
    },
    slots: {
      inject: (_name: string, register: () => unknown) => register(),
      register: (entry: any, component: unknown) => { slots.push({ options: entry, component }); return () => {} },
    },
    remote: {
      $on: () => () => {},
      session: { modelCatalog: async () => catalog },
    },
    effect: (fn: () => any) => fn(),
    on: () => () => {},
  }
  const exports = registered!.factory(platformRequire)
  exports.apply(ctx)
  return { exports, slots, form, state, unread, statuses, uiSession, menus }
}

test('apply registers the Totem memory page and the Assistant section', () => {
  const { exports, slots } = boot()
  expect(typeof exports.apply).toBe('function')
  expect(exports.inject).toEqual(['slots', 'remote', 'remote.session', 'configForms'])
  const plugin = slots.find(entry => entry.options.name === 'plugins.item')
  expect(plugin?.options.id).toBe('totem')
  expect(plugin.options.label()).toBe('Totem memory')
  const section = slots.find(entry => entry.options.name === 'settings.section')
  expect(section?.options.id).toBe('assistant')
  expect(section.options.label()).toBe('Assistant')
})

test('summary view renders the description, detail view renders one form', async () => {
  const { slots } = boot()
  // The controller loads the model catalog asynchronously on construction.
  await new Promise(resolve => setTimeout(resolve, 0))
  const slot = slots.find(entry => entry.options.name === 'plugins.item')
  const face = slot.options.inject()
  const props = {
    ...face,
    useTotemMemoryCard: (select: (state: unknown) => unknown) => select(face.hooks.totemMemoryCard.getSnapshot()),
  }

  const summary = slot.component({ ...props, view: 'summary' })
  const summaryText = JSON.stringify(summary)
  expect(summaryText).toContain('Choose the models that write Totem memories and session titles.')
  expect(summaryText).not.toContain('SettingsForm')

  const detail = slot.component({ ...props, view: 'detail' })
  const detailText = JSON.stringify(detail)
  expect(detailText).toContain('SettingsForm')
  expect(detailText).toContain('Memory model')
  expect(detailText).toContain('Retrieval encoder')
  expect(detailText).toContain('potion-retrieval-32M')
  expect(detailText).toContain('mimo-v2.6-flash')
  expect(detailText).toContain('deepseek-chat')
})

test('stages and saves the retrieval encoder', async () => {
  const { slots, state } = boot()
  await new Promise(resolve => setTimeout(resolve, 0))
  const slot = slots.find(entry => entry.options.name === 'plugins.item')
  const face = slot.options.inject()
  face.selectBackend('hash')
  face.save()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(state.embeddingBackend).toBe('hash')
})


test('the turn card reads a TurnLocation owner value, not just a number', async () => {
  const { turnNumberOf } = await import('../src/client/turn.ts')
  // The slot passes a TurnLocation object; a bare number is only the test shortcut.
  expect(turnNumberOf({ turn: 6, status: 'closed' })).toBe(6)
  expect(turnNumberOf(6)).toBe(6)
  expect(turnNumberOf({ status: 'closed' })).toBeUndefined()
  expect(turnNumberOf(undefined)).toBeUndefined()
  expect(turnNumberOf('6')).toBeUndefined()
})

test('the session menu restores the green unread dot', () => {
  const { menus, slots, unread, statuses } = boot()
  const contribution = menus.find(menu => menu.id === 'totem.unread')
  expect(contribution?.target).toBe('session')
  // Native menu item, not a hover-only row button.
  expect(slots.some(item => item.options.name === 'sidebar.workspaces.session.row.action')).toBe(false)
  expect(slots.some(item => item.options.name === 'contextMenu.icon')).toBe(true)

  statuses.set('s1', { running: false, completionUnread: false })
  fakeLocalStorage.clear()
  const actions = contribution!.resolve({ sessionId: 's1', displayTitle: 'Session' })
  expect(actions).toHaveLength(1)
  expect(actions[0].label).toBe('Mark as unread')
  expect(actions[0].icon).toEqual({ key: 'totem.unread' })
  actions[0].run()
  expect(unread.sessions.has('s1')).toBe(true)
  expect(unread.published).toBe(1)
  // The mark is persisted, so a reload can restore it.
  expect(fakeLocalStorage.getItem('dsh-totem:unread-sessions') ?? '').toContain('s1')

  // A running session can still be marked; the dot lands when it finishes.
  statuses.set('s1', { running: true })
  expect(contribution!.resolve({ sessionId: 's1', displayTitle: 'Session' })[0].label).toBe('Mark as unread')

  // Once unread, the menu offers the inverse action instead of hiding.
  statuses.set('s1', { running: false, completionUnread: true })
  const inverse = contribution!.resolve({ sessionId: 's1', displayTitle: 'Session' })
  expect(inverse[0].label).toBe('Mark as read')
  inverse[0].run()
  expect(unread.sessions.has('s1')).toBe(false)
  expect(fakeLocalStorage.getItem('dsh-totem:unread-sessions') ?? '').not.toContain('s1')
})

test('a stored unread mark is restored on the next load', () => {
  fakeLocalStorage.clear()
  const first = boot()
  const contribution = first.menus.find(menu => menu.id === 'totem.unread')
  first.statuses.set('s9', { running: false })
  contribution!.resolve({ sessionId: 's9', displayTitle: 'Session' })[0].run()
  expect(first.unread.sessions.has('s9')).toBe(true)

  // A fresh page with the same storage brings the dot back without a click.
  const second = boot()
  expect(second.unread.sessions.has('s9')).toBe(true)
})

test('the open session offers no unread action', () => {
  fakeLocalStorage.clear()
  const { menus, unread, statuses } = boot()
  unread.current = 's1'
  statuses.set('s1', { running: false })
  const contribution = menus.find(menu => menu.id === 'totem.unread')
  expect(contribution!.resolve({ sessionId: 's1', displayTitle: 'Session' })).toEqual([])
})
