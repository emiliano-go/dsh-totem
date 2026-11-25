import { describe, expect, test } from 'bun:test'

const ENTRY = process.env.STORE_ENTRY

const TARGETS = JSON.parse(process.env.BENCH_TARGETS ?? '{}') as {
  min_recall5: number
  p95_query_ms: number
  max_build_ms: number
  documents: number
  queries: number
}

const WORDS = ('session memory reminder verify gate compaction subagent profile restart route token quiet hours schedule notify topic ledger archive project build test failing pass retry queue cache index query latency budget timeout socket event loop drain promise worker pool batch commit log disk fsync crash recover replay snapshot rename atomic corrupt torn record boundary sequence channel filter check rule evidence patch diff review approve release deploy health probe metric counter trace span digest recall summary title unread mark client host plugin service config schema wire protocol frame chunk stream buffer parse encode decode').split(' ')

const seeded = (seed: number) => {
  let state = seed >>> 0
  return (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

const random = seeded(20261125)
const corpus: { id: string; text: string; terms: Set<string> }[] = []
for (let index = 0; index < TARGETS.documents; index += 1) {
  const length = 8 + Math.floor(random() * 10)
  const words: string[] = []
  for (let word = 0; word < length; word += 1) words.push(WORDS[Math.floor(random() * WORDS.length)]!)
  corpus.push({ id: `s${index}`, text: words.join(' '), terms: new Set(words) })
}

// Selective queries. Each carries a token that appears in a handful of
// documents, so a full scan has to visit nearly the whole corpus while a
// postings list is a few entries long. Common-term queries let a scan stop early
// and hide the difference the problem is about.
const rareQueries: string[][] = []
for (let token = 0; token < TARGETS.queries; token += 1) {
  const name = `rare${token}`
  const target = corpus[Math.floor(random() * corpus.length)]!
  const anchor = [...target.terms].slice(0, 2)
  for (let copy = 0; copy < 3; copy += 1) {
    const doc = corpus[Math.floor(random() * corpus.length)]!
    doc.text = `${doc.text} ${name}`
    doc.terms.add(name)
  }
  target.text = `${target.text} ${name}`
  target.terms.add(name)
  if (anchor.length === 2) rareQueries.push([name, ...anchor])
}
const queries: string[][] = rareQueries

const relevant = (query: string[]): Set<string> =>
  new Set(corpus.filter(doc => query.every(term => doc.terms.has(term))).map(doc => doc.id))

// Skipped unless the grader supplies the module under test, so a plain `bun test`
// over the repository stays green.
(ENTRY === undefined ? describe.skip : describe)('retrieval index', () => {
  test('recall at five and query latency meet the pre-registered targets', async () => {
    const { createIndex } = await import(ENTRY as string)
    const index = createIndex()
    const buildStart = performance.now()
    for (const doc of corpus) index.add(doc.id, doc.text)
    const buildMs = performance.now() - buildStart

    const latencies: number[] = []
    let hits = 0
    for (const query of queries) {
      const expected = relevant(query)
      const at = performance.now()
      const top = index.search(query.join(' '), 5)
      latencies.push(performance.now() - at)
      if (top.some(id => expected.has(id))) hits += 1
    }
    latencies.sort((a, b) => a - b)
    const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0
    const recall5 = hits / queries.length
    console.log(`MEASURE ${JSON.stringify({ build_ms: Math.round(buildMs), p95_ms: Number(p95.toFixed(4)), recall5 })}`)
    expect({ build: buildMs <= TARGETS.max_build_ms, recall: recall5 >= TARGETS.min_recall5, latency: p95 <= TARGETS.p95_query_ms })
      .toEqual({ build: true, recall: true, latency: true })
  }, 180_000)
})
