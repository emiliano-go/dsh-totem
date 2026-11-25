import { rank as realRank, readMeasurements } from '../src/spike.ts'
export const impl = {
  readMeasurements,
  rank: (candidates: readonly { id: string; measurements?: Record<string, number | boolean> }[], criteria: readonly { name: string; direction: 'min' | 'max' | 'pass'; weight: number }[]) =>
    realRank(candidates as never, criteria as never),
}
