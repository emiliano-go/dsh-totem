import { describe, expect, test } from 'bun:test'
import { SessionUnreadController, currentKey, type SessionStatusLike, type UiSessionLike } from '../src/client/session-unread.ts'
import { UNREAD_KEY, isStoredUnread, markStored, readUnread, type StorageLike } from '../src/client/unread-store.ts'

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
