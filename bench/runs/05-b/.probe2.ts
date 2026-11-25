import { passSatisfied, rank, readMeasurements } from './src/spike.ts'
console.log('ps', passSatisfied(0), passSatisfied(true), passSatisfied(20000), passSatisfied(false), passSatisfied(undefined))
console.log(JSON.stringify(rank([{ id:'c', angle:'a', dir:'x', elapsedMs:1, timedOut:false, files:1, loc:1, measurements:{indexed:0} }], [{ name:'indexed', direction:'pass', weight:1 }])))
const multi = 'noise\n{\n  "p95_ms": 42,\n  "secure": true\n}\n'
console.log('multi', JSON.stringify(readMeasurements(multi)))
