# Retrieval index

Build an in-memory index over session summaries and answer keyword queries.

```ts
export interface Index {
  add(id: string, text: string): void
  search(query: string, k: number): string[]
}
export function createIndex(): Index
```

A document is relevant to a query when it contains **every** term of the query.
`search` returns document ids, best first, at most `k`. The corpus is generated
prose, queries are short keyword sets, and recall, query latency and indexing
time are graded against pre-registered numbers.
