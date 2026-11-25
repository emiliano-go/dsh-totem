/**
 * In-memory keyword retrieval index.
 *
 * Semantics: a document is relevant to a query when it contains *every* token
 * of the query (conjunctive / AND retrieval). `search` returns document ids,
 * best first (BM25), at most `k`.
 *
 * Design
 * ------
 * - Inverted index: term -> flat posting list `[docId, tf, docId, tf, ...]`,
 *   sorted by docId because documents are numbered in insertion order and only
 *   appended. No per-posting objects, no per-query allocation of big structures.
 * - Tokens are maximal runs of `[a-z0-9]` over lowercased text, so query and
 *   document tokenization are identical.
 * - Query: pick the shortest posting list, walk it, and gallop-search the
 *   remaining lists from a monotonic cursor. Cost is O(|shortest| * terms *
 *   log(n)) rather than O(sum of list lengths), which matters when the query
 *   contains a common term.
 * - Ranking: BM25 (k1 = 1.2, b = 0.75) over the candidate set, top-k via a
 *   bounded min-heap (O(n log k)); ties broken by insertion order.
 * - Fallback: if a query term has no exact posting at all, the AND result is
 *   known to be empty, so the term is retried as a prefix (morphological
 *   variation) by merging all matching terms' postings. Only that path pays for
 *   a sorted term list.
 */

export interface Index {
  add(id: string, text: string): void
  search(query: string, k: number): string[]
}

const K1 = 1.2
const B = 0.75

const isTokChar = (c: number): boolean =>
  (c >= 97 && c <= 122) || (c >= 48 && c <= 57)

/** Lowercase ASCII-word tokeniser, identical for documents and queries. */
function tokenize(text: string): string[] {
  const s = text.toLowerCase()
  const n = s.length
  const out: string[] = []
  let i = 0
  while (i < n) {
    if (!isTokChar(s.charCodeAt(i))) { i++; continue }
    const start = i
    while (i < n && isTokChar(s.charCodeAt(i))) i++
    out.push(s.slice(start, i))
  }
  return out
}

/**
 * Binary-search `doc` in a flat `[doc, tf, ...]` list, starting at entry `from`
 * and galloping forward (candidate docIds are visited in ascending order).
 * Returns the entry index, or -1.
 */
