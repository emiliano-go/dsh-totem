import { createCache } from './impl.ts'
for (const cap of [1,2,3,10]) {
  const c = createCache(cap)
  for (let i = 0; i < 200; i++) c.put(`k${i}`, `v${i}`)
  let resident = 0
  for (let i = 0; i < 200; i++) if (c.get(`k${i}`) !== undefined) resident++
  console.log('cap', cap, 'resident', resident)
}
