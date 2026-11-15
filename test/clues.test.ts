import { expect, test } from 'bun:test'
import { clueSeeds } from '../src/clues.ts'
import type { TotemService } from '../src/service.ts'

test('clue seeds union search results and ignore failures', async () => {
  const calls: string[] = []
  const totem = {
    async call(_tool: string, args: { query: string }) {
      calls.push(args.query)
      if (args.query === 'bad clue') throw new Error('boom')
      return args.query === 'first clue'
        ? [{ id: 'a' }, { id: 'b' }]
        : [{ id: 'b' }, { id: 'c' }]
    },
  } as unknown as TotemService
  const ids = await clueSeeds(totem, '/tmp/project', [
    'first clue', 'bad clue', 'second clue',
  ])
  expect(ids.sort()).toEqual(['a', 'b', 'c'])
  expect(calls).toEqual(['first clue', 'bad clue', 'second clue'])
})
