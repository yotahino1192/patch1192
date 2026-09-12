import test from 'node:test';
import assert from 'node:assert/strict';
import { sendAi } from '../lib/ai-client.ts';
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};}
test('network retry/reload retain key, account isolation, completed operation uses a new key',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');const s=storage();Object.defineProperty(globalThis,'sessionStorage',{value:s,configurable:true});
 try {const opts={method:'POST',headers:{'X-Patch-Account':'a'},body:'{"text":"private"}'};const seen=[];let fail=true;
 const transport=async(url,init)=>{seen.push(init.headers.get('Idempotency-Key'));if(fail)throw new TypeError('offline');return Response.json({});};
 await assert.rejects(sendAi(transport,'/api/ai/cards',opts));fail=false;
 const {sendAi:reloaded}=await import('../lib/ai-client.ts?reload');await reloaded(transport,'/api/ai/cards',opts);assert.equal(seen[0],seen[1]);
 await sendAi(transport,'/api/ai/cards',opts);assert.notEqual(seen[1],seen[2]);
 fail=true;await assert.rejects(sendAi(transport,'/api/ai/cards',opts));await assert.rejects(sendAi(transport,'/api/ai/cards',{...opts,headers:{'X-Patch-Account':'b'}}));assert.notEqual(seen[3],seen[4]);
 assert.ok(!JSON.stringify([...s.values]).includes('private'));
 }finally {if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});
test('unknown and in-progress preserve key without automatic retry; storage failure fails before send',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});
 try {const opts={method:'POST',headers:{'X-Patch-Account':'a'},body:'{}'},seen=[];
 for(const status of [503,409,200])await sendAi(async(_u,i)=>{seen.push(i.headers.get('Idempotency-Key'));return Response.json({},{status});},'/api/ai/chat',opts);
 assert.equal(new Set(seen).size,1);assert.equal(seen.length,3);
 Object.defineProperty(globalThis,'sessionStorage',{get(){throw Error('unavailable');},configurable:true});await assert.rejects(sendAi(async()=>assert.fail('sent'),'/api/ai/chat',opts));
 }finally {if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});

test('confirmed terminal response permits a later explicit action with a new key',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});
 try {const opts={method:'POST',headers:{'X-Patch-Account':'a'},body:'{}'},seen=[];
 for(let i=0;i<2;i++) await sendAi(async(_u,init)=>{seen.push(init.headers.get('Idempotency-Key'));return Response.json({code:'AI_REQUEST_FINAL'},{status:409});},'/api/ai/chat',opts);
 assert.notEqual(seen[0],seen[1]);assert.equal(seen.length,2);
 }finally {if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});