function findFrom(list: number[], doc: number, from: number): number {
  const n = list.length >> 1
  let i = from
  if (i >= n) return -1
  let v = list[i << 1]
  if (v === doc) return i
  if (v > doc) return -1

  // Gallop to bracket the target.
  let step = 1
  let hi = i + 1
  while (hi < n && list[hi << 1] < doc) {
    i = hi
    step <<= 1
    hi = i + step
  }
  if (hi > n - 1) hi = n - 1

  // Binary search in (i, hi].
  let lo = i + 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const mv = list[mid << 1]
    if (mv === doc) return mid
    if (mv < doc) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

class RetrievalIndex implements Index {
  /** term -> flat posting list `[docId, tf, ...]`, ascending by docId. */
  private postings = new Map<string, number[]>()
  private docIds: string[] = []
  private docLen: number[] = []
  /** false for a docId superseded by a later `add` of the same id. */
  private alive: boolean[] = []
  private idToDoc = new Map<string, number>()
  private liveCount = 0
  private totalLen = 0
  /** Lazily built, only used by the prefix-fallback path. */
  private sortedTerms: string[] | null = null

  add(id: string, text: string): void {
    const prev = this.idToDoc.get(id)
    if (prev !== undefined) {
      this.alive[prev] = false
      this.liveCount--
      this.totalLen -= this.docLen[prev]
    }

    const doc = this.docIds.length
    this.docIds.push(id)
    this.idToDoc.set(id, doc)
    this.alive.push(true)
    this.liveCount++
    this.sortedTerms = null

    const lower = text.toLowerCase()
    const postings = this.postings
    const n = lower.length
    let count = 0
    let i = 0
    while (i < n) {
      if (!isTokChar(lower.charCodeAt(i))) { i++; continue }
      const start = i
      i++
      while (i < n && isTokChar(lower.charCodeAt(i))) i++
      const tok = lower.slice(start, i)
      count++
      const list = postings.get(tok)
      if (list === undefined) {
        postings.set(tok, [doc, 1])
      } else {
        const len = list.length
        // Same doc repeats are always appended at the tail (docIds ascend).
        if (len !== 0 && list[len - 2] === doc) list[len - 1]++
        else list.push(doc, 1)
      }
    }

    this.docLen.push(count)
    this.totalLen += count
  }

  search(query: string, k: number): string[] {
    if (!(k > 0)) return []
    const limit = k === Infinity ? Infinity : Math.floor(k)
    if (limit <= 0) return []

    const N = this.liveCount
    if (N === 0) return []

    const terms: string[] = []
    for (const t of tokenize(query)) {
      if (terms.indexOf(t) < 0) terms.push(t)
    }

    // Empty query: every document trivially contains every (zero) term.
    if (terms.length === 0) {
      const out: string[] = []
      for (let d = 0; d < this.docIds.length && out.length < limit; d++) {
        if (this.alive[d]) out.push(this.docIds[d])
      }
      return out
    }

    const lists: Array<number[] | undefined> = new Array(terms.length)
    let missing = false
    for (let i = 0; i < terms.length; i++) {
      const l = this.postings.get(terms[i])
      lists[i] = l
      if (l === undefined) missing = true
    }
    // A term with no posting means the AND result is already empty; retry the
    // unknown terms as prefixes before giving up.
    if (missing && !this.expandPrefixes(terms, lists)) return []

    const nTerms = terms.length
    let shortIdx = 0
    for (let i = 1; i < nTerms; i++) {
      if (lists[i]!.length < lists[shortIdx]!.length) shortIdx = i
    }

    const avgLen = this.totalLen / N
    const idf = new Float64Array(nTerms)
    for (let i = 0; i < nTerms; i++) {
      const df = lists[i]!.length >> 1
      idf[i] = Math.log(1 + (N - df + 0.5) / (df + 0.5))
    }

    const shortList = lists[shortIdx]!
    const nShort = shortList.length >> 1
    const cursors = new Int32Array(nTerms)

    // Bounded min-heap: root is the worst kept result.
    const hDocs: number[] = []
    const hScores: number[] = []
    const worse = (a: number, sa: number, b: number, sb: number): boolean =>
      sa < sb || (sa === sb && a > b)

    const siftUp = (i: number): void => {
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (!worse(hDocs[i], hScores[i], hDocs[parent], hScores[parent])) break
        const td = hDocs[i]; hDocs[i] = hDocs[parent]; hDocs[parent] = td
        const ts = hScores[i]; hScores[i] = hScores[parent]; hScores[parent] = ts
        i = parent
      }
    }
    const siftDown = (i: number): void => {
      const n = hDocs.length
      for (;;) {
        const l = i * 2 + 1
        if (l >= n) break
        const r = l + 1
        const child = r < n && worse(hDocs[r], hScores[r], hDocs[l], hScores[l]) ? r : l
        if (!worse(hDocs[child], hScores[child], hDocs[i], hScores[i])) break
        const td = hDocs[i]; hDocs[i] = hDocs[child]; hDocs[child] = td
        const ts = hScores[i]; hScores[i] = hScores[child]; hScores[child] = ts
        i = child
      }
    }

    const docLen = this.docLen
    const alive = this.alive

    for (let p = 0; p < nShort; p++) {
      const doc = shortList[p << 1]
      if (!alive[doc]) continue

      // Candidate membership + term frequencies, one gallop per other list.
      const dl = docLen[doc]
      const denomBase = K1 * (1 - B + (B * dl) / avgLen)
      const tf0 = shortList[(p << 1) + 1]
      let final = (idf[shortIdx] * (tf0 * (K1 + 1))) / (tf0 + denomBase)
      let ok = true
      for (let t = 0; t < nTerms; t++) {
        if (t === shortIdx) continue
        const list = lists[t]!
        const pos = findFrom(list, doc, cursors[t])
        if (pos < 0) { ok = false; break }
        cursors[t] = pos
        const tf = list[(pos << 1) + 1]
        final += (idf[t] * (tf * (K1 + 1))) / (tf + denomBase)
      }
      if (!ok) continue

      if (hDocs.length < limit) {
        hDocs.push(doc)
        hScores.push(final)
        siftUp(hDocs.length - 1)
      } else if (worse(hDocs[0], hScores[0], doc, final)) {
        hDocs[0] = doc
        hScores[0] = final
        siftDown(0)
      }
    }

    // Order the survivors best-first.
    const order = hDocs.map((_, i) => i)
    order.sort((a, b) => hScores[b] - hScores[a] || hDocs[a] - hDocs[b])
    const out: string[] = new Array(order.length)
    for (let i = 0; i < order.length; i++) out[i] = this.docIds[hDocs[order[i]]]
    return out
  }

  /**
   * Replace every term with no exact posting by the union of the postings of
   * all indexed terms that start with it. Returns false when the AND result is
   * provably empty.
   */
  private expandPrefixes(terms: string[], lists: Array<number[] | undefined>): boolean {
    if (this.sortedTerms === null) {
      this.sortedTerms = Array.from(this.postings.keys()).sort()
    }
    const st = this.sortedTerms

    for (let i = 0; i < terms.length; i++) {
      if (lists[i] !== undefined) continue
      const prefix = terms[i]
      // A one-character prefix would fan out over half the vocabulary; the
      // fallback is for morphological variants, not for wildcards.
      if (prefix.length < 2) return false

      let lo = 0
      let hi = st.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (st[mid] < prefix) lo = mid + 1
        else hi = mid
      }

      const merged = new Map<number, number>()
      let budget = 500_000 // entries scanned before giving up
      for (let j = lo; j < st.length; j++) {
        const t = st[j]
        if (!t.startsWith(prefix)) break
        const l = this.postings.get(t)!
        budget -= l.length >> 1
        if (budget < 0) return false
        for (let p = 0; p < l.length; p += 2) {
          const d = l[p]
          merged.set(d, (merged.get(d) ?? 0) + l[p + 1])
        }
      }
      if (merged.size === 0) return false

      const docs = Array.from(merged.keys()).sort((a, b) => a - b)
      const flat = new Array<number>(docs.length * 2)
      for (let p = 0; p < docs.length; p++) {
        flat[p * 2] = docs[p]
        flat[p * 2 + 1] = merged.get(docs[p])!
      }
      lists[i] = flat
    }
    return true
  }
}

export function createIndex(): Index {
  return new RetrievalIndex()
}
