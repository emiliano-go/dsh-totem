import { createIndex } from './index'

const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'.split(' ')
let seed = 12345
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]

// Model: id -> current text (last write wins).
const model = new Map<string, string[]>()
const ix = createIndex()

function docTokens(text: string): string[] { return text.toLowerCase().match(/[a-z0-9]+/g) ?? [] }

for (let i = 0; i < 8000; i++) {
  const id = 'd' + Math.floor(rnd() * 5000) // collisions => replacements
  const n = 1 + Math.floor(rnd() * 20)
  const toks: string[] = []
  for (let j = 0; j < n; j++) toks.push(pick(words))
  const text = toks.join(' ') + (rnd() < 0.2 ? ' ALPHA, beta!' : '')
  model.set(id, docTokens(text))
  ix.add(id, text)
}

let bad = 0
let queries = 0
for (let q = 0; q < 1500; q++) {
  const n = 1 + Math.floor(rnd() * 3)
  const terms: string[] = []
  for (let j = 0; j < n; j++) terms.push(pick(words))
  const uniq = [...new Set(terms)]
  const k = [1, 3, 8, 50][Math.floor(rnd() * 4)]

  const want = new Set<string>()
  for (const [id, toks] of model) {
    const set = new Set(toks)
    if (uniq.every((t) => set.has(t))) want.add(id)
  }

  const got = ix.search(uniq.join(' '), k)
  queries++
  const gotSet = new Set(got)
  if (gotSet.size !== got.length) { bad++; console.error('dup ids', uniq, got) }
  for (const id of got) if (!want.has(id)) { bad++; console.error('irrelevant', uniq, id); break }
  if (want.size <= k) {
    if (got.length !== want.size) { bad++; console.error('missing', uniq, k, got.length, want.size) }
  } else if (got.length !== k) { bad++; console.error('length != k', uniq, k, got.length) }
}

console.log(`fuzz: ${queries} queries, ${bad} problems, live docs=${model.size}`)
if (bad > 0) process.exit(1)
