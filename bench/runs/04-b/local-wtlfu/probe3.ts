import { createCache } from './impl.ts'
const CAP=1000, HOT=6000, REQ=400000, SCAN_EVERY=25000, SCAN_LEN=2000, SEED=0x9e3779b9
function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
const cdf=new Float64Array(HOT); let mass=0
for(let i=0;i<HOT;i++){mass+=1/Math.pow(i+1,1.1);cdf[i]=mass}
for(let i=0;i<HOT;i++)cdf[i]/=mass
function sample(u){let lo=0,hi=HOT-1;while(lo<hi){const m=(lo+hi)>>>1;if(cdf[m]<u)lo=m+1;else hi=m}return lo}
const cache = createCache(CAP)
const r=rng(SEED); let hits=0, scanHits=0, hotHits=0, hotReq=0, off=-1, epoch=0
let maxResident=0
for(let i=0;i<REQ;i++){
  if(i>0 && i%SCAN_EVERY===0){off=0;epoch++}
  let key, scan=false
  if(off>=0&&off<SCAN_LEN){key=`scan:${epoch}:${off}`;off++;scan=true}
  else{off=-1;key=`hot:${sample(r())}`}
  const v=cache.get(key)
  if(v===undefined) cache.put(key,key)
  else {hits++; if(scan)scanHits++; else hotHits++}
  if(!scan) hotReq++
}
console.log({hits, scanHits, hotHits, hotReq, hit_rate:(hits/REQ).toFixed(4), hot_rate:(hotHits/hotReq).toFixed(4)})
