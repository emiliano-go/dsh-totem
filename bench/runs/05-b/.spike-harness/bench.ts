// Shared instrument: run the candidate's impl.ts over a fixed corpus.
import { impl } from './impl.ts'

type Meas = Record<string, number | boolean>
interface Criterion { readonly name: string; readonly direction: 'min' | 'max' | 'pass'; readonly weight: number }
interface Cand { readonly id: string; readonly measurements?: Meas }

const cases: { name: string; run: () => boolean }[] = []
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

// --- measurement parsing (spec half 1) ---
cases.push({ name: 'indented object with noise before', run: () =>
  eq(impl.readMeasurements('noise line\n{\n  "p95_ms": 42,\n  "secure": true\n}\n'), { p95_ms: 42, secure: true }) })
cases.push({ name: 'one-line object unchanged', run: () =>
  eq(impl.readMeasurements('{"p95_ms": 12}'), { p95_ms: 12 }) })
cases.push({ name: 'indented object with nested values', run: () =>
  eq(impl.readMeasurements('start\n{\n  "indexed": 20000,\n  "meta": {"nested": 1},\n  "list": [1, 2]\n}\n'), { indexed: 20000 }) })
cases.push({ name: 'brace inside a string does not break parsing', run: () =>
  eq(impl.readMeasurements('{\n  "text": "a } brace",\n  "n": 3\n}\n'), { n: 3 }) })
cases.push({ name: 'no JSON means no measurements', run: () =>
  eq(impl.readMeasurements('boom\nnot json\n'), {}) })
cases.push({ name: 'truncated object is not a measurement', run: () =>
  eq(impl.readMeasurements('{\n  "x":\n'), {}) })
cases.push({ name: 'the last object wins over earlier noise objects', run: () =>
  eq(impl.readMeasurements('{"first": 1}\nnoise\n{"second": 2}\n'), { second: 2 }) })

// --- pass semantics (spec half 2) ---
const passOn = (measurements: Meas): boolean => {
  const ranking = impl.rank([{ id: 'c', measurements }], [{ name: 'indexed', direction: 'pass', weight: 1 }])
  return ranking[0]?.qualified === true
}
cases.push({ name: 'pass true is satisfied', run: () => passOn({ indexed: true }) })
cases.push({ name: 'pass count 20000 is satisfied', run: () => passOn({ indexed: 20000 }) })
cases.push({ name: 'pass count 0 is not satisfied', run: () => passOn({ indexed: 0 }) })
cases.push({ name: 'pass false is not satisfied', run: () => passOn({ indexed: false }) })
cases.push({ name: 'pass missing is not satisfied', run: () => passOn({ other: 1 }) })
cases.push({ name: 'missing min measurement still disqualifies', run: () => {
  const ranking = impl.rank([{ id: 'c', measurements: { other: 1 } }, { id: 'd', measurements: { p95_ms: 9 } }], [{ name: 'p95_ms', direction: 'min', weight: 1 }] as Criterion[])
  return ranking.find(entry => entry.id === 'c')?.qualified === false && ranking[0]?.id === 'd'
} })

const passed = cases.filter(item => { try { return item.run() === true } catch { return false } }).length
console.log(JSON.stringify({ correctness: passed / cases.length, cases: cases.length }))
if (passed !== cases.length) {
  for (const item of cases) { try { if (item.run() !== true) console.error('FAIL', item.name) } catch (error) { console.error('FAIL', item.name, String(error)) } }
}
