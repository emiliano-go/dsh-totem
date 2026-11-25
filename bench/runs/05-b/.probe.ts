import { readMeasurements, rank } from './src/spike.ts'
const multi = 'noise\n{\n  "p95_ms": 42,\n  "deps": 3,\n  "secure": true\n}\n'
console.log('multi:', JSON.stringify(readMeasurements(multi)))
console.log('count:', JSON.stringify(rank([
  { id:'c1', angle:'a', dir:'x', elapsedMs:1, timedOut:false, files:1, loc:1, measurements:{ indexed: 20000 } },
], [{ name:'indexed', direction:'pass', weight:1 }])))
console.log('zero:', JSON.stringify(rank([
  { id:'c1', angle:'a', dir:'x', elapsedMs:1, timedOut:false, files:1, loc:1, measurements:{ indexed: 0 } },
], [{ name:'indexed', direction:'pass', weight:1 }])))
