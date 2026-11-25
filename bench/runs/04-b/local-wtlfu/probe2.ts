import { createCache } from './impl.ts'
const CAP=1000, HOT=6000, REQ=400000, SCAN_EVERY=25000, SCAN_LEN=2000, SEED=0x9e3779b9
function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
const cdf=new Float64Array(HOT); let mass=0
for(let i=0;i<HOT;i++){mass+=1/Math.pow(i+1,1.1);cdf[i]=mass}
for(let i=0;i<HOT;i++)cdf[i]/=mass
function sample(u){let lo=0,hi=HOT-1;while(lo<hi){const m=(lo+hi)>>>1;if(cdf[m]<u)lo=m+1;else hi=m}return lo}
const keys=new Array(REQ); const isScan=new Uint8Array(REQ)
const r=rng(SEED); let epoch=0,off=-1
for(let i=0;i<REQ;i++){
  if(i>0 && i%SCAN_EVERY===0){off=0;epoch++}
  let scan=false
  if(off>=0&&off<SCAN_LEN){keys[i]=`scan:${epoch}:${off}`;off++;scan=true}
  else{off=-1;keys[i]=`hot:${sample(r())}`}
  if(scan)isScan[i]=1
}
let scanCount=0,hotReq=0; const counts=new Map()
for(let i=0;i<REQ;i++){if(isScan[i])scanCount++;else{hotReq++;counts.set(keys[i],(counts.get(keys[i])||0)+1)}}
const sorted=[...counts.values()].sort((a,b)=>b-a); let top=0
for(let i=0;i<CAP;i++)top+=sorted[i]||0
console.log({scanCount,hotReq,distinct:counts.size,topCapShareHot:(top/hotReq).toFixed(4),topCapShareAll:(top/REQ).toFixed(4)})
// theoretical max overall hits if cache held exactly the top-CAP hot keys:
console.log("max overall hit_rate:", (top/REQ).toFixed(4))
