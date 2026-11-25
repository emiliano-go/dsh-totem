// Spike harness: deterministic corpus, oracle for conjunctive term matching,
// latency and indexing-time measurement. Prints one JSON object on stdout.
import { createIndex } from "./index.ts"

type Rng = () => number

function lcg(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const TOKEN_RE = /[a-z0-9]+/g

function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  const out: string[] = []
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(lower)) !== null) out.push(m[0])
  return out
}

// Synthetic prose-like tokens: syllables -> words, Zipf-ish frequency.
const SYL = ["ka", "lo", "mi", "ra", "te", "su", "no", "vi", "za", "pe", "di", "gu", "fa", "ho", "ri", "sa"]
const VOCAB = 2500
const vocab: string[] = []
for (let i = 0; i < VOCAB; i++) {
  const r = lcg(i + 7)
  const n = 2 + Math.floor(r() * 2)
  let w = ""
  for (let j = 0; j < n; j++) w += SYL[Math.floor(r() * SYL.length)]
  vocab.push(w + (i % 5 === 0 ? String(i) : ""))
}

const rnd = lcg(20251125)
function zipfWord(): string {
  return vocab[Math.floor(Math.pow(rnd(), 2.2) * VOCAB)]
}

const DOCS = 2000
const docs: string[] = []
const docIds: string[] = []
for (let d = 0; d < DOCS; d++) {
  const len = 20 + Math.floor(rnd() * 110)
  const words: string[] = []
  for (let j = 0; j < len; j++) words.push(zipfWord())
  docs.push(words.join(" "))
  docIds.push("doc-" + d)
}

// Oracle: document ids containing every query token.
const oracleSets: Set<string>[] = docs.map((t, i) => {
  const s = new Set(tokenize(t))
  return s
})

const QUERIES = 300
const queries: { q: string; k: number }[] = []
for (let i = 0; i < QUERIES; i++) {
  const d = Math.floor(rnd() * DOCS)
  const toks = tokenize(docs[d])
  const count = 1 + Math.floor(rnd() * 3)
  const picked = new Set<string>()
  for (let j = 0; j < count && picked.size < toks.length; j++) {
    picked.add(toks[Math.floor(rnd() * toks.length)])
  }
  const k = [5, 10, 20, 50][Math.floor(rnd() * 4)]
  queries.push({ q: [...picked].join(" "), k })
}

function expectedSet(q: string): Set<string> {
  const toks = tokenize(q)
  const out = new Set<string>()
  if (toks.length === 0) return out
  docIds.forEach((id, i) => {
    const set = oracleSets[i]
    let ok = true
    for (const t of toks) if (!set.has(t)) { ok = false; break }
    if (ok) out.add(id)
  })
  return out
}

const expected = queries.map(x => expectedSet(x.q))

const idx = createIndex()
const tAdd0 = performance.now()
for (let i = 0; i < DOCS; i++) idx.add(docIds[i], docs[i])
const indexMs = performance.now() - tAdd0

let ok = true
let mismatches = 0
const q0 = performance.now()
for (let qi = 0; qi < queries.length; qi++) {
  const { q, k } = queries[qi]
  const got = idx.search(q, k)
  const exp = expected[qi]
  const gotSet = new Set(got)
  if (got.length > k || gotSet.size !== got.length) { ok = false; mismatches++ }
  if (exp.size <= k) {
    if (gotSet.size !== exp.size) { ok = false; mismatches++ }
    else for (const id of exp) if (!gotSet.has(id)) { ok = false; mismatches++; break }
  } else {
    if (gotSet.size !== k) { ok = false; mismatches++ }
    else for (const id of gotSet) if (!exp.has(id)) { ok = false; mismatches++; break }
  }
}
const queryUs = ((performance.now() - q0) / queries.length) * 1000

console.log(JSON.stringify({
  exact: ok ? 1 : 0,
  mismatches,
  query_us: Math.round(queryUs * 100) / 100,
  index_ms: Math.round(indexMs * 100) / 100,
}))
