// Reference: full scan per query. Correct, and the latency floor is the corpus.
export function createIndex() {
  const docs = new Map<string, string[]>()
  return {
    add(id: string, text: string): void { docs.set(id, text.split(/\s+/u)) },
    search(query: string, k: number): string[] {
      const terms = query.split(/\s+/u).filter(term => term.length > 0)
      const hits: string[] = []
      for (const [id, words] of docs) {
        if (terms.every(term => words.includes(term))) hits.push(id)
        if (hits.length >= k) break
      }
      return hits
    },
  }
}
