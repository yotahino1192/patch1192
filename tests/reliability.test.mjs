import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/.test(s))return n(new URL(s+'.ts',c.parentURL).href,c);return n(s,c);}});
const {ReliabilityError,classifyStatus,readApiResponse,retryPolicy,retryAfter}=await import('../lib/reliability/errors.ts');
const {reliableRequest,withDeadline}=await import('../lib/reliability/transport.ts');
const {configureDiagnostics,reportDiagnostic}=await import('../lib/reliability/observability.ts');
const {singleFlight,watchNetwork}=await import('../lib/reliability/network.ts');
const {observeRoute,readinessProbe}=await import('../lib/reliability/server.ts');
const {createAccountScope,StaleAccountError}=await import('../lib/account-scope.ts');
const {sendAi}=await import('../lib/ai-client.ts');
const {writeAccountWorkspace,workspaceKey,readAccountWorkspace,clearAccountWorkspace}=await import('../lib/account-storage.ts');
const {EMPTY_WORKSPACE}=await import('../lib/workspace.ts');
const owner={userId:'10000000-0000-4000-8000-000000000001',subject:'user_A',sessionId:'sess_A'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};

test('complete API outage and body stall terminate without retries or raw error disclosure',async()=>{
 let calls=0;await assert.rejects(reliableRequest(async()=>{calls++;throw Error('token=secret user@example.com material');},'/api/data'),e=>e.kind==='server'&&!e.message.includes('secret'));assert.equal(calls,1);
 await assert.rejects(reliableRequest(async()=>new Response(new ReadableStream({start(){}})),'/api/data',{},10),e=>e.kind==='timeout');
 let dispatched=0;const c=new AbortController();c.abort();await assert.rejects(reliableRequest(async()=>{dispatched++;return Response.json({});},'/api/data',{signal:c.signal}),e=>e.kind==='cancelled');assert.equal(dispatched,0);
});
test('offline rejects before dispatch; online/foreground only signal, never replay',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:false}});
 try{let calls=0;await assert.rejects(reliableRequest(async()=>{calls++;return Response.json({});},'/api/data'),e=>e.kind==='offline');assert.equal(calls,0);}finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;}
 const w=new EventTarget(),d=new EventTarget();w.navigator={onLine:false};d.visibilityState='visible';const seen=[];const stop=watchNetwork(s=>seen.push(s),w,d);w.navigator.onLine=true;w.dispatchEvent(new Event('online'));d.dispatchEvent(new Event('visibilitychange'));stop();w.dispatchEvent(new Event('offline'));assert.deepEqual(seen,['offline','reconnected','foreground']);
});
test('all failure categories and Retry-After retain semantics without exposing response body',async()=>{
 for(const [status,code,kind] of [[401,'AUTH','unauthorized'],[403,'DENIED','forbidden'],[404,'MISSING','not_found'],[409,'REVIEW_CONFLICT','conflict'],[429,'AI_QUOTA','rate_limit'],[503,'SCHEMA_NOT_READY','schema_not_ready'],[503,'AI_PROVIDER_FAILED','ai_unavailable'],[409,'AI_UNKNOWN','unknown'],[500,undefined,'server']]){
  assert.equal(classifyStatus(status,code),kind);
  await assert.rejects(readApiResponse(Response.json({code,error:'secret@example.com full material'},{status,headers:{'retry-after':'2'}})),e=>e.kind===kind&&e.retryAfterMs===2000&&!e.message.includes('secret'));
 }
 assert.equal(retryAfter('bogus'),0);assert.equal(retryAfter('-1'),0);
 const read=retryPolicy(new ReliabilityError('timeout'),'GET');assert.equal(read.manual,true);assert.equal(read.automatic,false);
 for(const method of ['POST','PUT','DELETE']){const p=retryPolicy(new ReliabilityError('timeout'),method,true);assert.equal(p.manual,false);assert.equal(p.reconcileFirst,true);assert.equal(p.preserveOperationId,true);}
 assert.equal(retryPolicy(new ReliabilityError('unknown'),'GET').manual,false);
 await assert.rejects(readApiResponse(new Response('<html>private</html>')),e=>e.kind==='invalid_response'&&!e.message.includes('private'));
});
test('rapid manual read retry is single flight; failure releases lock for recovery',async()=>{
 let calls=0;const retry=singleFlight(async()=>{calls++;await delay(10);if(calls===1)throw Error('down');return 42;});
 const results=await Promise.allSettled(Array.from({length:20},()=>retry()));assert.equal(calls,1);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(await retry(),42);assert.equal(calls,2);
});
test('late native response and late token cannot escape invalidated account',async()=>{
 let release;const waiting=new Promise(r=>release=r);
 const a=createAccountScope(owner,{},(u,o)=>reliableRequest(async()=>{await waiting;return Response.json({private:'A'});},u,o));
 const pending=a.request('/api/data');a.invalidate();release();await assert.rejects(pending,StaleAccountError);
 let releaseToken;const b=createAccountScope(owner,{getToken:()=>new Promise(r=>releaseToken=r)},async()=>{throw Error('must not dispatch');});const token=b.request('/api/data');await delay(0);b.invalidate();releaseToken('B');await assert.rejects(token,StaleAccountError);
});
test('Clerk temporary token error does not dispatch and allows explicit retry',async()=>{
 let failed=true,calls=0;const a=createAccountScope(owner,{getToken:async()=>{if(failed)throw Error('SDK');return 'fixture';}},async()=>{calls++;return Response.json({});});
 await assert.rejects(a.request('/api/data'));assert.equal(calls,0);failed=false;await a.request('/api/data');assert.equal(calls,1);
 await assert.rejects(withDeadline(()=>new Promise(()=>{}),5),e=>e.kind==='timeout');
});
test('AI timeout/unknown keeps operation key and makes no automatic OpenAI retry',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:memory()});
 try{const keys=[];const options={method:'POST',headers:{'X-Patch-Account':owner.userId},body:JSON.stringify({text:'private material',operationId:'first'})};
 const transport=async(_u,o)=>{keys.push([o.headers.get('Idempotency-Key'),JSON.parse(o.body).operationId]);if(keys.length===1)throw new ReliabilityError('timeout');return Response.json({code:'AI_UNKNOWN'},{status:409});};
 await assert.rejects(sendAi(transport,'/api/ai/cards',options));await delay(10);assert.equal(keys.length,1);
 await sendAi(transport,'/api/ai/cards',{...options,body:JSON.stringify({text:'private material',operationId:'second'})});assert.deepEqual(keys,[['first','first'],['first','first']]);
 }finally{if(old)Object.defineProperty(globalThis,'sessionStorage',old);else delete globalThis.sessionStorage;}
});
test('corrupted local state is preserved before repair; logout removes scoped recovery only',()=>{
 const s=memory(),key=workspaceKey(owner.userId);s.setItem(key,'{broken private material');assert.deepEqual(readAccountWorkspace(s,owner.userId),EMPTY_WORKSPACE);
 writeAccountWorkspace(s,owner.userId,EMPTY_WORKSPACE);assert.equal(s.getItem(key+':recovery'),'{broken private material');writeAccountWorkspace(s,owner.userId,EMPTY_WORKSPACE);assert.equal(s.getItem(key+':recovery'),'{broken private material');s.setItem('unrelated','keep');clearAccountWorkspace(s,owner.userId);assert.equal(s.getItem(key+':recovery'),null);assert.equal(s.getItem('unrelated'),'keep');
 const full={getItem:()=>'{broken',setItem:()=>{throw Error('full');}};assert.throws(()=>writeAccountWorkspace(full,owner.userId,EMPTY_WORKSPACE));
});
test('diagnostics discard secrets, raw external errors and arbitrary fields; sink failure is harmless',()=>{
 const records=[],stop=configureDiagnostics(r=>records.push(r));const secret='email@example.com token Bearer private material';
 reportDiagnostic({event:'fatal',requestId:secret,kind:secret,status:secret,durationMs:NaN,error:new Error(secret),body:secret,email:secret});
 assert.deepEqual(records,[{event:'fatal'}]);stop();const stop2=configureDiagnostics(()=>{throw Error(secret);});assert.doesNotThrow(()=>reportDiagnostic({event:'fatal'}));stop2();
});
test('server correlation and failure response contain only public status and random ID',async()=>{
 const logs=[],original=console.info;console.info=s=>logs.push(s);
 try{const handler=observeRoute(async()=>{throw Error('email@example.com secret body');});const r=await handler(new Request('https://patch.invalid/api/data?token=secret',{headers:{'x-request-id':'email@example.com'}}));assert.equal(r.status,503);assert.match(r.headers.get('x-request-id'),/^[0-9a-f-]{36}$/);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(logs).includes('secret'));assert.ok(!(await r.text()).includes('secret'));}finally{console.info=original;}
});
test('Turso readiness fails closed, coalesces calls and recovers without DDL or exposing details',async()=>{
 let calls=0,fail=true;const ready=readinessProbe(async()=>{calls++;await delay(5);if(fail)throw Error('secret DB');},20,1);
 assert.ok((await Promise.all(Array.from({length:10},()=>ready()))).every(x=>!x));assert.equal(calls,1);fail=false;await delay(2);assert.equal(await ready(),true);assert.equal(calls,2);
 let hanging=0;const blocked=readinessProbe(()=>{hanging++;return new Promise(()=>{});},5,1);assert.equal(await blocked(),false);await delay(2);assert.equal(await blocked(),false);assert.equal(hanging,1);
});

