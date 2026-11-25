# Cache eviction under a real access trace

Build a fixed-capacity key/value cache. The only thing graded is the **hit rate**
on a workload the grader generates: a skewed popularity distribution mixed with
periodic sequential scans, the pattern that makes textbook caches look fine on
paper and badly on the trace.

```ts
export interface Cache {
  get(key: string): string | undefined
  put(key: string, value: string): void
}
export function createCache(capacity: number): Cache
```

`put` on a full cache must evict something; the policy is yours. A miss returns
`undefined`. Capacity and the hit-rate floor are pre-registered.
