import {migrate} from '../scripts/infra/migrations.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {token,issuer,origin,headers} from './auth-fixture.mjs';
const client=createClient({url:':memory:'}),db=createDatabase(client);
await migrate(client);
globalThis.__privacyDb=db;after(()=>client.close());
registerHooks({resolve(s,c,next){if(s==='./client'||s==='../db/client'||s==='../../../../db/client')return {url:'data:text/javascript,export function database(){return globalThis.__privacyDb} export async function initializeDatabase(){await globalThis.__privacyDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s))return next(new URL(s+'.ts',c.parentURL).href,c);return next(s,c);}});
const {resolveInternalUser}=await import('../db/auth-store.ts');
const {getConsent,setConsent}=await import('../db/privacy-store.ts');
const {CONSENT_VERSION,POLICY_VERSION}=await import('../lib/privacy-policy.ts');
const {createDeletionChallenge,requestDeletion,deletionStatus}=await import('../db/account-deletion.ts');
const {runDeletionJob,workerAuthorized}=await import('../lib/deletion-worker.ts');
const {POST:GEN}=await import('../app/api/ai/cards/route.ts');
const {POST:CHAT}=await import('../app/api/ai/chat/route.ts');
const {GET:SESSION}=await import('../app/api/auth/session/route.ts');
const {GET:GETDATA,POST:POSTDATA}=await import('../app/api/data/route.ts');
const {POST:DELETE}=await import('../app/api/account/deletion/route.ts');
const {POST:WORKER}=await import('../app/api/internal/account-deletions/route.ts');
const store=await import('../db/store.ts');
let serial=0,calls=0,send;
const realFetch=globalThis.fetch;after(()=>globalThis.fetch=realFetch);
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');calls++;return send?send(url,options):Response.json({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({title:'T',category:'C',summary:'S',keyPoints:[],cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]})}]}]});};
process.env.OPENAI_API_KEY='test-only';
const user=async()=>{const subject='user_privacy_'+(++serial);return {subject,userId:await resolveInternalUser(issuer,subject),sessionId:'sess_'+subject,issuer,claims:{reverification_id:'before',fva:[0,-1]}};};
const req=(u,body,path='/api/data',claims)=>new Request(origin+path,{method:body?'POST':'GET',headers:headers(u.subject,u.userId,{'content-type':'application/json',...(body?.operationId?{'Idempotency-Key':body.operationId}:{}),...(claims?{authorization:'Bearer '+token(u.subject,claims)}:{})}),...(body?{body:JSON.stringify(body)}:{})});
const consent=async(u,state='granted',extra={})=>{const c=await getConsent(u.userId);return setConsent(u.userId,{state,revision:c.revision,operationId:crypto.randomUUID(),consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,textHash:c.textHash,language:'ja',...extra});};
const generation=(extra={})=>({text:'教材'.repeat(50),operationId:crypto.randomUUID(),...extra});
const material={title:'T',category:'C',summary:'S',keyPoints:[],sourceContent:'source',cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]};
async function deletion(u){const c=await createDeletionChallenge(u.userId,u);const input={challengeId:c.challengeId,operationId:crypto.randomUUID(),receipt:'ab'.repeat(32)};return {input,result:await requestDeletion({...u,claims:{fva:[0,-1],reverification_id:crypto.randomUUID()}},input)};}
test('all consent states and outdated version gate generation and lesson summary with zero external calls',async()=>{
 const u=await user();
 for(const state of ['unset','denied','revoked','outdated']){
  if(state!=='unset')await consent(u,state==='outdated'?'granted':state);
  if(state==='outdated')await db.prepare("UPDATE user_consents SET consent_version='old' WHERE user_id=?").bind(u.userId).run();
  for(const mode of ['source','lesson_summary']){const before=calls;const response=await GEN(req(u,generation({mode})));assert.equal(response.status,403);assert.equal(calls,before);}
 }
 await consent(u);assert.equal((await GEN(req(u,generation()))).status,200);
});
test('consent evidence, operation retry and revision conflict preserve latest withdrawal',async()=>{
 const u=await user(),c=await getConsent(u.userId);const input={state:'granted',revision:0,operationId:crypto.randomUUID(),consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,textHash:c.textHash,language:'ja'};
 await setConsent(u.userId,input);await setConsent(u.userId,input);assert.equal((await getConsent(u.userId)).revision,1);
 await consent(u,'revoked');await setConsent(u.userId,input);assert.equal((await getConsent(u.userId)).state,'revoked');
 await assert.rejects(setConsent(u.userId,{...input,operationId:crypto.randomUUID()}),/CONSENT_CONFLICT/);
 assert.equal((await db.prepare('SELECT count(*) n FROM consent_events WHERE user_id=?').bind(u.userId).first()).n,2);
});
test('duplicate concurrent operation and external timeout never automatically resend',async()=>{
 const u=await user();await consent(u);const b=generation(),before=calls;
 const responses=await Promise.all([GEN(req(u,b)),GEN(req(u,b))]);assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal(calls,before+1);
 send=async()=>{throw Error('timeout');};try{const x=generation();assert.equal((await GEN(req(u,x))).status,503);const n=calls;assert.equal((await GEN(req(u,x))).status,409);assert.equal(calls,n);}finally{send=null;}
});
test('chat gate and post-flight consent check prevent chat persistence',async()=>{
 const u=await user();const setId=await store.saveGeneratedSet(u.userId,material),cardId=(await store.loadAppData(u.userId)).sets[0].cards[0].id;
 const b={question:'Q',setId,cardId,sessionId:'study',operationId:crypto.randomUUID()};const before=calls;assert.equal((await CHAT(req(u,b))).status,403);assert.equal(calls,before);
 await consent(u);send=async()=>{await consent(u,'revoked');return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:'Answer'}]}]});};
 try{assert.equal((await CHAT(req(u,b))).status,403);assert.equal((await db.prepare('SELECT count(*) n FROM chat_messages WHERE user_id=?').bind(u.userId).first()).n,0);}finally{send=null;}
 await consent(u);send=async()=>Response.json({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:'Answer'}]}]});try{assert.equal((await CHAT(req(u,{...b,operationId:crypto.randomUUID()}))).status,200);}finally{send=null;}
});
test('deletion requires fresh signed reverification, not a client boolean or reused proof',async()=>{
 const u=await user(),c=await createDeletionChallenge(u.userId,u),input={challengeId:c.challengeId,operationId:crypto.randomUUID(),receipt:'cd'.repeat(32)};
 for(const claims of [{},{fva:[0,-1],reverification_id:'before'},{fva:[6,-1],reverification_id:'after'}])await assert.rejects(requestDeletion({...u,claims},input),/REAUTH_REQUIRED/);
 const response=await DELETE(req(u,{...input,reauthenticated:true}));assert.equal(response.status,403);
 await db.prepare('UPDATE deletion_challenges SET expires_at=0 WHERE id=?').bind(c.challengeId).run();await assert.rejects(requestDeletion({...u,claims:{fva:[0],reverification_id:'after'}},input),/REAUTH_REQUIRED/);
});
test('accepted deletion locks APIs, rejects stale JWT bootstrap, survives failure and preserves B/legacy',async()=>{
 const a=await user(),b=await user();for(const id of [a.userId,b.userId,'loop-owner'])await store.saveGeneratedSet(id,material);
 const retention=await import('../db/retention.ts');
 const aData=await store.loadAppData(a.userId);const bSnapshot=await retention.retentionSnapshot(b.userId);
 await retention.startStudySession(a.userId,'retention-delete',aData.sets[0].cards.map(c=>c.id));
 const {input,result}=await deletion(a);assert.equal((await deletionStatus(input.receipt)).state,'pending');
 assert.deepEqual(await requestDeletion(a,input),result);
 assert.equal((await SESSION(req(a))).status,403);assert.equal((await GETDATA(req(a))).status,403);assert.equal((await POSTDATA(req(a,{action:'sample'}))).status,403);
 await assert.rejects(store.saveGeneratedSet(a.userId,material),/ACCOUNT_INACTIVE/);
 const failure=await runDeletionJob({inspectApple:async()=>false,deleteUser:async()=>{throw Error('Clerk failed');}});assert.equal(failure.state,'retry');assert.equal((await db.prepare('SELECT count(*) n FROM study_sessions WHERE user_id=?').bind(a.userId).first()).n,0);assert.equal((await db.prepare('SELECT count(*) n FROM retention_state WHERE user_id=?').bind(a.userId).first()).n,0);assert.equal((await retention.retentionSnapshot(b.userId)).day,bSnapshot.day);

 assert.equal((await db.prepare('SELECT count(*) n FROM cards WHERE user_id=?').bind(a.userId).first()).n,0);
 assert.equal((await GETDATA(req(b))).status,200);assert.equal((await store.loadAppData('loop-owner')).sets.length,1);
 await db.prepare("UPDATE account_deletion_jobs SET next_attempt_at=0 WHERE id=?").bind(result.jobId).run();
 assert.equal((await runDeletionJob({inspectApple:async()=>false,deleteUser:async()=>{}})).state,'completed');
 await assert.rejects(resolveInternalUser(issuer,a.subject),/ACCOUNT_DELETED/);assert.equal((await SESSION(req(a))).status,403);
 await assert.rejects(store.saveGeneratedSet(a.userId,material),/ACCOUNT_INACTIVE/);
});
test('duplicate workers use leases; DB failure rolls back data deletion and stays pending',async()=>{
 const u=await user();await store.saveGeneratedSet(u.userId,material);const {result}=await deletion(u);
 await db.prepare("CREATE TEMP TRIGGER fail_delete BEFORE DELETE ON cards BEGIN SELECT RAISE(ABORT,'forced'); END").run();
 let removed=0;const remote={inspectApple:async()=>false,deleteUser:async()=>{removed++;}};
 assert.equal((await runDeletionJob(remote)).state,'retry');assert.equal(removed,0);assert.equal((await db.prepare('SELECT count(*) n FROM cards WHERE user_id=?').bind(u.userId).first()).n,1);
 await db.prepare('DROP TRIGGER fail_delete').run();await db.prepare('UPDATE account_deletion_jobs SET next_attempt_at=0 WHERE id=?').bind(result.jobId).run();
 let release;remote.inspectApple=()=>new Promise(r=>release=()=>r(false));const running=runDeletionJob(remote);while(!release)await new Promise(r=>setTimeout(r,1));assert.equal((await runDeletionJob(remote)).processed,false);release();await running;assert.equal(removed,1);
});
test('deletion during AI response discards result; worker authentication fails closed',async()=>{
 const u=await user();await consent(u);send=async()=>{await deletion(u);return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify(material)}]}]});};
 try{assert.equal((await GEN(req(u,generation()))).status,403);}finally{send=null;}
 assert.equal(workerAuthorized(null),false);assert.equal((await WORKER(new Request(origin,{method:'POST'}))).status,401);
});

