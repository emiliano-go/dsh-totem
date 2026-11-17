import { describe, expect, test } from 'bun:test'
import {
  SessionUnreadController,
  UNREAD_SYNCED_KEY,
  currentKey,
  type SessionStatusLike,
  type UiSessionLike,
} from '../src/client/session-unread.ts'
import { UNREAD_MENU_ORDER, unreadMenuActions } from '../src/client/unread-menu.ts'
import type { UnreadRemote } from '../src/client/unread-sync.ts'
import { UNREAD_KEY, isStoredUnread, markStored, readUnread, type StorageLike, type UnreadRecord } from '../src/client/unread-store.ts'

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }
}

function fakeSession(options: { current?: string; statuses?: Map<string, SessionStatusLike> } = {}) {
  const listeners = new Set<() => void>()
  const statuses = options.statuses ?? new Map<string, SessionStatusLike>()
  const state = {
    published: 0,
    current: { key: options.current },
    completionUnread: new Set<string>(),
  }
  const session: UiSessionLike = {
    completionUnread: state.completionUnread,
    publishStatus: () => { state.published += 1 },
    current: { getSnapshot: () => ({ key: state.current.key }) },
    sessionStatus: {
      getSnapshot: () => statuses,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
  }
  return { session, state, statuses, emit: () => { for (const listener of listeners) listener() } }
}

describe('unread controller', () => {
  test('restore re-applies stored marks and drops ones that no longer apply', () => {
    const storage = fakeStorage()
    markStored('idle', storage)
    markStored('open', storage)
    markStored('running', storage)
    const { session, state, statuses } = fakeSession({
      current: 'open',
      statuses: new Map([['running', { running: true }], ['idle', { running: false }]]),
    })
    new SessionUnreadController(session, storage).restore()

    expect(state.completionUnread.has('idle')).toBe(true)
    expect(state.completionUnread.has('open')).toBe(false)
    expect(state.completionUnread.has('running')).toBe(false)
    expect(state.published).toBe(1)
    // The two that no longer apply are removed from storage, not re-added later.
    expect(readUnread(storage).map(record => record.sessionId)).toEqual(['idle'])
    expect(statuses.size).toBe(2)
  })

  test('mark persists the session and lights the dot', () => {
    const storage = fakeStorage()
    const { session, state } = fakeSession()
    const controller = new SessionUnreadController(session, storage)
    expect(controller.mark('abc')).toBe(true)
    expect(state.completionUnread.has('abc')).toBe(true)
    expect(state.published).toBe(1)
    expect(isStoredUnread('abc', storage)).toBe(true)
    expect(controller.mark('')).toBe(false)
  })

  test('watch clears a mark when the session runs again or is opened', () => {
    const storage = fakeStorage()
    markStored('ran', storage)
    markStored('touched', storage)
    const { session, statuses, emit, state } = fakeSession({ current: 'elsewhere', statuses: new Map([['ran', { running: false }]]) })
    const controller = new SessionUnreadController(session, storage)
    const dispose = controller.watch()

    // The session resumes: the dot and the record both go.
    statuses.set('ran', { running: true })
    emit()
    expect(isStoredUnread('ran', storage)).toBe(false)
    expect(isStoredUnread('touched', storage)).toBe(true)

    // Opening the other one clears it too.
    state.current.key = 'touched'
    emit()
    expect(isStoredUnread('touched', storage)).toBe(false)
    dispose()
  })

  test('the current session is recognised from either snapshot shape', () => {
    const { session } = fakeSession({ current: 'x' })
    expect(currentKey(session)).toBe('x')
    expect(new SessionUnreadController(session, fakeStorage()).isCurrent('x')).toBe(true)
    const legacy = { ...session, current: { value: { key: 'y' } } } as UiSessionLike
    expect(currentKey(legacy)).toBe('y')
  })

  test('nothing is written when storage is unavailable', () => {
    const { session, state } = fakeSession()
    // Bun provides a global localStorage, so remove it for this case and restore
    // it after; the point is the absent-storage path, not the browser one.
    const saved = (globalThis as { localStorage?: unknown }).localStorage
    delete (globalThis as { localStorage?: unknown }).localStorage
    try {
      const controller = new SessionUnreadController(session, undefined)
      expect(controller.mark('abc')).toBe(true)
      expect(state.completionUnread.has('abc')).toBe(true)
      expect(readUnread(undefined)).toEqual([])
    } finally {
      if (saved !== undefined) (globalThis as { localStorage?: unknown }).localStorage = saved
    }
  })
})

describe('storage key', () => {
  test('is namespaced so another plugin cannot collide', () => {
    expect(UNREAD_KEY).toBe('dsh-totem:unread-sessions')
  })
})

function settle(ms = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fakeRemote(initial: UnreadRecord[] = []) {
  let items = [...initial]
  const calls = { mark: [] as string[], clear: [] as string[][] }
  const remote: UnreadRemote = {
    list: async () => items,
    mark: async (sessionId) => {
      calls.mark.push(sessionId)
      items = [{ sessionId, markedAt: Date.now() }, ...items.filter(item => item.sessionId !== sessionId)]
      return items
    },
    clear: async (sessionIds) => {
      calls.clear.push([...sessionIds])
      items = items.filter(item => !sessionIds.includes(item.sessionId))
      return items
    },
  }
  return { remote, calls, get: () => items, set: (next: UnreadRecord[]) => { items = next } }
}

describe('cross-device sync', () => {
  test('a mark made on another device appears after sync', async () => {
    const storage = fakeStorage()
    storage.setItem(UNREAD_SYNCED_KEY, '1')
    const { session, state } = fakeSession()
    const host = fakeRemote([{ sessionId: 'phone', markedAt: Date.now() }])

    await new SessionUnreadController(session, storage, host.remote).sync()
    expect(state.completionUnread.has('phone')).toBe(true)
    expect(isStoredUnread('phone', storage)).toBe(true)
  })

  test('a mark cleared on another device disappears here', async () => {
    const storage = fakeStorage()
    storage.setItem(UNREAD_SYNCED_KEY, '1')
    markStored('gone', storage)
    const { session, state } = fakeSession()
    state.completionUnread.add('gone')

    await new SessionUnreadController(session, storage, fakeRemote().remote).sync()
    expect(state.completionUnread.has('gone')).toBe(false)
    expect(isStoredUnread('gone', storage)).toBe(false)
  })

  test('automatic completion dots are left alone', async () => {
    const storage = fakeStorage()
    storage.setItem(UNREAD_SYNCED_KEY, '1')
    const { session, state } = fakeSession()
    state.completionUnread.add('auto')

    await new SessionUnreadController(session, storage, fakeRemote().remote).sync()
    expect(state.completionUnread.has('auto')).toBe(true)
  })

  test('marking pushes to the host', async () => {
    const storage = fakeStorage()
    const { session } = fakeSession()
    const host = fakeRemote()
    new SessionUnreadController(session, storage, host.remote).mark('s1')
    await settle()
    expect(host.calls.mark).toContain('s1')
    expect(host.get().map(item => item.sessionId)).toEqual(['s1'])
  })

  test('the host is cleared when the session runs or is opened', async () => {
    const storage = fakeStorage()
    storage.setItem(UNREAD_SYNCED_KEY, '1')
    markStored('ran', storage)
    const { session, statuses, emit } = fakeSession({ current: 'elsewhere', statuses: new Map([['ran', { running: false }]]) })
    const host = fakeRemote([{ sessionId: 'ran', markedAt: 1 }])
    const controller = new SessionUnreadController(session, storage, host.remote)
    const dispose = controller.watch()

    statuses.set('ran', { running: true })
    emit()
    await settle()
    expect(host.get()).toEqual([])
    dispose()
  })

  test('the first sync migrates local-only marks and then the host wins', async () => {
    const storage = fakeStorage()
    markStored('legacy', storage)
    const { session } = fakeSession()
    const host = fakeRemote()
    const controller = new SessionUnreadController(session, storage, host.remote)

    await controller.sync()
    expect(host.get().map(item => item.sessionId)).toContain('legacy')
    expect(storage.getItem(UNREAD_SYNCED_KEY)).toBe('1')

    // Once migrated, a clear elsewhere is not resurrected by this browser.
    host.set([])
    await controller.sync()
    expect(isStoredUnread('legacy', storage)).toBe(false)
  })

  test('a failed push keeps the mark and retries on the next sync', async () => {
    const storage = fakeStorage()
    const { session } = fakeSession()
    let online = false
    const items: UnreadRecord[] = []
    const remote: UnreadRemote = {
      list: async () => items,
      mark: async (sessionId) => {
        if (!online) return undefined
        items.unshift({ sessionId, markedAt: Date.now() })
        return items
      },
      clear: async () => items,
    }
    const controller = new SessionUnreadController(session, storage, remote)
    controller.mark('offline')
    await settle()
    expect(isStoredUnread('offline', storage)).toBe(true)
    expect(items).toEqual([])

    online = true
    await controller.sync()
    expect(items.map(item => item.sessionId)).toContain('offline')
    expect(isStoredUnread('offline', storage)).toBe(true)
  })
})

describe('unread menu action', () => {
  const deps = (options: {
    current?: string
    status?: SessionStatusLike
    marked?: string[]
  } = {}) => {
    const marked = options.marked ?? []
    return {
      marked,
      deps: {
        isCurrent: (id: string) => id === options.current,
        statusOf: () => options.status,
        mark: (id: string) => { marked.push(id); return true },
      },
    }
  }

  test('offers one native action for an idle session', () => {
    const { deps: lookup } = deps({ status: { running: false, completionUnread: false } })
    const actions = unreadMenuActions({ sessionId: 's1', displayTitle: 'One' }, lookup)
    expect(actions).toHaveLength(1)
    expect(actions[0].id).toBe('totem-unread')
    expect(actions[0].label).toBe('Mark as unread')
    expect(actions[0].icon).toEqual({ key: 'totem.unread' })
  })

  test('runs the marker against the captured session', () => {
    const { deps: lookup, marked } = deps({ status: { running: false } })
    unreadMenuActions({ sessionId: 's7', displayTitle: 'Seven' }, lookup)[0].run()
    expect(marked).toEqual(['s7'])
  })

  test('declines running, already-unread, and open sessions', () => {
    expect(unreadMenuActions({ sessionId: 's1', displayTitle: '' },
      deps({ status: { running: true } }).deps)).toEqual([])
    expect(unreadMenuActions({ sessionId: 's1', displayTitle: '' },
      deps({ status: { running: false, completionUnread: true } }).deps)).toEqual([])
    expect(unreadMenuActions({ sessionId: 's1', displayTitle: '' },
      deps({ current: 's1', status: { running: false } }).deps)).toEqual([])
    expect(unreadMenuActions({ sessionId: '', displayTitle: '' },
      deps({ status: { running: false } }).deps)).toEqual([])
  })

  test('sits between fork and the session-id separator', () => {
    expect(UNREAD_MENU_ORDER).toBeGreaterThan(300)
    expect(UNREAD_MENU_ORDER).toBeLessThan(450)
  })
})
