import { grantAi } from './ai-consent-fixture.mjs';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { migrate } from '../scripts/infra/migrations.mjs';
import { headers, origin } from './auth-fixture.mjs';
const c=createClient({url:':memory:'});await migrate(c);globalThis.__aiRouteDb=createDatabase(c);after(()=>c.close());
registerHooks({resolve(s,ctx,next){if(s==='./client'||s==='../db/client'||s==='../../../../db/client')return {url:'data:text/javascript,export function database(){return globalThis.__aiRouteDb} export async function initializeDatabase(){await globalThis.__aiRouteDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s))return next(new URL(s+'.ts',ctx.parentURL).href,ctx);return next(s,ctx);}});
const {GET:session}=await import('../app/api/auth/session/route.ts');
const {POST:cards}=await import('../app/api/ai/cards/route.ts');
const {POST:chat}=await import('../app/api/ai/chat/route.ts');
const store=await import('../db/store.ts');
async function account(subject){const a=await (await session(new Request(origin+'/api/auth/session',{headers:headers(subject)}))).json();await grantAi(c,a.userId);return a;}
function request(a,path,body,key){return new Request(origin+path,{method:'POST',headers:headers(a.subject,a.userId,{'content-type':'application/json',...(key?{'Idempotency-Key':key}:{})}),body:JSON.stringify(body)});}
async function mock(text,fn){const prev=globalThis.fetch,old=process.env.OPENAI_API_KEY;let calls=0;process.env.OPENAI_API_KEY='mock-only';globalThis.fetch=async()=>{calls++;return Response.json({status:'completed',usage:{input_tokens:10,output_tokens:100},output:[{content:[{type:'output_text',text}]}]});};try{await fn(()=>calls);}finally{globalThis.fetch=prev;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}}
test('authenticated cards route enforces key and returns stored result on replay, conflict on changed body',async()=>{
 const a=await account('user_cards'),body={text:'source '.repeat(30)},k=randomUUID();const result={title:'T',category:'C',summary:'S',keyPoints:['K'],cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]};
 await mock(JSON.stringify(result),async calls=>{assert.equal((await cards(request(a,'/api/ai/cards',body))).status,400);
 const one=await cards(request(a,'/api/ai/cards',body,k));assert.equal(one.status,200);assert.deepEqual(await one.json(),result);
 const two=await cards(request(a,'/api/ai/cards',body,k));assert.equal(two.status,200);assert.deepEqual(await two.json(),result);assert.equal(calls(),1);
 assert.equal((await cards(request(a,'/api/ai/cards',{...body,text:body.text+'different'},k))).status,409);assert.equal(calls(),1);
 assert.equal((await cards(request(a,'/api/ai/cards',{text:''},k))).status,400);
 });
});
test('chat response, usage and exactly one pair commit together; replay uses owner-scoped result',async()=>{
 const a=await account('user_chat');await store.saveGeneratedSet(a.userId,{title:'T',category:'C',summary:'',keyPoints:[],sourceContent:'source',cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]});
 const set=(await store.loadAppData(a.userId)).sets[0];const body={setId:set.id,cardId:set.cards[0].id,sessionId:'lesson',question:'why?'},k=randomUUID();
 await mock('A concise answer',async calls=>{for(let i=0;i<2;i++){const r=await chat(request(a,'/api/ai/chat',body,k));assert.equal(r.status,200);assert.deepEqual(await r.json(),{answer:'A concise answer'});}assert.equal(calls(),1);
 assert.equal((await c.execute({sql:'SELECT count(*) n FROM chat_messages WHERE user_id=?',args:[a.userId]})).rows[0].n,2);
 const b=await account('user_foreign');assert.equal((await chat(request(b,'/api/ai/chat',body,k))).status,404);assert.equal(calls(),1);
 });
});
test('deletion during provider flight scrubs AI content, rejects result and retains shared spend',async()=>{
 const {issuer}=await import('./auth-fixture.mjs');
 const {createDeletionChallenge,requestDeletion}=await import('../db/account-deletion.ts');
 const {runDeletionJob}=await import('../lib/deletion-worker.ts');
 const a=await account('user_delete_ai'),b=await account('user_delete_control');
 const payload={text:'source '.repeat(30)},prev=globalThis.fetch,old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='mock-only';
 const result={title:'sensitive result',category:'C',summary:'',keyPoints:[],cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]};
 const providerResult=()=>Response.json({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]});
 try {
 globalThis.fetch=async()=>providerResult();assert.equal((await cards(request(a,'/api/ai/cards',payload,randomUUID()))).status,200);
 let calls=0;globalThis.fetch=async()=>{
  calls++;const auth={issuer,subject:a.subject,sessionId:a.sessionId,claims:{reverification_id:'old',fva:[0,-1]}};
  const challenge=await createDeletionChallenge(a.userId,auth);
  await requestDeletion({...auth,claims:{reverification_id:'new',fva:[0,-1]}},{challengeId:challenge.challengeId,operationId:randomUUID(),receipt:'ef'.repeat(32)});
  assert.equal((await runDeletionJob({inspectApple:async()=>false,deleteUser:async()=>{}})).state,'completed');
  return providerResult();
 };
 const response=await cards(request(a,'/api/ai/cards',payload,randomUUID()));assert.equal(response.status,403);assert.equal(calls,1);
 const rows=(await c.execute({sql:'SELECT state,cost_micros,result_json,payload_hash,key_hash,id FROM ai_requests WHERE user_id=?',args:[a.userId]})).rows;
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.result_json===null && r.payload_hash===r.id && r.key_hash===r.id));assert.ok(rows.reduce((n,r)=>n+Number(r.cost_micros),0)>=3600);assert.ok(rows.every(r=>!['reserved','dispatching','unknown'].includes(r.state)));
 assert.equal((await c.execute({sql:'SELECT lifecycle_state FROM users WHERE id=?',args:[b.userId]})).rows[0].lifecycle_state,'active');
 await assert.rejects(c.execute({sql:"UPDATE ai_requests SET result_json='sensitive' WHERE user_id=?",args:[a.userId]}),/ACCOUNT_INACTIVE/);
 const before=calls;assert.equal((await cards(request(a,'/api/ai/cards',payload,randomUUID()))).status,403);assert.equal(calls,before);
 }finally{globalThis.fetch=prev;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});
