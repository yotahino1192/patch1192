import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {migrate} from '../scripts/infra/migrations.mjs';
import {headers,issuer,origin} from './auth-fixture.mjs';
const c=createClient({url:':memory:'});await migrate(c);const db=createDatabase(c);globalThis.__domainApiDb=db;after(()=>c.close());
registerHooks({resolve(s,context,next){if(s==='./client'||s.endsWith('/db/client'))return {url:'data:text/javascript,export function database(){return globalThis.__domainApiDb} export async function initializeDatabase(){await globalThis.__domainApiDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){const url=new URL(s+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);}return next(s,context);}});
const {GET,POST}=await import('../app/api/domain/route.ts');const {resolveInternalUser}=await import('../db/auth-store.ts');
const a=await resolveInternalUser(issuer,'user_domain_A'),b=await resolveInternalUser(issuer,'user_domain_B');

const {createDomainClient}=await import('../lib/domain/client.ts');
const {createDomainLessonAdapter}=await import('../features/my-lesson/domain-adapter.ts');
const {createMockLessonAdapter}=await import('../features/my-lesson/mock-adapter.ts');
let lost=false,down=false,mutate=false;const signals=[];
const transport=(subject,owner)=>async(url,init={})=>{
 signals.push(init.signal);init.signal?.throwIfAborted();if(down)throw Error('offline');
 const req=new Request(origin+url,{...init,headers:{...headers(subject,owner),...Object.fromEntries(new Headers(init.headers))}});
 const response=await (init.method==='POST'?POST(req):GET(req));
 if(lost&&init.body?.includes('recordAttempt')){lost=false;throw Error('lost response');}
 if(mutate&&url.includes('resource=activities')){const rows=await response.json();rows[0].type='SURPRISE';return Response.json(rows);}
 return response;
};
const client=createDomainClient(transport('user_domain_A',a));
const bClient=createDomainClient(transport('user_domain_B',b));
const context=()=>({signal:new AbortController().signal,operationId:crypto.randomUUID()});
const help=createMockLessonAdapter();
async function setup(){
 const patch=await client.command({action:'createPatch',input:{title:'Real lesson',mode:'TOPIC'}});
 const objective=await client.command({action:'createObjective',input:{patchId:patch.id,description:'Concept',objectiveType:'CONCEPT',difficulty:2}});
 const state=await client.command({action:'writeObjectiveState',input:{objectiveId:objective.id,mastery:0.3,incorrectCount:2,lastReviewedAt:null,nextReviewAt:null,expectedVersion:0}});
 const acts=[];for(const type of ['LEARN','RECALL','CHOICE','EXPLAIN','APPLY','LEARN'])acts.push(await client.command({action:'createActivity',input:{objectiveId:objective.id,type,prompt:type,answer:'yes',explanation:'why',estimatedSeconds:60,metadata:type==='CHOICE'?{choices:['yes','no']}:{}}}));
 const lesson=await client.command({action:'createLesson',input:{patchId:patch.id,targetMinutes:6,activityIds:acts.map(a=>a.id)}});
 const adapter=createDomainLessonAdapter(client,lesson.id,help);
 return {patch,objective,state,acts,lesson,adapter};
}
test('real signed domain API -> adapter: six activities, durable attempts, projection readback, and server-only completion',async()=>{
 const f=await setup();signals.length=0;let view=await f.adapter.load(context());assert.ok(signals.every(Boolean));assert.equal(view.status,'ACTIVE');assert.equal(view.resume.completedIds.length,0);
 assert.equal((await client.query({resource:'lesson',id:f.lesson.id})).status,'ACTIVE');
 for(const [i,activity] of view.activities.entries()){
  if(activity.type!=='LEARN'){
   const input={lessonId:f.lesson.id,activity,response:activity.type==='RECALL'?'remembered':activity.type==='CHOICE'?'0':'my explanation',assessment:'CORRECT'};
   const ctx=context();const feedback=await f.adapter.evaluate(input,ctx);await f.adapter.evaluate(input,ctx);
   assert.equal(feedback.correct,true);assert.equal(feedback.objectiveState.mastery,0.3);
   assert.equal((await client.query({resource:'attempts',id:activity.id})).length,1);
  }
  view=await f.adapter.advance({lessonId:f.lesson.id,activity},context());
  assert.equal(view.resume.completedIds.length,i+1);assert.equal(view.status,i===5?'COMPLETED':'ACTIVE');
 }
 assert.equal(view.completion.status,'COMPLETED');assert.equal(view.completion.strengthenedObjectiveCount,1);
 const resumed=await createDomainLessonAdapter(client,f.lesson.id,help).load(context());assert.equal(resumed.status,'COMPLETED');
 const projection=await client.query({resource:'objectiveState',id:f.objective.id});assert.deepEqual(projection,f.state,'UI must not invent or write mastery/Due projection');
 await assert.rejects(createDomainLessonAdapter(bClient,f.lesson.id,help).load(context()),e=>e.status===404);

});
test('lost response explicit retry/reload do not duplicate; incorrect result resumes feedback and requires another attempt',async()=>{
 const f=await setup();let v=await f.adapter.load(context());v=await f.adapter.advance({lessonId:f.lesson.id,activity:v.activities[0]},context());
 const activity=v.activities[1],input={lessonId:f.lesson.id,activity,response:'practice'},ctx=context();
 lost=true;await assert.rejects(f.adapter.evaluate(input,ctx));await f.adapter.evaluate(input,ctx);
 assert.equal((await client.query({resource:'attempts',id:activity.id})).length,1);
 const adapter=createDomainLessonAdapter(client,f.lesson.id,help);v=await adapter.load(context());assert.equal(v.resume.states[activity.id].feedback.correct,false);assert.equal(v.resume.completedIds.length,1);
 await assert.rejects(adapter.advance({lessonId:f.lesson.id,activity},context()));
 await adapter.evaluate({...input,response:'remembered'},context());v=await adapter.advance({lessonId:f.lesson.id,activity},context());assert.equal(v.resume.completedIds.length,2);
 assert.equal((await client.query({resource:'attempts',id:activity.id})).length,2);
});
test('same predecessor produces one durable attempt across simultaneous adapters; invalid data, abort and failure fail closed',async()=>{
 const f=await setup(),other=createDomainLessonAdapter(client,f.lesson.id,help);const [v]=await Promise.all([f.adapter.load(context()),other.load(context())]);
 await Promise.all([f.adapter.advance({lessonId:f.lesson.id,activity:v.activities[0]},context()),other.advance({lessonId:f.lesson.id,activity:v.activities[0]},context())]);
 assert.equal((await client.query({resource:'attempts',id:v.activities[0].id})).length,1);
 const controller=new AbortController();controller.abort();await assert.rejects(f.adapter.load({signal:controller.signal,operationId:'abort'}));
 down=true;try{await assert.rejects(f.adapter.load(context()));}finally{down=false;}
 mutate=true;try{await assert.rejects(f.adapter.load(context()),/UNAVAILABLE/);}finally{mutate=false;}
 for(const table of ['attempts','lesson_activities'])await c.execute({sql:`DELETE FROM ${table} WHERE lesson_id=?`,args:[f.lesson.id]});
 await c.execute({sql:'DELETE FROM study_sessions WHERE id=?',args:[f.lesson.id]});await assert.rejects(f.adapter.load(context()),e=>e.status===404);
 const gone=await setup();await c.execute({sql:'DELETE FROM lesson_activities WHERE lesson_id=?',args:[gone.lesson.id]});await c.execute({sql:'DELETE FROM study_sessions WHERE id=?',args:[gone.lesson.id]});for(const table of ['objective_states','activities'])await c.execute({sql:`DELETE FROM ${table} WHERE objective_id=?`,args:[gone.objective.id]});await c.execute({sql:'DELETE FROM learning_objectives WHERE id=?',args:[gone.objective.id]});await c.execute({sql:'DELETE FROM patches WHERE id=?',args:[gone.patch.id]});await assert.rejects(gone.adapter.load(context()),e=>e.status===404);
});

const {createLessonCheckpoint}=await import('../features/my-lesson/checkpoint.ts');
test('durable pending answer survives reload, blocked storage dispatches nothing, Undo allows a fresh attempt',async()=>{
 const f=await setup();const values=new Map();let blocked=false;
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error('quota');values.set(k,v);},removeItem:k=>values.delete(k)};
 const checkpoint=createLessonCheckpoint(storage,a,()=>{});
 let adapter=createDomainLessonAdapter(client,f.lesson.id,help,checkpoint),v=await adapter.load(context());
 blocked=true;await assert.rejects(adapter.advance({lessonId:f.lesson.id,activity:v.activities[0]},context()),/quota/);assert.equal((await client.query({resource:'attempts',id:v.activities[0].id})).length,0);
 blocked=false;lost=true;await assert.rejects(adapter.advance({lessonId:f.lesson.id,activity:v.activities[0]},context()));assert.ok(checkpoint.read(f.lesson.id).pending);
 adapter=createDomainLessonAdapter(client,f.lesson.id,help,checkpoint);v=await adapter.load(context());assert.equal(v.resume.completedIds.length,1);assert.equal(checkpoint.read(f.lesson.id).pending,null);
 const saved=(await client.query({resource:'attempts',id:v.activities[0].id}))[0];await client.command({action:'undoAttempt',input:{attemptId:saved.id}});
 adapter=createDomainLessonAdapter(client,f.lesson.id,help,checkpoint);v=await adapter.load(context());assert.equal(v.resume.completedIds.length,0);await adapter.advance({lessonId:f.lesson.id,activity:v.activities[0]},context());
 const attempts=await client.query({resource:'attempts',id:v.activities[0].id});assert.equal(attempts.length,2);assert.notEqual(attempts[0].operationId,attempts[1].operationId);
});
test('adapter rejects malformed user responses and mismatched Lesson without Attempt writes',async()=>{
 const f=await setup(),v=await f.adapter.load(context());
 for(const [index,response,assessment] of [[1,'forged',undefined],[2,'',undefined],[2,'0.0',undefined],[3,'  ','CORRECT'],[4,'answer','OTHER']])await assert.rejects(f.adapter.evaluate({lessonId:f.lesson.id,activity:v.activities[index],response,assessment},context()));
 await assert.rejects(f.adapter.advance({lessonId:'other',activity:v.activities[0]},context()));
 for(const activity of v.activities)assert.equal((await client.query({resource:'attempts',id:activity.id})).length,0);
});
