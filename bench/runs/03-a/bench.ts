import { createIndex } from './index'

const VOCAB = 6000
let seed = 7
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
// Zipf-ish: high ranks are extremely common, like "the" in prose.
const words: string[] = []
for (let i = 0; i < VOCAB; i++) words.push('w' + i)
const weights: number[] = []
for (let i = 0; i < VOCAB; i++) weights.push(1 / Math.pow(i + 1, 1.1))
const cumulative: number[] = []
let acc = 0
for (const w of weights) { acc += w; cumulative.push(acc) }
function pick(): string {
  const r = rnd() * acc
  let lo = 0, hi = cumulative.length - 1
  while (lo < hi) { const m = (lo + hi) >> 1; if (cumulative[m] < r) lo = m + 1; else hi = m }
  return words[lo]
}

const N = 30000
const docs: Array<[string, string]> = []
for (let i = 0; i < N; i++) {
  const n = 20 + Math.floor(rnd() * 100)
  const toks: string[] = []
  for (let j = 0; j < n; j++) toks.push(pick())
  docs.push([`id${i}`, toks.join(' ')])
}

const ix = createIndex()
let t0 = performance.now()
for (const [id, text] of docs) ix.add(id, text)
const buildMs = performance.now() - t0

// Queries drawn from real document terms: the realistic generator shape.
const queries: string[][] = []
for (let q = 0; q < 2000; q++) {
  const src = docs[Math.floor(rnd() * N)][1].split(' ')
  const nt = 1 + Math.floor(rnd() * 4)
  const terms: string[] = []
  for (let j = 0; j < nt; j++) terms.push(src[Math.floor(rnd() * src.length)])
  queries.push([...new Set(terms)])
}

function run(queries: string[][], k: number) {
  const lat: number[] = []
  let total = 0
  for (const qs of queries) {
    const q = qs.join(' ')
    const t = performance.now()
    const r = ix.search(q, k)
    lat.push(performance.now() - t)
    total += r.length
  }
  lat.sort((a, b) => a - b)
  const p = (x: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * x))]
  return { p50: p(0.5), p95: p(0.95), p99: p(0.99), max: lat[lat.length - 1], avgHits: total / lat.length }
}

const k10 = run(queries, 10)
const k100 = run(queries, 100)

// Brute-force recall check on a sample.
function refTokenize(t: string): string[] { return t.toLowerCase().match(/[a-z0-9]+/g) ?? [] }
const tokenSets = new Map<string, Set<string>>()
for (const [id, text] of docs) tokenSets.set(id, new Set(refTokenize(text)))
let sampleMismatch = 0
let recallSum = 0
let sample = 0
for (let s = 0; s < 60; s++) {
  const qs = queries[Math.floor(rnd() * queries.length)]
  const want = new Set<string>()
  for (const [id] of docs) {
    const ts = tokenSets.get(id)!
    if (qs.every((t) => ts.has(t))) want.add(id)
  }
  const got = ix.search(qs.join(' '), 10)
  for (const id of got) if (!want.has(id)) { sampleMismatch++; break }
  const hit = got.filter((id) => want.has(id)).length
  recallSum += want.size === 0 ? 1 : Math.min(hit, 10) / Math.min(want.size, 10)
  sample++
}

// Worst-case shape: one very common term plus three rare ones.
const worst: string[][] = []
for (let i = 0; i < 200; i++) {
  worst.push(['w0', words[3000 + Math.floor(rnd() * 3000)], words[2000 + Math.floor(rnd() * 1000)], words[1000 + Math.floor(rnd() * 1000)]])
}
const kw = run(worst, 10)

console.log(`corpus ${N} docs, ${docs.reduce((n, [, t]) => n + t.length, 0) / 1e6} MB, ${docs.reduce((n, [, t]) => n + refTokenize(t).length, 0)} tokens`)
console.log(`build: ${buildMs.toFixed(0)} ms  (${((buildMs / N) * 1000).toFixed(1)} us/doc, ${(N / (buildMs / 1000) / 1000).toFixed(0)}k docs/s)`)
for (const [name, m] of [['k=10', k10], ['k=100', k100], ['k=10 common+3rare', kw]] as const) {
  console.log(`${name}: p50=${m.p50.toFixed(3)}ms p95=${m.p95.toFixed(3)}ms p99=${m.p99.toFixed(3)}ms max=${m.max.toFixed(3)}ms avgHits=${m.avgHits.toFixed(1)}`)
}
console.log(`brute-force sample: ${sampleMismatch} wrong-set queries / ${sample}, mean recall@10=${(recallSum / sample).toFixed(3)}`)
console.log(`rss=${(process.memoryUsage().rss / 1e6).toFixed(0)} MB heap=${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB`)
if (sampleMismatch > 0) process.exit(1)
