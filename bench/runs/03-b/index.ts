// Retrieval index: conjunctive keyword search over in-memory documents.
//
// Design (spike winner `c1`): an inverted index of token -> ascending posting
// list, with query terms resolved rarest-first and intersected by linear merge.
// Survivors are ranked by BM25 (tf saturation + idf + document-length norm) and
// the top k are picked with a bounded heap. Deterministic tie-break: add() order.
//
// Tokenization is shared by documents and queries:
//   text.toLowerCase().match(/[a-z0-9]+/g) ?? []
// so a document matches a query iff its token set contains every query token.

export interface Index {
  add(id: string, text: string): void
  search(query: string, k: number): string[]
}

const TOKEN_RE = /[a-z0-9]+/g
const K1 = 1.2
const B = 0.75

interface Posting {
  /** Ascending document indices (== add() order); parallel to `tfs`. */
  docs: number[]
  /** Raw term frequency per posting entry. */
  tfs: number[]
}

function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  const out: string[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(lower)) !== null) out.push(m[0])
  return out
}

export function createIndex(): Index {
  const ids: string[] = []
  const lens: number[] = []
  const postings = new Map<string, Posting>()
  let totalLen = 0
  // Cached k1*(1-b+b*dl/avgdl) per document; invalidated on add().
  let norms: Float64Array | null = null

  function add(id: string, text: string): void {
    const docIdx = ids.length
    ids.push(id)

    // Single pass: count length and term frequencies without a token array.
    const lower = text.toLowerCase()
    const tf = new Map<string, number>()
    let len = 0
    TOKEN_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TOKEN_RE.exec(lower)) !== null) {
      const t = m[0]
      len++
      tf.set(t, (tf.get(t) ?? 0) + 1)
    }
    lens.push(len)
    totalLen += len
    norms = null

    for (const [t, c] of tf) {
      let p = postings.get(t)
      if (p === undefined) {
        p = { docs: [], tfs: [] }
        postings.set(t, p)
      }
      p.docs.push(docIdx)
      p.tfs.push(c)
    }
  }

  function search(query: string, k: number): string[] {
    if (!(k > 0)) return []
    const want = Math.floor(k)

    // Deduplicate query tokens (first-seen order): repeating a term cannot
    // change the conjunctive match set.
    const uniq: string[] = []
    const seen = new Set<string>()
    for (const t of tokenize(query)) {
      if (!seen.has(t)) {
        seen.add(t)
        uniq.push(t)
      }
    }
    if (uniq.length === 0) return []

    // Resolve posting lists; a term absent from the corpus => nothing matches.
    const lists: Posting[] = new Array(uniq.length)
    for (let i = 0; i < uniq.length; i++) {
      const p = postings.get(uniq[i])
      if (p === undefined) return []
      lists[i] = p
    }

    // Rarest-first: smallest candidate set first, cheapest rejection later.
    const order: number[] = new Array(lists.length)
    for (let i = 0; i < order.length; i++) order[i] = i
    order.sort((a, b) => lists[a].docs.length - lists[b].docs.length)

    const n = ids.length
    if (norms === null) {
      const avgdl = n > 0 ? totalLen / n : 1
      const invAvgdl = avgdl > 0 ? 1 / avgdl : 0
      const base = K1 * (1 - B)
      const slope = K1 * B * invAvgdl
      const arr = new Float64Array(n)
      for (let i = 0; i < n; i++) arr[i] = base + slope * lens[i]
      norms = arr
    }
    const normArr = norms

    // Seed candidates with the rarest list, scoring it immediately.
    let candDocs = lists[order[0]].docs.slice()
    let candScores: number[] = new Array(candDocs.length)
    {
      const p = lists[order[0]]
      const df = p.docs.length
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      for (let i = 0; i < candDocs.length; i++) {
        const t = p.tfs[i]
        candScores[i] = (idf * (t * (K1 + 1))) / (t + normArr[candDocs[i]])
      }
    }

    // Intersect the remaining lists rarest-first, accumulating BM25 as we go.
    for (let oi = 1; oi < order.length && candDocs.length > 0; oi++) {
      const p = lists[order[oi]]
      const pd = p.docs
      const pt = p.tfs
      const df = pd.length
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))

      const outDocs: number[] = []
      const outScores: number[] = []
      let a = 0
      let b = 0
      while (a < candDocs.length && b < pd.length) {
        const da = candDocs[a]
        const db = pd[b]
        if (da === db) {
          const t = pt[b]
          outDocs.push(da)
          outScores.push(candScores[a] + (idf * (t * (K1 + 1))) / (t + normArr[da]))
          a++
          b++
        } else if (da < db) {
          a++
        } else {
          b++
        }
      }
      candDocs = outDocs
      candScores = outScores
    }

    if (candDocs.length === 0) return []

    // Rank: score desc, then add() order asc. Bounded top-k => O(n log k).
    const take = Math.min(want, candDocs.length)
    const better = (i: number, j: number): boolean => {
      const si = candScores[i]
      const sj = candScores[j]
      return si !== sj ? si > sj : candDocs[i] < candDocs[j]
    }

    const sel: number[] = []
    if (candDocs.length <= take * 2) {
      for (let i = 0; i < candDocs.length; i++) sel.push(i)
      sel.sort((x, y) => (better(x, y) ? -1 : better(y, x) ? 1 : 0))
      sel.length = take
    } else {
      // Root = worst kept element (lowest score, then highest doc index).
      const worse = (i: number, j: number): boolean => better(j, i)
      const siftDown = (start: number): void => {
        let pos = start
        for (;;) {
          const l = pos * 2 + 1
          if (l >= sel.length) return
          const r = l + 1
          let worst = l
          if (r < sel.length && worse(sel[r], sel[l])) worst = r
          if (!worse(sel[worst], sel[pos])) return
          const tmp = sel[pos]
          sel[pos] = sel[worst]
          sel[worst] = tmp
          pos = worst
        }
      }
      for (let i = 0; i < take; i++) sel.push(i)
      for (let i = (take >> 1) - 1; i >= 0; i--) siftDown(i)
      for (let i = take; i < candDocs.length; i++) {
        if (better(i, sel[0])) {
          sel[0] = i
          siftDown(0)
        }
      }
      sel.sort((x, y) => (better(x, y) ? -1 : better(y, x) ? 1 : 0))
    }

    const out: string[] = new Array(take)
    for (let i = 0; i < take; i++) out[i] = ids[candDocs[sel[i]]]
    return out
  }

  return { add, search }
}
