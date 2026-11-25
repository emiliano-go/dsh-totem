// Reference: inverted index with posting-list intersection.
export function createIndex() {
  const postings = new Map<string, Set<string>>()
  return {
    add(id: string, text: string): void {
      for (const term of new Set(text.split(/\s+/u))) {
        let list = postings.get(term)
        if (list === undefined) { list = new Set(); postings.set(term, list) }
        list.add(id)
      }
    },
    search(query: string, k: number): string[] {
      const terms = [...new Set(query.split(/\s+/u).filter(term => term.length > 0))]
      if (terms.length === 0) return []
      const lists = terms.map(term => postings.get(term) ?? new Set<string>()).sort((a, b) => a.size - b.size)
      const ids: string[] = []
      for (const id of lists[0] as Set<string>) {
        if (lists.every(list => list.has(id))) ids.push(id)
        if (ids.length >= k) break
      }
      return ids
    },
  }
}
