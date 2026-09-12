import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { migrate } from '../scripts/infra/migrations.mjs';
import { runAi } from '../lib/ai/control.ts';
import { execution, ProviderError, AiError } from '../lib/ai/execution.ts';
import { randomUUID } from 'node:crypto';
const key = () => randomUUID();
async function fixture(fn) { const c=createClient({url:':memory:'}); try { await migrate(c); await c.execute("INSERT INTO users VALUES ('a','now'),('b','now')"); await fn(createDatabase(c),c); } finally { c.close(); } }
const work = async () => { const ctx=execution.getStore(); await ctx.dispatch(); ctx.usage={input:100,output:100}; return {answer:'safe test result'}; };
const rejects = (p, code) => assert.rejects(p, e => e.code === code);
async function seed(c,{owner='a',endpoint='cards',age=0,cost=0,state='succeeded',count=1}={}) { for(let i=0;i<count;i++) await c.execute({sql:"INSERT INTO ai_requests(id,user_id,key_hash,payload_hash,endpoint,state,created_at,lease_until,result_until,cost_micros,result_json) VALUES(?,?,?,?,?,?,CAST(strftime('%s','now') AS INTEGER)*1000-?,0,9999999999999,?,'{}')",args:[key(),owner,key(),key(),endpoint,state,age,cost]}); }
test('required key, payload conflict, canonical replay and account isolation',()=>fixture(async(db,c)=>{
 let calls=0;const invoke=async()=>{calls++;return work();}, k=key();
 await rejects(runAi(db,'a','cards',null,{},invoke),'IDEMPOTENCY_KEY_REQUIRED');
 const first=await runAi(db,'a','cards',k,{a:1,b:2},invoke);
 assert.deepEqual(await runAi(db,'a','cards',k,{b:2,a:1},invoke),first);
 await rejects(runAi(db,'a','cards',k,{a:2},invoke),'IDEMPOTENCY_CONFLICT');
 await rejects(runAi(db,'a','chat',k,{a:1,b:2},invoke),'IDEMPOTENCY_CONFLICT');
 await runAi(db,'b','cards',k,{a:1,b:2},invoke);assert.equal(calls,2);
 assert.equal((await c.execute('SELECT count(*) n FROM ai_requests')).rows[0].n,2);
}));
test('parallel duplicate and different key cannot acquire a second concurrency slot',()=>fixture(async(db)=>{
 let ready,release; const started=new Promise(r=>ready=r),wait=new Promise(r=>release=r),k=key();let calls=0;
 const pending=runAi(db,'a','chat',k,{},async()=>{calls++;await execution.getStore().dispatch();ready();await wait;return {};});await started;
 await rejects(runAi(db,'a','chat',k,{},work),'AI_IN_PROGRESS');
 await rejects(runAi(db,'a','cards',key(),{},work),'AI_CONCURRENCY_LIMIT');
 release();await pending;assert.equal(calls,1);
}));
for(const [endpoint,caps] of [['cards',[2,5,10,100]],['chat',[6,30,60,1000]]]) for(const [i,cap] of caps.entries()) test(`${endpoint} Free window ${i} cap ${cap}`,()=>fixture(async(db,c)=>{
 // A single seeded row's count can be represented by rows without contacting OpenAI.
 await seed(c,{endpoint,count:cap,age:[0,61000,3601000,86401000][i]});
 await rejects(runAi(db,'a',endpoint,key(),{plan:'premium'},work),'AI_RATE_LIMIT');
}));
for(const [label,setup] of [['global cards',{owner:'b',count:10}],['global chat',{owner:'b',endpoint:'chat',count:20}],['global total',{owner:'b',endpoint:'chat',count:30}],['global hour',{owner:'b',count:1000,age:61000}],['global day',{owner:'b',count:5000,age:3601000}]]) test(label,()=>fixture(async(db,c)=>{
 await seed(c,setup);await rejects(runAi(db,'a',label==='global chat'?'chat':'cards',key(),{},work),'AI_RATE_LIMIT');
}));
for(const [label,setup] of [['user day',{cost:150000,age:3601000}],['user month',{cost:1000000,age:86401000}],['global hour',{owner:'b',cost:1000000,age:61000}],['global day',{owner:'b',cost:5000000,age:3601000}],['global month',{owner:'b',cost:30000000,age:86401000}]]) test(`${label} cost stops before provider`,()=>fixture(async(db,c)=>{
 await seed(c,setup);await rejects(runAi(db,'a','cards',key(),{},()=>assert.fail('dispatched')),'AI_COST_LIMIT');
}));
test('global concurrency and unknown from old months remain reserved',()=>fixture(async(db,c)=>{
 await seed(c,{owner:'b',count:10,state:'unknown',age:40*86400000});await rejects(runAi(db,'a','cards',key(),{},work),'AI_CONCURRENCY_LIMIT');
}));
test('timeout is unknown, maximum charge remains and repeated key never runs',()=>fixture(async(db,c)=>{
 const k=key();let calls=0;
 await rejects(runAi(db,'a','cards',k,{},async()=>{calls++;await execution.getStore().dispatch();throw new ProviderError(true);}), 'AI_UNKNOWN');
 await rejects(runAi(db,'a','cards',k,{},work),'AI_UNKNOWN');
 await rejects(runAi(db,'a','chat',key(),{},work),'AI_CONCURRENCY_LIMIT');
 const row=(await c.execute('SELECT * FROM ai_requests')).rows[0];assert.equal(row.state,'unknown');assert.equal(row.cost_micros,3600);assert.equal(calls,1);
}));
test('known provider rejection is final, no same-key retry and no slot leak',()=>fixture(async(db,c)=>{
 const k=key();await rejects(runAi(db,'a','chat',k,{},async()=>{await execution.getStore().dispatch();throw new ProviderError(false);}), 'AI_PROVIDER_FAILED');
 await rejects(runAi(db,'a','chat',k,{},work),'AI_REQUEST_FINAL');await runAi(db,'a','chat',key(),{},work);
 assert.equal((await c.execute("SELECT count(*) n FROM ai_requests WHERE state='failed_final'")).rows[0].n,1);
}));
test('pre-dispatch failure refunds budget but preserves key tombstone',()=>fixture(async(db,c)=>{
 const k=key();await rejects(runAi(db,'a','cards',k,{},async()=>{throw new AiError('AI_INPUT_TOO_LARGE',413);}), 'AI_INPUT_TOO_LARGE');
 assert.equal((await c.execute('SELECT cost_micros FROM ai_requests')).rows[0].cost_micros,0);await rejects(runAi(db,'a','cards',k,{},work),'AI_REQUEST_FINAL');
}));
test('database failures before admission and before dispatch fail closed',()=>fixture(async(db,c)=>{
 const fail={transaction:async()=>{throw new Error('private database body');}};
 await rejects(runAi(fail,'a','cards',key(),{},()=>assert.fail()),'AI_DATABASE_UNAVAILABLE');
 await rejects(runAi(db,'a','cards',key(),{},async()=>{await c.execute('UPDATE ai_control SET enabled=0');await execution.getStore().dispatch();assert.fail();}),'AI_STOPPED');
}));
test('atomic result/side effect rollback becomes unknown; expiry cannot replay',()=>fixture(async(db,c)=>{
 const k=key();await rejects(runAi(db,'a','chat',k,{},work,async(tx)=>{await tx.execute("INSERT INTO users VALUES ('rollback','now')");throw Error('private body');}),'AI_UNKNOWN');
 assert.equal((await c.execute("SELECT id FROM users WHERE id='rollback'")).rows.length,0);
 const k2=key();await runAi(db,'b','cards',k2,{},work);await c.execute("UPDATE ai_requests SET result_until=0 WHERE user_id='b'");await rejects(runAi(db,'b','cards',k2,{},work),'AI_RESULT_EXPIRED');
 assert.equal((await c.execute("SELECT result_json FROM ai_requests WHERE user_id='b'")).rows[0].result_json,null);
}));
test('crashed dispatch expires to unknown and crashed reservation fails before sending',()=>fixture(async(db,c)=>{
 await seed(c,{state:'dispatching'});await rejects(runAi(db,'a','cards',key(),{},work),'AI_CONCURRENCY_LIMIT');
 // Admission rejection rolls its sweep back; a successful independent admission commits it.
 await runAi(db,'b','chat',key(),{},work);assert.equal((await c.execute("SELECT state FROM ai_requests WHERE user_id='a'")).rows[0].state,'unknown');
}));
test('runtime detects drift even after an earlier successful initialization',()=>fixture(async(db,c)=>{
 await db.initialize();await c.execute('ALTER TABLE ai_requests ADD drift TEXT');await assert.rejects(db.initialize(),/SCHEMA_NOT_READY/);
}));
test('lost success COMMIT response never repeats provider or finalization',()=>fixture(async(db,c)=>{
 let lost=true,calls=0;const wrapped={transaction:async fn=>{const result=await db.transaction(fn);const success=(await c.execute("SELECT 1 FROM ai_requests WHERE state='succeeded'")).rows.length;if(success&&lost){lost=false;throw Error('lost commit response');}return result;}};
 const k=key();await rejects(runAi(wrapped,'a','cards',k,{},async()=>{calls++;return work();}),'AI_UNKNOWN');
 assert.deepEqual(await runAi(db,'a','cards',k,{},()=>assert.fail('duplicate')), {answer:'safe test result'});assert.equal(calls,1);
}));
test('expired pre-dispatch reservation is fenced from late workers',()=>fixture(async(db,c)=>{
 await rejects(runAi(db,'a','cards',key(),{},async()=>{await c.execute("UPDATE ai_requests SET lease_until=0 WHERE state='reserved'");await execution.getStore().dispatch();assert.fail('sent');}),'AI_RESERVATION_LOST');
 assert.equal((await c.execute('SELECT state,cost_micros FROM ai_requests')).rows[0].state,'failed_pre_dispatch');
}));
test('admission is shared across independent connections',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');const dir=await mkdtemp(join(tmpdir(),'patch-ai-race-'));
 const a=createClient({url:'file:'+join(dir,'db')}),b=createClient({url:'file:'+join(dir,'db')});
 try{await migrate(a);await a.execute("INSERT INTO users VALUES ('a','now')");let release,ready;const started=new Promise(r=>ready=r),pause=new Promise(r=>release=r);
 const pending=runAi(createDatabase(a),'a','chat',key(),{},async()=>{await execution.getStore().dispatch();ready();await pause;return {};});await started;
 try{await rejects(runAi(createDatabase(b),'a','cards',key(),{},()=>assert.fail('sent')),'AI_CONCURRENCY_LIMIT');}finally{release();await pending;}
 assert.equal((await a.execute('SELECT count(*) n FROM ai_requests')).rows[0].n,1);
 }finally{a.close();b.close();await rm(dir,{recursive:true,force:true});}
});
