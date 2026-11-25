// Textbook: recency. Scans flush the whole cache, which is the workload's point.
export function createCache(capacity: number) {
  const map = new Map<string, string>()
  return {
    get(key: string): string | undefined {
      const value = map.get(key)
      if (value === undefined) return undefined
      map.delete(key)
      map.set(key, value)
      return value
    },
    put(key: string, value: string): void {
      if (map.has(key)) map.delete(key)
      else if (map.size >= capacity) {
        const oldest = map.keys().next().value as string | undefined
        if (oldest !== undefined) map.delete(oldest)
      }
      map.set(key, value)
    },
  }
}
