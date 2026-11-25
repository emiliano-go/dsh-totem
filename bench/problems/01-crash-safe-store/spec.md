# Crash-safe append store

Build a small embedded store for a process that can be killed at any instant
(`kill -9`, power loss). Requirements:

- `put(key, value)`, `get(key)`, `delete(key)`, `open(path)`.
- A write acknowledged as durable must survive an immediate `kill -9`.
- A write not yet acknowledged may be lost, but must never corrupt the store.
- Reopening after any crash yields a consistent snapshot: no torn records, no
  partially applied delete, no duplicated sequence numbers.
- Throughput floor and reopen-time ceiling are pre-registered in `targets.json`.

Deliver a library plus a crash-injection test of your own. The hidden suite runs
a randomized writer, kills the process at random points, reopens, and checks the
invariants above.

## Interface

`store.ts` in the solution root exports:

```ts
export interface Store {
  put(key: string, value: string): Promise<void> | void
  get(key: string): string | undefined
  delete(key: string): Promise<void> | void
  close(): Promise<void> | void
}
export function openStore(path: string): Promise<Store> | Store
```

A `put` that resolves has been acknowledged as durable. Nothing else is promised.
