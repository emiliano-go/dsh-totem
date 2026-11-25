impl.ts must export `const impl: Impl` where:
interface Impl {
  readMeasurements(stdout: string): Record<string, number | boolean>
  rank(candidates: readonly Cand[], criteria: readonly Criterion[]): { id: string; qualified: boolean }[]
}
Cand = { id: string; measurements?: Record<string, number | boolean> }
Criterion = { name: string; direction: 'min' | 'max' | 'pass'; weight: number }
