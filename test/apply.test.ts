import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { apply, Config } from '../src/index.ts'

/** A real Cordis root context with the services this plugin injects. */
function mount() {
  const home = mkdtempSync(join(tmpdir(), 'dsh-totem-apply-'))
  process.env.DSH_HOME = home
  const ctx = new Context()
  const tools: { name: string }[] = []
  const commands: { name: string }[] = []
  const providers: { name: string; list: Function }[] = []

  ctx.provide('tools', { register: (definition: { name: string }) => { tools.push(definition); return () => {} } })
  ctx.provide('systemPrompt', { section: () => () => {}, getSectionOrder: () => 100 })
  ctx.provide('llm', {})
  ctx.provide('workingDirectory', { ensure: async () => home })
  ctx.provide('agents', { get: () => undefined })
  ctx.provide('commands', {
    register: (definition: { name: string }) => { commands.push(definition); return () => {} },
  })
  ctx.provide('skills', {
    registerProvider: (create: Function) => {
      providers.push(create({ signal: new AbortController().signal, invalidate: () => {} }))
      return () => {}
    },
  })

  // A nonexistent binary keeps every Totem call failing fast instead of
  // spawning the real server inside a unit test.
  const config = Config({
    command: 'dsh-totem-missing-binary-for-tests',
  })
  apply(ctx, config)
  return { ctx, tools, commands, providers, home }
}

describe('plugin composition', () => {
  test('mounts the tier tools, commands, and the workflow provider', async () => {
    const { ctx, tools, commands, providers, home } = mount()
    // `ctx.inject` loads its child fiber asynchronously.
    await new Promise(resolve => setTimeout(resolve, 20))
    const names = tools.map(tool => tool.name)
    for (const name of [
      'memory_create', 'memory_search', 'memory_recall_sessions',
      'memory_conflicts', 'memory_resolve_conflict', 'memory_eval',
    ]) {
      expect(names).toContain(name)
    }
    expect(commands.map(command => command.name).sort())
      .toEqual(['forget', 'handoff', 'memory', 'recall', 'remember', 'triage'].sort())
    expect(providers.map(provider => provider.name)).toEqual(['totem-workflows'])
    // Discovery must degrade to an empty catalog when the server is down.
    expect(await providers[0].list({ cwd: home })).toEqual([])
    await ctx.fiber.dispose()
  })

  test('a profile without a command or skill surface still loads', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-totem-apply-min-'))
    process.env.DSH_HOME = home
    const bare = new Context()
    const tools: { name: string }[] = []
    bare.provide('tools', { register: (definition: { name: string }) => { tools.push(definition); return () => {} } })
    bare.provide('systemPrompt', { section: () => () => {}, getSectionOrder: () => 100 })
    bare.provide('llm', {})
    bare.provide('workingDirectory', { ensure: async () => home })
    bare.provide('agents', { get: () => undefined })
    apply(bare, Config({ command: 'dsh-totem-missing-binary-for-tests' }))
    expect(tools.map(tool => tool.name)).toContain('memory_search')
    await bare.fiber.dispose()
  })
})
