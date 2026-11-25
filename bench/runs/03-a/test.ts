import { createIndex } from './index'

let pass = 0
let fail = 0
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) { pass++; return }
  fail++
  console.error(`FAIL ${name}\n  got  ${g}\n  want ${w}`)
}
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; return }
  fail++
  console.error(`FAIL ${name}${extra === undefined ? '' : ' ' + JSON.stringify(extra)}`)
}

// --- tokenisation / AND semantics -------------------------------------------
{
  const ix = createIndex()
  ix.add('a', 'The quick brown fox jumps over the lazy dog')
  ix.add('b', 'quick red fox')
  ix.add('c', 'lazy dog sleeps')
  ix.add('d', 'Quick Brown Fox')

  // exact set check, order-insensitive
  const s = (q: string, k = 10) => ix.search(q, k).sort()
  eq('and 1', s('quick'), ['a', 'b', 'd'])
  eq('and 2', s('quick fox'), ['a', 'b', 'd'])
  eq('and 3', s('quick dog'), ['a'])
  eq('and 4', s('fox dog'), ['a'])
  eq('and 5', s('missing'), [])
  eq('and 6', s('quick missing'), [])
  eq('k=1', ix.search('quick fox', 1).length, 1)
  eq('k=2', ix.search('quick', 2).length, 2)
  eq('k=0', ix.search('quick', 0), [])
  eq('k negative', ix.search('quick', -3), [])
  eq('case', s('QUICK FOX'), ['a', 'b', 'd'])
  eq('punctuation', s('  quick,  FOX!! '), ['a', 'b', 'd'])
  eq('repeated term', s('fox fox fox'), ['a', 'b', 'd'])
  eq('empty query returns first k', ix.search('', 2), ['a', 'b'])
  eq('whitespace query', ix.search('   ', 1), ['a'])
}

// --- duplicate id replaces ---------------------------------------------------
{
  const ix = createIndex()
  ix.add('x', 'alpha beta')
  ix.add('y', 'alpha gamma')
  eq('before replace', ix.search('beta', 5), ['x'])
  ix.add('x', 'gamma delta')
  eq('after replace, id still live', ix.search('gamma', 5).sort(), ['x', 'y'])
  eq('after replace, old text gone', ix.search('beta', 5), [])
  eq('no duplicate ids in result', ix.search('delta', 5), ['x'])
}

// --- prefix fallback (only when a term has no exact posting) -----------------
{
  const ix = createIndex()
  ix.add('p', 'the runners were running quickly')
  ix.add('q', 'a lone runner')
  // "runner" is only a token in q; p holds "runners"/"running", so the strict
  // path returns q alone (no prefix expansion is applied when it is non-empty).
  eq('exact wins', ix.search('runner', 5), ['q'])
  eq('prefix fallback', ix.search('run', 5).sort(), ['p', 'q'])
  eq('prefix + exact mix', ix.search('run quickly', 5), ['p'])
  // no exact posting for "zzz" => empty
  eq('unknown term', ix.search('zzz runner', 5), [])
}

// --- ranking sanity: best first ---------------------------------------------
{
  const ix = createIndex()
  ix.add('long', 'cat ' + 'filler '.repeat(40) + 'end')
  ix.add('tight', 'dog cat cat cat')
  ix.add('mid', 'cat cat and some other words here')
  const r = ix.search('cat', 3)
  ok('short/tf-heavy doc first', r[0] === 'tight', r)
  eq('all three returned', r.sort(), ['long', 'mid', 'tight'])
}

// --- differential test against a brute-force reference ----------------------
function refTokenize(t: string): string[] {
  return t.toLowerCase().match(/[a-z0-9]+/g) ?? []
}
function refSearch(docs: Array<[string, string]>, query: string, k: number): Set<string> {
  const terms = new Set(refTokenize(query))
  const out = new Set<string>()
  if (terms.size === 0) return out
  for (const [id, text] of docs) {
    const toks = new Set(refTokenize(text))
    if ([...terms].every((t) => toks.has(t))) out.add(id)
  }
  if (out.size <= k) return out
  return out
}

const words = ('alpha bravo charlie delta echo foxtrot golf hotel india juliet '
  + 'kilo lima mike november oscar papa quebec romeo sierra tango uniform victor '
  + 'whiskey xray yankee zulu red green blue cyan magenta yellow black white').split(' ')

let seed = 42
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
function pick<T>(a: T[]): T { return a[Math.floor(rnd() * a.length)] }

const corpus: Array<[string, string]> = []
for (let i = 0; i < 3000; i++) {
  const n = 12 + Math.floor(rnd() * 70)
  const toks: string[] = []
  for (let j = 0; j < n; j++) toks.push(pick(words))
  corpus.push([`doc${i}`, toks.join(' ')])
}

{
  const ix = createIndex()
  const t0 = performance.now()
  for (const [id, text] of corpus) ix.add(id, text)
  const buildMs = performance.now() - t0

  let checks = 0
  let setMismatch = 0
  const lat: number[] = []
  for (let q = 0; q < 400; q++) {
    const terms: string[] = []
    const nt = 1 + Math.floor(rnd() * 3)
    for (let j = 0; j < nt; j++) terms.push(pick(words))
    const query = terms.join(' ')
    const k = [1, 5, 10, 100, 1000][Math.floor(rnd() * 5)]

    const t = performance.now()
    const got = ix.search(query, k)
    lat.push(performance.now() - t)

    const want = refSearch(corpus, query, k)
    checks++
    // every returned doc must be relevant
    for (const id of got) if (!want.has(id)) { setMismatch++; break }
    // and if the truth set fits in k, we must return all of it
    if (want.size <= k) {
      const g = new Set(got)
      for (const id of want) if (!g.has(id)) { setMismatch++; break }
      if (got.length !== want.size) setMismatch++
    } else if (got.length !== k) setMismatch++
  }
  lat.sort((a, b) => a - b)
  const p = (q: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * q))]
  console.log(`\n[bench] corpus=${corpus.length} docs, ${corpus.reduce((n, [, t]) => n + refTokenize(t).length, 0)} tokens`)
  console.log(`[bench] build ${buildMs.toFixed(1)} ms (${(buildMs / corpus.length * 1000).toFixed(0)} us/doc)`)
  console.log(`[bench] queries=400 mismatches=${setMismatch}/${checks}`)
  console.log(`[bench] latency p50=${p(0.5).toFixed(3)}ms p95=${p(0.95).toFixed(3)}ms p99=${p(0.99).toFixed(3)}ms max=${lat[lat.length - 1].toFixed(3)}ms`)
  eq('differential: no mismatch', setMismatch, 0)
}

// --- k larger than candidate set --------------------------------------------
{
  const ix = createIndex()
  ix.add('1', 'solo')
  eq('k > n', ix.search('solo', 100), ['1'])
}

// --- no docs ----------------------------------------------------------------
{
  const ix = createIndex()
  eq('empty index', ix.search('anything', 5), [])
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
