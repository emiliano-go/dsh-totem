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
await import('../lib/client.js?test')

type JsxNode = { type: string; props: any }
const jsx = (type: unknown, props: any): JsxNode => ({
  type: typeof type === 'string' ? type : (type as { name?: string })?.name ?? 'component',
  props,
})

function platformRequire(id: string): unknown {
  if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
  if (id === 'react') return { useState: (value: unknown) => [value, () => {}], useEffect: () => {} }
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
    return { SettingsForm: function SettingsForm() {} }
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
  const ctx: any = {
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
  return { exports, slots, form }
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
  const laya = slots.find(entry => entry.options.name === 'conversation.input.left')
  expect(laya?.options.id).toBe('laya')
  const badge = slots.find(entry => entry.options.name === 'conversation.chat.assistant-actions')
  expect(badge?.options.id).toBe('laya-decision')
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
  expect(summaryText).toContain('Choose the model that writes Totem memories.')
  expect(summaryText).not.toContain('SettingsForm')

  const detail = slot.component({ ...props, view: 'detail' })
  const detailText = JSON.stringify(detail)
  expect(detailText).toContain('SettingsForm')
  expect(detailText).toContain('Memory model')
  expect(detailText).toContain('mimo-v2.6-flash')
  expect(detailText).toContain('deepseek-chat')
})