test('chat rejects denied, revoked and outdated consent; summary grant and generation fence work',async()=>{
 const u=await user(),setId=await store.saveGeneratedSet(u.userId,material),cardId=(await store.loadAppData(u.userId)).sets[0].cards[0].id;
 for(const state of ['denied','revoked','outdated']){
  await consent(u,state==='outdated'?'granted':state);
  if(state==='outdated')await db.prepare("UPDATE user_consents SET consent_version='old' WHERE user_id=?").bind(u.userId).run();
  const before=calls;assert.equal((await CHAT(req(u,{question:'Q',setId,cardId,sessionId:'s',operationId:crypto.randomUUID()}))).status,403);assert.equal(calls,before);
 }
 await consent(u);assert.equal((await GEN(req(u,generation({mode:'lesson_summary'})))).status,200);
 send=async()=>{await db.prepare('UPDATE users SET generation=generation+1 WHERE id=?').bind(u.userId).run();return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify(material)}]}]});};
 try{assert.equal((await GEN(req(u,generation()))).status,409);}finally{send=null;}
});
test('Apple-linked identity cannot be falsely marked complete without revocation integration',async()=>{
 // Drain the preceding interrupted-AI deletion job first.
 await runDeletionJob({inspectApple:async()=>false,deleteUser:async()=>{}});
 const u=await user(),{result}=await deletion(u);let removed=0;
 const remote={inspectApple:async()=>true,deleteUser:async()=>{removed++;}};
 const blocked=await runDeletionJob(remote);assert.equal(blocked.code,'APPLE_REVOCATION_REQUIRED');assert.equal(removed,0);
 assert.equal((await db.prepare('SELECT apple_step FROM account_deletion_jobs WHERE id=?').bind(result.jobId).first()).apple_step,'pending');
 await db.prepare('UPDATE account_deletion_jobs SET next_attempt_at=0 WHERE id=?').bind(result.jobId).run();
 // A later provider 404 must not erase the previously known Apple obligation.
 remote.inspectApple=async()=>false;assert.equal((await runDeletionJob(remote)).state,'retry');assert.equal(removed,0);
 await db.prepare('UPDATE account_deletion_jobs SET next_attempt_at=0 WHERE id=?').bind(result.jobId).run();
 let revoked=0;assert.equal((await runDeletionJob({...remote,revokeApple:async()=>{revoked++;}})).state,'completed');assert.equal(revoked,1);assert.equal(removed,1);
});
test('local cleanup is scoped, preserves pending withdrawal at logout and reports hook failure',async()=>{
 const {cleanupAccount,registerAccountCleanup,privacyStopKey}=await import('../lib/account-cleanup.ts');
 const a='10000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
 const values=new Map([['patch:workspace:v2:'+a,'A'],['patch:workspace:v2:'+b,'B'],[privacyStopKey(a),'pending'],['loop-workspace','legacy']]);
 const storage={removeItem:k=>values.delete(k)};const seen=[];const unregister=registerAccountCleanup(async id=>seen.push(id));
 await cleanupAccount(storage,a);assert.equal(values.has('patch:workspace:v2:'+a),false);assert.equal(values.get(privacyStopKey(a)),'pending');assert.equal(values.get('patch:workspace:v2:'+b),'B');assert.equal(values.get('loop-workspace'),'legacy');
 await cleanupAccount(storage,a,true);assert.equal(values.has(privacyStopKey(a)),false);assert.deepEqual(seen,[a,a]);unregister();
 const off=registerAccountCleanup(async()=>{throw Error('device unavailable');});try{await assert.rejects(cleanupAccount(storage,a,true),/ACCOUNT_CLEANUP_PENDING/);}finally{off();}
});

test('Retention endpoints require active auth, validate preferences and reject another owner cards',async()=>{
 const {GET,POST}=await import('../app/api/retention/route.ts');
 assert.equal((await GET(new Request(origin+'/api/retention'))).status,401);
 const a=await user(),b=await user();await store.saveGeneratedSet(b.userId,material);const cards=(await store.loadAppData(b.userId)).sets[0].cards;
 assert.equal((await POST(req(a,{action:'preferences',reminderTime:'25:00',reviewReminder:true,streakWarning:true},'/api/retention'))).status,400);
 assert.equal((await POST(req(a,{action:'start',id:'foreign-session',cardIds:cards.map(c=>c.id)},'/api/retention'))).status,404);
 assert.equal((await POST(req(a,{action:'preferences',reminderTime:'19:30',reviewReminder:true,streakWarning:true},'/api/retention'))).status,200);
 await deletion(a);assert.equal((await GET(req(a,null,'/api/retention'))).status,403);
});
