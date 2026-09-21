import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {migrate} from '../scripts/infra/migrations.mjs';
import {headers,issuer} from './auth-fixture.mjs';
import {grantAi} from './ai-consent-fixture.mjs';
import {EMPTY_SESSION,reconcileSession,parseWorkspace,EMPTY_WORKSPACE} from '../lib/workspace.ts';
import {generationInput,materialError} from '../lib/build-draft.ts';
import {validGeneratedMaterial} from '../lib/material-validation.ts';
const c=createClient({url:':memory:'});await migrate(c);const db=createDatabase(c);globalThis.__freeDb=db;after(()=>c.close());
registerHooks({resolve(s,ctx,next){if(['./client','../db/client','../../../../db/client'].includes(s))return {url:'data:text/javascript,export function database(){return globalThis.__freeDb} export async function initializeDatabase(){await globalThis.__freeDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s))return next(new URL(s+'.ts',ctx.parentURL).href,ctx);return next(s,ctx);}});
const store=await import('../db/store.ts');
const {resolveInternalUser}=await import('../db/auth-store.ts');
const {POST,GET}=await import('../app/api/data/route.ts');
const {POST:retention}=await import('../app/api/retention/route.ts');
const {POST:generate}=await import('../app/api/ai/cards/route.ts');
const {continueLearning}=await import('../lib/continue-learning.ts');
let serial=0;
async function user(){const subject='user_free_'+(++serial);return {subject,id:await resolveInternalUser(issuer,subject)};}
function request(u,path,body){return new Request('http://localhost'+path,{method:body?'POST':'GET',headers:headers(u.subject,u.id,{'content-type':'application/json','x-patch-timezone':'Asia/Tokyo',...(path==='/api/ai/cards'?{'Idempotency-Key':body.operationId}:{})}),...(body?{body:JSON.stringify(body)}:{})});}
async function data(u,id){return (await GET(request(u,'/api/data'+(id?'?sessionId='+id:'')))).json();}
const qa={question:'Q',answer:'A',format:'qa',choices:[],difficulty:1};
const mcq={...qa,format:'multiple_choice',choices:['A','B','C','D']};
async function setup(u,cards=[qa]){
 const saved=await (await POST(request(u,'/api/data',{action:'saveSet',operationId:crypto.randomUUID(),material:{title:'Small Patch',category:'C',summary:'S',keyPoints:['K'],sourceContent:'source',cards}}))).json();
 const id='session_'+crypto.randomUUID();const response=await retention(request(u,'/api/retention',{action:'start',id,cardIds:saved.cardIds}));assert.equal(response.status,200);
 return {id,setId:saved.setId,cards:saved.data.sets.find(s=>s.id===saved.setId).cards,plan:await response.json()};
}
const answer=(s,card,extra={})=>({action:'reviewCard',sessionId:s.id,cardId:card.id,operationId:crypto.randomUUID(),expectedReviewCount:card.reviewCount,contentRevision:card.contentRevision,responseMs:200,rating:'again',...extra});
const send=(u,p)=>POST(request(u,'/api/data',p));

test('short topic intent is explicit; pasted text and files retain safe validation; malformed generated content is rejected',()=>{
 for(const text of ['Interest Rates','Photosynthesis','Japanese particles']){
  const d={...EMPTY_WORKSPACE.importDraft,text,inputKind:'topic'};
  assert.equal(materialError(d),'');assert.equal(generationInput(d,'en').inputKind,'topic');
  assert.ok(materialError({...d,inputKind:'source'}));
  assert.ok(materialError({...d,attachments:[{id:'file',name:'x.txt',text:'short'}]}));
 }
 const material={title:'T',category:'C',summary:'S',keyPoints:['K'],cards:[qa]};
 assert.ok(validGeneratedMaterial(material,'qa'));
 for(const card of [{...qa,question:''},{...qa,answer:' '},{...mcq,choices:['A','A','C','D']},{...mcq,answer:'E'}])assert.equal(validGeneratedMaterial({...material,cards:[card]},card.format),false);
 assert.equal(validGeneratedMaterial({...material,cards:[]},'qa'),false);
});

test('topic uses approved consent/admission pipeline, source prompt remains grounded, and provenance survives new/append save',async()=>{
 const u=await user();const prior=globalThis.fetch;const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='mock-only';let calls=0,bodies=[];
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');calls++;bodies.push(JSON.parse(options.body));return Response.json({status:'completed',usage:{input_tokens:20,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({title:'Photosynthesis',category:'Biology',summary:'Basics',keyPoints:['Light'],cards:[qa]})}]}]});};
 try{
  const input={inputKind:'topic',text:'Photosynthesis',style:'qa',operationId:crypto.randomUUID()};
  assert.notEqual((await generate(request(u,'/api/ai/cards',input))).status,200);assert.equal(calls,0);
  await grantAi(c,u.id);
  let r=await generate(request(u,'/api/ai/cards',input));assert.equal(r.status,200);const generated=await r.json();assert.equal(generated.sourceKind,'topic');assert.match(bodies[0].instructions,/一般知識/);assert.doesNotMatch(bodies[0].instructions,/元の文章にない知識を追加しない/);
  assert.equal((await generate(request(u,'/api/ai/cards',input))).status,200);assert.equal(calls,1);
  r=await generate(request(u,'/api/ai/cards',{...input,inputKind:'source',operationId:crypto.randomUUID()}));assert.equal(r.status,400);assert.equal(calls,1);
  r=await generate(request(u,'/api/ai/cards',{...input,inputKind:'source',text:'Source '.repeat(30),operationId:crypto.randomUUID()}));assert.equal(r.status,200);assert.match(bodies.at(-1).instructions,/元の文章にない知識を追加しない/);
  const saved=await (await send(u,{action:'saveSet',material:{...generated,sourceContent:input.text}})).json();assert.equal(saved.data.sets[0].sourceKind,'topic');
  await send(u,{action:'addCardsToSet',setId:saved.setId,cards:[qa],sourceContent:'Original source',sourceKind:'source'});
  assert.equal((await data(u)).sets.find(s=>s.id===saved.setId).sourceKind,'mixed');
 }finally{globalThis.fetch=prior;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
});

test('flashcards: all not remembered still complete once, short session qualifies, reload resumes, due/review/history persist',async()=>{
 const u=await user(),s=await setup(u,[qa,{...qa,question:'Q2'}]);assert.equal(s.plan.qualifies,true);
 assert.equal(s.plan.session.total,2);assert.equal(s.plan.session.status,'ACTIVE');
 const first=answer(s,s.cards[0]);let r=await send(u,first);assert.equal(r.status,200);let d=(await r.json()).data;
 assert.equal(d.studySessions[0].processed,1);assert.equal(d.studySessions[0].status,'ACTIVE');assert.equal(d.retention.streak,0);
 const local={...EMPTY_SESSION,id:s.id,queue:s.cards.map(c=>c.id),total:2,setId:s.setId,pendingReview:first};
 const reloaded=parseWorkspace(JSON.stringify({...EMPTY_WORKSPACE,session:local,pendingStudyStart:local}));assert.equal(reloaded.pendingStudyStart.id,s.id);
 const restored=reconcileSession(reloaded.session,await data(u,s.id));assert.deepEqual(restored.queue,[s.cards[1].id]);assert.equal(restored.pendingReview,null);
 assert.equal(continueLearning(await data(u),[]).kind,'session');
 const last=answer(s,s.cards[1]);r=await send(u,last);assert.equal(r.status,200);const result=await r.json();d=result.data;
 assert.equal(d.studySessions[0].status,'COMPLETED');assert.equal(d.studySessions[0].processed,2);assert.equal(d.retention.streak,1);assert.equal(d.retention.dueCount,2);
 assert.equal(d.studyHistory.find(v=>v.id===s.id).results.every(v=>v.rating==='again'),true);assert.equal(reconcileSession(restored,d).done,true);
 assert.equal((await (await send(u,last)).json()).reviewId,result.reviewId);assert.equal((await data(u)).retention.streak,1);
 assert.equal((await send(u,{...last,operationId:crypto.randomUUID()})).status,409);
 const next=await setup(u);await send(u,answer(next,next.cards[0],{rating:'good'}));assert.equal((await data(u)).retention.streak,1);
 assert.equal(continueLearning(await data(u),[]).kind,'review');
 const before=d.studySessions[0].completedAt;assert.equal((await data(u,s.id)).studySessions[0].completedAt,before);
});

test('MCQ: server grades persisted answer, ignores forged correctness, rejects invalid options, stores wrong/correct selection and idempotent receipt',async()=>{
 const u=await user(),s=await setup(u,[mcq,{...mcq,question:'Q2'}]);
 const first=answer(s,s.cards[0],{selectedChoice:'B',rating:'good',correct:true});
 assert.equal((await send(u,{...first,selectedChoice:'unknown'})).status,400);
 const [one,two]=await Promise.all([send(u,first),send(u,first)]);assert.equal(one.status,200);assert.equal(two.status,200);
 const a=await one.json(),b=await two.json();assert.equal(a.reviewId,b.reviewId);
 const log=a.data.sessionReviews[0];assert.equal(log.rating,'again');assert.equal(log.response.selectedChoice,'B');assert.equal(log.response.correct,false);
 assert.equal((await send(u,{...first,selectedChoice:'C'})).status,409);assert.equal((await send(u,{...first,responseMs:201})).status,409);
 const second=answer(s,s.cards[1],{selectedChoice:'A',rating:'again',correct:false});let r=await send(u,second);assert.equal(r.status,200);const d=(await r.json()).data;
 assert.equal(d.studySessions[0].status,'COMPLETED');assert.equal(d.sessionReviews[1].rating,'good');assert.equal(d.studyHistory[0].results[0].response.selectedChoice,'B');
 const counts=d.sets.find(x=>x.id===s.setId).cards;assert.equal(counts[0].correctCount,0);assert.equal(counts[1].correctCount,1);assert.equal(d.retention.dueCount,1);
 assert.equal((await data(u,s.id)).studySessions[0].results[1].response.selectedChoice,'A');
});

test('session/item/account ownership, ordering, content revision, deleted assignments and stale result fences',async()=>{
 const a=await user(),b=await user(),s=await setup(a,[mcq,qa]),foreign=await setup(b);
 assert.equal((await send(b,answer(s,s.cards[0],{selectedChoice:'A'}))).status,404);
 assert.equal((await send(a,answer(s,foreign.cards[0]))).status,404);
 assert.equal((await send(a,answer(s,s.cards[1]))).status,409);
 const op=answer(s,s.cards[0],{selectedChoice:'A'});
 await store.manageMaterial(a.id,{action:'editCard',cardId:s.cards[0].id,question:'Changed',answer:'B',choices:['A','B','C','D']});
 assert.equal((await send(a,op)).status,409);
 const fresh=(await data(a,s.id)).sets.find(x=>x.id===s.setId).cards[0];assert.notEqual(fresh.contentRevision,s.cards[0].contentRevision);
 assert.equal((await send(a,answer(s,fresh,{selectedChoice:'A'}))).status,200);
 await store.manageMaterial(a.id,{action:'deleteCard',cardId:s.cards[1].id});
 const d=await data(a,s.id);assert.equal(d.studySessions[0].status,'UNAVAILABLE');assert.equal(d.retention.completed,false);
 assert.equal(reconcileSession({...EMPTY_SESSION,id:s.id,queue:[s.cards[1].id]},d).done,false);
 assert.equal((await data(b,s.id)).studySessions.length,0);assert.equal((await data(b)).studyHistory.length,0);
});

test('final transaction rolls back atomically; committed response loss/retry and Undo do not duplicate evidence or achievements',async()=>{
 const u=await user(),s=await setup(u,[mcq]);const p=answer(s,s.cards[0],{selectedChoice:'B'});
 await c.execute("CREATE TEMP TRIGGER fail_complete BEFORE UPDATE OF completed_at ON study_sessions WHEN NEW.completed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'failure'); END");
 assert.equal((await send(u,p)).status,500);await c.execute('DROP TRIGGER fail_complete');
 let d=await data(u,s.id);assert.equal(d.reviews.length,0);assert.equal(d.sets[0].cards[0].reviewCount,0);assert.equal(d.retention.streak,0);
 let lose=false;globalThis.__freeDb={...db,transaction:async fn=>{const result=await db.transaction(fn);lose=true;return result;},prepare(sql,args){if(lose&&sql.startsWith('SELECT * FROM card_sets')){lose=false;throw Error('response lost');}return db.prepare(sql,args);}};
 try{assert.equal((await send(u,p)).status,500);}finally{globalThis.__freeDb=db;}
 const replay=await (await send(u,p)).json();assert.equal(replay.data.reviews.length,1);assert.equal(replay.data.retention.streak,1);
 const undo=await send(u,{action:'undoReview',sessionId:s.id,reviewId:replay.reviewId});assert.equal(undo.status,200);
 d=await data(u,s.id);assert.equal(d.studySessions[0].status,'ACTIVE');assert.equal(d.retention.streak,0);
 assert.equal((await (await send(u,p)).json()).reviewId,replay.reviewId);assert.equal((await data(u)).retention.streak,0);
});

test('legacy padded MCQ loads and grades; unusable legacy MCQ is a safe flashcard; source/old result fields have safe defaults',async()=>{
 const u=await user(),s=await setup(u,[mcq]);await c.execute({sql:'UPDATE cards SET choices=?,answer=? WHERE id=?',args:['[" A "," B "]',' A ',s.cards[0].id]});
 let card=(await data(u,s.id)).sets[0].cards[0];assert.deepEqual(card.choices,['A','B']);assert.equal((await send(u,answer(s,card,{selectedChoice:'B'}))).status,200);
 const next=await setup(u,[mcq]);await c.execute({sql:'UPDATE cards SET choices=? WHERE id=?',args:['[]',next.cards[0].id]});card=(await data(u,next.id)).sets.find(v=>v.id===next.setId).cards[0];assert.equal(card.format,'qa');assert.equal((await send(u,answer(next,card))).status,200);
 const oldExplain=await setup(u,[qa]);await c.execute({sql:"UPDATE cards SET format='self_explain' WHERE id=?",args:[oldExplain.cards[0].id]});const recall=(await data(u,oldExplain.id)).sets.find(v=>v.id===oldExplain.setId).cards[0];assert.equal(recall.format,'qa');assert.equal((await send(u,answer(oldExplain,recall))).status,200);
 await c.execute({sql:'UPDATE review_logs SET response_json=NULL,payload_hash=NULL WHERE user_id=?',args:[u.id]});assert.equal((await data(u)).studyHistory.every(v=>v.results.every(r=>r.response===null)),true);
});

test('encrypted restore preserves MCQ receipt, replay and topic provenance; account deletion erases new evidence and keeps another account',async()=>{
 const {backup,restoreCheck}=await import('../scripts/infra/backup.mjs');
 const {mkdtemp,rm}=await import('node:fs/promises');const {randomBytes}=await import('node:crypto');
 const dir=await mkdtemp('/private/tmp/patch-free-restore-'),key=randomBytes(32),u=await user(),b=await user();
 const s=await setup(u,[mcq]);const p=answer(s,s.cards[0],{selectedChoice:'C'});const receipt=await (await send(u,p)).json();
 const other=await setup(b,[qa]);await send(b,answer(other,other.cards[0]));
 await c.execute({sql:"UPDATE sources SET input_kind='topic' WHERE user_id=?",args:[u.id]});
 try{
  await backup(c,{directory:dir+'/backup',key,dbIdentifier:'isolated',releaseSha:'test'});
  await restoreCheck(dir+'/backup',key,{verify:async restored=>{
   globalThis.__freeDb=createDatabase(restored);
   assert.equal((await (await send(u,p)).json()).reviewId,receipt.reviewId);
   const d=await data(u,s.id);assert.equal(d.studyHistory[0].results[0].response.selectedChoice,'C');assert.equal(d.sets[0].sourceKind,'topic');
   const {createDeletionChallenge,requestDeletion}=await import('../db/account-deletion.ts');const {runDeletionJob}=await import('../lib/deletion-worker.ts');
   const auth={issuer,subject:u.subject,sessionId:'sess_'+u.subject,claims:{reverification_id:'before'}};
   const challenge=await createDeletionChallenge(u.id,auth);
   await requestDeletion({...auth,claims:{reverification_id:'after',fva:[0,-1]}},{challengeId:challenge.challengeId,operationId:crypto.randomUUID(),receipt:'ac'.repeat(32)});
   assert.equal((await runDeletionJob({inspectApple:async()=>false,deleteUser:async()=>{}})).state,'completed');
   for(const table of ['sources','review_logs','study_sessions'])assert.equal((await restored.execute({sql:`SELECT count(*) n FROM ${table} WHERE user_id=?`,args:[u.id]})).rows[0].n,0);
   assert.equal((await data(b)).studyHistory[0].id,other.id);
  }});
 }finally{globalThis.__freeDb=db;await rm(dir,{recursive:true,force:true});}
});


test('session start replay binds the entire requested assignment, and explicit resume adopts unfinished legacy processed items',async()=>{
 const u=await user(),s=await setup(u,[qa,{...qa,question:'Q2'}]);
 const start={action:'start',id:s.id,cardIds:s.cards.map(c=>c.id)};
 assert.equal((await retention(request(u,'/api/retention',start))).status,200);
 assert.equal((await retention(request(u,'/api/retention',{...start,cardIds:[...start.cardIds].reverse()}))).status,409);
 for(const card of s.cards)assert.equal((await send(u,answer(s,card))).status,200);
 await c.execute({sql:'UPDATE study_sessions SET completed_at=NULL,earned_day=NULL,qualifies=0 WHERE user_id=? AND id=?',args:[u.id,s.id]});
 assert.equal((await retention(request(u,'/api/retention',{action:'resume',id:s.id}))).status,200);
 const view=(await data(u,s.id)).studySessions[0];assert.equal(view.status,'COMPLETED');assert.equal(view.qualifies,true);
 assert.equal((await data(u)).retention.streak,1);
});


test('new malformed MCQ save and append fail before persistence; legacy fallback cannot accept new content',async()=>{
 const u=await user(),s=await setup(u);
 for(const card of [{...mcq,choices:['A','B']},{...mcq,choices:['A','A','C','D']},{...mcq,answer:'missing'},{...mcq,choices:[]}]) {
  assert.equal((await send(u,{action:'saveSet',material:{title:'Invalid',category:'C',summary:'',keyPoints:['K'],sourceContent:'Photosynthesis',sourceKind:'topic',cards:[card]}})).status,400);
  assert.equal((await send(u,{action:'addCardsToSet',setId:s.setId,cards:[card]})).status,400);
 }
 const d=await data(u);assert.equal(d.sets.length,1);assert.equal(d.sets[0].cards.length,1);
});

test('explicit legacy resume initializes the retention clock in the request timezone',async()=>{
 const u=await user(),s=await setup(u);
 await send(u,answer(s,s.cards[0]));
 await c.execute({sql:'UPDATE study_sessions SET completed_at=NULL,earned_day=NULL WHERE user_id=? AND id=?',args:[u.id,s.id]});
 await c.execute({sql:'DELETE FROM retention_state WHERE user_id=?',args:[u.id]});
 const r=await retention(new Request('http://localhost/api/retention',{method:'POST',headers:headers(u.subject,u.id,{'content-type':'application/json','x-patch-timezone':'America/Los_Angeles'}),body:JSON.stringify({action:'resume',id:s.id})}));
 assert.equal(r.status,200);
 assert.equal((await c.execute({sql:'SELECT timezone FROM retention_state WHERE user_id=?',args:[u.id]})).rows[0].timezone,'America/Los_Angeles');
});

test('removed Patch cannot resume or accept orphaned cards; completed history retains answer snapshots',async()=>{
 const u=await user(),s=await setup(u,[mcq,qa]);
 assert.equal((await send(u,answer(s,s.cards[0],{selectedChoice:'B'}))).status,200);
 const completed=await setup(u,[mcq]);await send(u,answer(completed,completed.cards[0],{selectedChoice:'A'}));
 await c.execute({sql:'DELETE FROM card_sets WHERE user_id=?',args:[u.id]});
 const resumed=await retention(request(u,'/api/retention',{action:'resume',id:s.id}));assert.equal(resumed.status,200);assert.equal((await resumed.json()).status,'UNAVAILABLE');
 assert.equal((await send(u,answer(s,s.cards[1]))).status,409);
 assert.equal((await retention(request(u,'/api/retention',{action:'start',id:'orphan-'+crypto.randomUUID(),cardIds:[s.cards[1].id]}))).status,404);
 const d=await data(u,s.id);assert.equal(d.studyHistory.find(h=>h.id===completed.id).results[0].response.question,'Q');assert.equal(d.studySessions[0].processed,1);
 assert.equal(d.retention.session,undefined);assert.equal(d.retention.dueCount,0);
});
