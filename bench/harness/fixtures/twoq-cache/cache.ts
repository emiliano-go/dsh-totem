// Two-queue policy: a scan only ever pollutes the probationary segment.
export function createCache(capacity: number) {
  const probation = new Map<string, string>()
  const protectedKeys = new Map<string, string>()
  const promoted = Math.floor(capacity * 0.75)
  const evict = (map: Map<string, string>): void => {
    const oldest = map.keys().next().value as string | undefined
    if (oldest !== undefined) map.delete(oldest)
  }
  return {
    get(key: string): string | undefined {
      const hit = protectedKeys.get(key)
      if (hit !== undefined) { protectedKeys.delete(key); protectedKeys.set(key, hit); return hit }
      const probe = probation.get(key)
      if (probe === undefined) return undefined
      probation.delete(key)
      protectedKeys.set(key, probe)
      if (protectedKeys.size > promoted) evict(protectedKeys)
      return probe
    },
    put(key: string, value: string): void {
      if (protectedKeys.has(key)) { protectedKeys.delete(key); protectedKeys.set(key, value); return }
      if (probation.has(key)) { probation.delete(key) }
      if (probation.size + protectedKeys.size >= capacity) {
        if (probation.size > 0) evict(probation)
        else evict(protectedKeys)
      }
      probation.set(key, value)
    },
  }
}