test('429 cooldown blocks repeated dispatch and stays account/session scoped',async()=>{
 let calls=0;const route='/api/cooldown-test';const transport=async()=>{calls++;return Response.json({code:'AI_QUOTA'},{status:429,headers:{'Retry-After':'1'}});};
 await reliableRequest(transport,route,{headers:{'X-Patch-Account':'A','X-Patch-Session':'one'}});
 await assert.rejects(reliableRequest(transport,route,{headers:{'X-Patch-Account':'A','X-Patch-Session':'one'}}),e=>e.kind==='rate_limit'&&e.retryAfterMs>0);
 assert.equal(calls,1);await reliableRequest(transport,route,{headers:{'X-Patch-Account':'B','X-Patch-Session':'two'}});assert.equal(calls,2);
});

test('malformed nested draft is kept as an original recovery copy before normalized state is saved',()=>{
 const storage=memory(),key=workspaceKey(owner.userId),raw=JSON.stringify({userId:owner.userId,workspace:{...EMPTY_WORKSPACE,importDraft:{text:'precious unfinished text'}}});storage.setItem(key,raw);
 const normalized=readAccountWorkspace(storage,owner.userId);assert.equal(normalized.importDraft.text,'');writeAccountWorkspace(storage,owner.userId,normalized);assert.equal(storage.getItem(key+':recovery'),raw);
});
