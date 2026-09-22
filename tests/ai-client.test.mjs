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

for (const finalCode of ['AI_REQUEST_FINAL', 'AI_INVALID_GENERATED_CONTENT']) test(`${finalCode}: confirmed terminal response permits a later explicit action with a new key`,async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});
 try {const opts={method:'POST',headers:{'X-Patch-Account':'a'},body:'{}'},seen=[];
 for(let i=0;i<2;i++) await sendAi(async(_u,init)=>{seen.push(init.headers.get('Idempotency-Key'));return Response.json({code:finalCode},{status:409});},'/api/ai/chat',opts);
 assert.notEqual(seen[0],seen[1]);assert.equal(seen.length,2);
 }finally {if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});
test('Privacy-generated operation UUID changes do not bypass an unknown pending request',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{value:storage(),configurable:true});
 try {const sent=[];for(let i=0;i<2;i++)await sendAi(async(_u,init)=>{sent.push({key:init.headers.get('Idempotency-Key'),body:JSON.parse(init.body)});return Response.json({code:'AI_UNKNOWN'},{status:503});},'/api/ai/cards',{method:'POST',headers:{'X-Patch-Account':'a'},body:JSON.stringify({text:'private',operationId:crypto.randomUUID()})});
 assert.equal(sent[0].key,sent[1].key);assert.deepEqual(sent[0].body,sent[1].body);assert.equal(sent[0].key,sent[0].body.operationId);
 const controller=new AbortController();controller.abort();await assert.rejects(sendAi(async()=>assert.fail('stale native dispatch'),'/api/ai/cards',{method:'POST',headers:{'X-Patch-Account':'a'},body:'{}',signal:controller.signal}),{name:'AbortError'});
 }finally{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});

test('truncated successful response retains its operation identity for an explicit retry',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');const disk=storage();Object.defineProperty(globalThis,'sessionStorage',{value:disk,configurable:true});
 try {
  const seen=[],opts={method:'POST',headers:{'X-Patch-Account':'a'},body:'{"text":"private"}'};
  const broken=await sendAi(async(_u,o)=>{seen.push(o.headers.get('Idempotency-Key'));return new Response('{"answer":',{status:200});},'/api/ai/cards',opts);
  await assert.rejects(broken.json());
  await sendAi(async(_u,o)=>{seen.push(o.headers.get('Idempotency-Key'));return Response.json({answer:'complete'});},'/api/ai/cards',opts);
  assert.equal(seen[0],seen[1]);
 }finally{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});

test('abort of an uncancellable transport sends a scoped cancellation and retains retry identity',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');const disk=storage();Object.defineProperty(globalThis,'sessionStorage',{value:disk,configurable:true});
 try {
  const controller=new AbortController();let cancelled,admitted;
  const transport=async(url,options)=>{
   if(url.endsWith('/cancel')){cancelled={url,options};return Response.json({accepted:true});}
   admitted=options;controller.abort();await Promise.resolve();return Response.json({answer:'late'});
  };
  await sendAi(transport,'https://api.example.test/api/ai/chat',{method:'POST',headers:{'X-Patch-Account':'A',Authorization:'Bearer test'},body:'{}',signal:controller.signal});
  assert.equal(cancelled.url,'https://api.example.test/api/ai/cancel');assert.equal(cancelled.options.headers.get('X-Patch-Account'),'A');assert.equal(cancelled.options.signal,undefined);
  assert.equal(JSON.parse(cancelled.options.body).operationKey,admitted.headers.get('Idempotency-Key'));assert.equal(disk.values.size,1);
 }finally{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});
