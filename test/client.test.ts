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
  return { exports, slots, form, state }
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
  // The judge card lives in the turn tail, not the 28px action row.
  const turnCard = slots.find(entry => entry.options.name === 'conversation.chat.turnTail')
  expect(turnCard?.options.id).toBe('laya-turn')
  expect(typeof turnCard?.options.inject().lookupTurn).toBe('function')
  expect(slots.some(entry => entry.options.id === 'laya-calls')).toBe(false)
  // The judge tool renders its own card instead of the generic tool row.
  const toolview = slots.find(entry => entry.options.name === 'tool.call.toolview')
  expect(toolview?.options.key).toBe('decision_ask')
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

test('the decision_ask view renders a verdict card instead of a generic row', () => {
  const { slots } = boot()
  const view = slots.find(entry => entry.options.name === 'tool.call.toolview')
  const verdict = {
    verdict: 'fail',
    composite: 0.5306615384615385,
    margin: -0.1193384615384615,
    threshold: 0.65,
    vetoes: ['bug_risk'],
    answers: {
      bug_risk: {
        type: 'score',
        score: 1.46,
        confidence: 0.07,
        legend: { '0': 'No bug, the code is correct', '1': 'Minor risk', '2': 'Likely a bug', '3': 'Definitely buggy' },
        probabilities: { '0': 0.365, '1': 0.159, '2': 0.123, '3': 0.353 },
      },
    },
    findings: [],
    paths: ['src/parser.py'],
    authoritative: false,
    reviewOnly: true,
    note: 'Advisory only; the turn gate is the authoritative decision.',
  }
  const element = view.component({
    phase: 'result',
    block: { content: [{ type: 'text', text: JSON.stringify(verdict) }] },
  })
  const text = JSON.stringify(element)
  expect(text).toContain('Advisory judgement')
  expect(text).toContain('fail')
  expect(text).toContain('0.531')
  // Answers are open by default and explain each value.
  expect(text).toContain('Bug risk')
  expect(text).toContain('closest grade: Minor risk')
  // Distributions use the legend labels, keep the bucket order, and carry a fill.
  expect(text).toContain('No bug, the code is correct')
  expect(text).toContain('Definitely buggy')
  expect(text).toContain('laya-barFill')
  expect(text).toContain('"width":"36.5%"')
  expect(text).toContain('confidence 0.07')
  expect(text).toContain('threshold 0.65')
  expect(text).toContain('below')
  expect(text).toContain('Raw response')
  // A review-only verdict is labelled and explained, not presented as enforced.
  expect(text).toContain('review only')
  expect(text).toContain('No corrective message was sent')
})

test('the decision_ask view shows the task while the judge runs', () => {
  const { slots } = boot()
  const view = slots.find(entry => entry.options.name === 'tool.call.toolview')
  const element = view.component({
    phase: 'start',
    block: { args: { task: 'Cap HTTP retries at three attempts.' } },
  })
  const text = JSON.stringify(element)
  expect(text).toContain('Laya is judging')
  expect(text).toContain('Cap HTTP retries')
  expect(text).not.toContain('composite')
})

test('the decision_ask view reports a failed call without pretending it is a verdict', () => {
  const { slots } = boot()
  const view = slots.find(entry => entry.options.name === 'tool.call.toolview')
  const element = view.component({
    phase: 'result',
    block: { isError: true, content: [{ type: 'text', text: 'laya engine is disabled or unavailable' }] },
  })
  const text = JSON.stringify(element)
  expect(text).toContain('Laya judge failed')
  expect(text).toContain('error')
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

test('the prompt is labelled in both card states', () => {
  const { slots } = boot()
  const view = slots.find(entry => entry.options.name === 'tool.call.toolview')
  const element = view.component({
    phase: 'result',
    block: {
      args: { task: 'Make the parser tolerant of malformed rows.' },
      content: [{ type: 'text', text: JSON.stringify({ verdict: 'pass', composite: 0.7, threshold: 0.65, answers: {} }) }],
    },
  })
  expect(JSON.stringify(element)).toContain('Prompt: ', 'the judged prompt must be labelled')
})

test('an answer value is explained rather than restated', () => {
  const { slots } = boot()
  const view = slots.find(entry => entry.options.name === 'tool.call.toolview')
  const element = view.component({
    phase: 'result',
    block: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          verdict: 'needs_review',
          composite: 0.62,
          threshold: 0.65,
          answers: {
            requirements_met: { type: 'noul', noul: 0.4, confidence: 0.4 },
            bug_class: { type: 'choice', choice: 'off-by-one', confidence: 0.17, probabilities: { 'off-by-one': 0.17, none: 0.5 } },
          },
        }),
      }],
    },
  })
  const text = JSON.stringify(element)
  expect(text).toContain('Requirements met')
  expect(text).toContain('is not satisfied')
  expect(text).toContain('Bug class')
  expect(text).toContain('chosen bug class: off-by-one')
  expect(text).toContain('off-by-one')
})
