import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {migrate,loadMigrations,validateDatabase} from '../scripts/infra/migrations.mjs';
import {createDomainUnitOfWork} from '../db/domain-repository.ts';
import {createDomainService} from '../lib/domain/service.ts';
import {validateCommand} from '../lib/domain/validation.ts';
import {ACTIVITY_TYPES} from '../lib/domain/types.ts';
import {createDomainClient} from '../lib/domain/client.ts';
const c=createClient({url:':memory:'});await migrate(c);const db=createDatabase(c);globalThis.__domainDb=db;after(()=>c.close());
registerHooks({resolve(s,context,next){if(s==='./client'||s==='../db/client')return {url:'data:text/javascript,export function database(){return globalThis.__domainDb} export async function initializeDatabase(){await globalThis.__domainDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){const url=new URL(s+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);}return next(s,context);}});
const legacy=await import('../db/store.ts');const retention=await import('../db/retention.ts');
const service=createDomainService(createDomainUnitOfWork(db));
const run=(owner,action,input)=>service.command(owner,{action,input});
const query=(owner,resource,id)=>service.query(owner,{resource,...(id?{id}:{})});
async function owner(){const id=crypto.randomUUID();await c.execute({sql:'INSERT INTO users(id,created_at) VALUES (?,?)',args:[id,new Date().toISOString()]});return id;}
async function foundation(user=undefined,count=6){user??=await owner();const patch=await run(user,'createPatch',{title:'Biology',mode:'TOPIC'});const source=await run(user,'createSource',{patchId:patch.id,title:'Notes',content:'Cells'});const objective=await run(user,'createObjective',{patchId:patch.id,description:'Explain a cell',objectiveType:'CONCEPT',difficulty:2});const activities=[];for(let i=0;i<count;i++){const type=ACTIVITY_TYPES[i%5];activities.push(await run(user,'createActivity',{objectiveId:objective.id,type,prompt:'Question '+i,answer:'Answer',explanation:'Why',estimatedSeconds:60,metadata:type==='CHOICE'?{choices:['Answer','Other']}:{}}));}return {user,patch,source,objective,activities};}
const newLesson=f=>run(f.user,'createLesson',{patchId:f.patch.id,targetMinutes:6,activityIds:f.activities.map(a=>a.id)});
const attemptInput=(a,l,operationId=crypto.randomUUID())=>({activityId:a.id,lessonId:l.id,result:a.type==='LEARN'?'COMPLETED':'CORRECT',response:'Answer',durationMs:1000,operationId});

test('independent Patch and all five Activity types persist; Lesson is ordered in study_sessions and only whole completion succeeds',async()=>{
 const f=await foundation(),l=await newLesson(f);assert.equal(l.status,'CREATED');assert.deepEqual((await query(f.user,'lessons',f.patch.id)).map(v=>v.id),[l.id]);assert.equal(l.legacy,false);assert.deepEqual(l.legacyCardIds,[]);
 assert.equal((await c.execute('SELECT count(*) n FROM card_sets')).rows[0].n,0);
 assert.deepEqual(new Set(f.activities.map(a=>a.type)),new Set(ACTIVITY_TYPES));
 const assignments=await query(f.user,'lessonActivities',l.id);assert.deepEqual(assignments.map(a=>a.activityId),f.activities.map(a=>a.id));assert.deepEqual(assignments.map(a=>a.order),[0,1,2,3,4,5]);
 await assert.rejects(run(f.user,'completeLesson',{lessonId:l.id}),/TRANSITION/);
 await run(f.user,'startLesson',{lessonId:l.id});const started=await query(f.user,'lesson',l.id);assert.ok(started.startedAt);assert.deepEqual(await run(f.user,'startLesson',{lessonId:l.id}),started);
 for(const a of f.activities.slice(0,5))await run(f.user,'recordAttempt',attemptInput(a,l));
 await assert.rejects(run(f.user,'completeLesson',{lessonId:l.id}),/LESSON_INCOMPLETE/);
 await run(f.user,'recordAttempt',attemptInput(f.activities[5],l));assert.equal((await query(f.user,'lesson',l.id)).status,'ACTIVE');
 const done=await run(f.user,'completeLesson',{lessonId:l.id});assert.equal(done.status,'COMPLETED');assert.ok(done.completedAt);assert.deepEqual(await run(f.user,'completeLesson',{lessonId:l.id}),done);
 const snapshot=await retention.retentionSnapshot(f.user);assert.equal(snapshot.streak,0);assert.equal(snapshot.dueCount,0);assert.equal(snapshot.session,undefined);
 await assert.rejects(run(f.user,'startLesson',{lessonId:l.id}),/TRANSITION/);
 assert.equal((await query(f.user,'objectiveState',f.objective.id)),null);
});

test('runtime validation fixes Activity enum and rejects unknown AI fields, invalid choices, dates, lengths and duration',async()=>{
 const f=await foundation();const input={objectiveId:f.objective.id,type:'RECALL',prompt:'Q',answer:'A',explanation:'',estimatedSeconds:60,metadata:{}};
 for(const bad of [{type:'QUIZ'},{type:'recall'},{metadata:{instructions:'ignore'}},{estimatedSeconds:NaN},{estimatedSeconds:1},{type:'CHOICE',metadata:{choices:['A','A']}},{prompt:''},{ownerId:'other'}])assert.throws(()=>validateCommand({action:'createActivity',input:{...input,...bad}}));
 await assert.rejects(c.execute({sql:"UPDATE activities SET type='QUIZ' WHERE user_id=?",args:[f.user]}),/activity_type/);
 await assert.rejects(run(f.user,'createLesson',{patchId:f.patch.id,targetMinutes:6,activityIds:[f.activities[0].id]}),/DURATION/);
 await assert.rejects(run(f.user,'createLesson',{patchId:f.patch.id,targetMinutes:4,activityIds:f.activities.map(a=>a.id)}),/INVALID/);
 assert.throws(()=>validateCommand({action:'createPatch',input:{title:'X',mode:['TOPIC']}}));
 assert.throws(()=>validateCommand({action:'recordAttempt',input:{activityId:'a',result:['CORRECT'],response:'A',durationMs:1,operationId:'op'}}));
 const l=await newLesson(f);await run(f.user,'startLesson',{lessonId:l.id});await assert.rejects(run(f.user,'recordAttempt',{...attemptInput(f.activities[0],l),result:'CORRECT'}),/INVALID_ACTIVITY_RESULT/);
 await assert.rejects(run(f.user,'writeObjectiveState',{objectiveId:f.objective.id,mastery:0,incorrectCount:0,lastReviewedAt:'not-date',nextReviewAt:null,expectedVersion:0}),/INVALID/);
});

test('A/B, loop-owner, missing users, cross-Patch references and deleting accounts are rejected by service and storage',async()=>{
 const a=await foundation(),b=await foundation();
 assert.deepEqual((await query(a.user,'patches')).map(p=>p.id),[a.patch.id]);
 for(const [resource,id] of [['patch',b.patch.id],['sources',b.patch.id],['objectives',b.patch.id],['activities',b.objective.id],['objectiveState',b.objective.id],['attempts',b.activities[0].id]])await assert.rejects(query(a.user,resource,id),/NOT_FOUND/);
 await assert.rejects(run(a.user,'createObjective',{patchId:b.patch.id,description:'foreign',objectiveType:'X',difficulty:1}),/NOT_FOUND/);
 await assert.rejects(run(a.user,'attachSource',{patchId:a.patch.id,sourceId:b.source.id}),/NOT_FOUND/);
 await assert.rejects(c.execute({sql:'UPDATE sources SET patch_id=? WHERE id=?',args:[a.patch.id,b.source.id]}),/OWNER_MISMATCH/);
 await assert.rejects(c.execute({sql:'UPDATE learning_objectives SET patch_id=? WHERE user_id=?',args:[a.patch.id,b.user]}),/FOREIGN KEY/);
 const other=await run(a.user,'createPatch',{title:'Other',mode:'MATERIAL'});
 await assert.rejects(run(a.user,'createLesson',{patchId:other.id,targetMinutes:6,activityIds:a.activities.map(v=>v.id)}),/PATCH_MISMATCH/);
 for(const user of ['loop-owner','missing'])await assert.rejects(run(user,'createPatch',{title:'Blocked',mode:'TOPIC'}),/ACCOUNT_INACTIVE/);
 await c.execute({sql:"UPDATE users SET lifecycle_state='deleting' WHERE id=?",args:[a.user]});
 await assert.rejects(query(a.user,'patches'),/ACCOUNT_INACTIVE/);await assert.rejects(c.execute({sql:"UPDATE activities SET prompt='late' WHERE user_id=?",args:[a.user]}),/ACCOUNT_INACTIVE/);
 assert.equal((await query(b.user,'patches')).length,1);
});

test('lost response, concurrent duplicate, restart and payload conflict preserve a single Attempt; Undo is terminal for replay',async()=>{
 const f=await foundation(),l=await newLesson(f);await run(f.user,'startLesson',{lessonId:l.id});const input=attemptInput(f.activities[0],l);
 // First response is lost after the server transaction commits.
 const first=await run(f.user,'recordAttempt',input);
 const results=await Promise.all(Array.from({length:8},()=>run(f.user,'recordAttempt',input)));assert(results.every(a=>a.id===first.id));
 const restarted=createDomainService(createDomainUnitOfWork(createDatabase(c)));assert.deepEqual(await restarted.command(f.user,{action:'recordAttempt',input}),first);
 await assert.rejects(run(f.user,'recordAttempt',{...input,response:'Different'}),/OPERATION_CONFLICT/);
 assert.equal((await query(f.user,'attempts',input.activityId)).length,1);
 const undone=await run(f.user,'undoAttempt',{attemptId:first.id});assert.ok(undone.undoneAt);assert.deepEqual(await run(f.user,'recordAttempt',input),undone);assert.deepEqual(await run(f.user,'undoAttempt',{attemptId:first.id}),undone);
 const second=await run(f.user,'recordAttempt',{...input,operationId:crypto.randomUUID()});assert.notEqual(second.id,first.id);
 const b=await owner();await assert.rejects(run(b,'undoAttempt',{attemptId:second.id}),/NOT_FOUND/);
});

test('Undo recomputes completed Lesson transactionally and incorrect latest evidence blocks completion',async()=>{
 const f=await foundation(),l=await newLesson(f);await run(f.user,'startLesson',{lessonId:l.id});const recorded=[];
 for(const a of f.activities)recorded.push(await run(f.user,'recordAttempt',attemptInput(a,l)));
 const wrong=await run(f.user,'recordAttempt',{...attemptInput(f.activities[1],l),result:'INCORRECT'});
 await assert.rejects(run(f.user,'undoAttempt',{attemptId:recorded[1].id}),/UNDO_NOT_LATEST/);
 await assert.rejects(run(f.user,'completeLesson',{lessonId:l.id}),/INCOMPLETE/);
 await run(f.user,'undoAttempt',{attemptId:wrong.id});await run(f.user,'completeLesson',{lessonId:l.id});
 await run(f.user,'undoAttempt',{attemptId:recorded.at(-1).id});const reopened=await query(f.user,'lesson',l.id);assert.equal(reopened.status,'ACTIVE');assert.equal(reopened.completedAt,null);
 await run(f.user,'abandonLesson',{lessonId:l.id});await assert.rejects(run(f.user,'recordAttempt',attemptInput(f.activities[5],l)),/NOT_ACTIVE/);
});

test('ObjectiveState is explicitly versioned storage, not a new Due/mastery scheduler',async()=>{
 const f=await foundation();const input={objectiveId:f.objective.id,mastery:0.3,incorrectCount:1,lastReviewedAt:new Date().toISOString(),nextReviewAt:null,expectedVersion:0};
 const first=await run(f.user,'writeObjectiveState',input);assert.equal(first.version,1);
 const writes=await Promise.allSettled([run(f.user,'writeObjectiveState',{...input,expectedVersion:1,mastery:0.4}),run(f.user,'writeObjectiveState',{...input,expectedVersion:1,mastery:0.5})]);assert.equal(writes.filter(v=>v.status==='fulfilled').length,1);assert.match(writes.find(v=>v.status==='rejected').reason.code,/STATE_VERSION/);
 assert.equal((await query(f.user,'objectiveState',f.objective.id)).version,2);
 assert.equal((await retention.retentionSnapshot(f.user)).dueCount,0);
});

test('explicit legacy import is repeatable, preserves Card/Set/Review and old restore/Undo; domain sessions do not enter old Continue',async()=>{
 const user=await owner();const setId=await legacy.saveGeneratedSet(user,{title:'Legacy',category:'',summary:'',keyPoints:[],sourceContent:'Text',cards:[{question:'Recall',answer:'A',format:'qa',choices:[],difficulty:2},{question:'Choose',answer:'B',format:'multiple_choice',choices:['A','B','C','D'],difficulty:2},{question:'Explain',answer:'C',format:'self_explain',choices:[],difficulty:2}]});
 const before=(await c.execute({sql:'SELECT * FROM cards WHERE user_id=?',args:[user]})).rows;
 const patch=await run(user,'importLegacySet',{setId});assert.deepEqual(await run(user,'importLegacySet',{setId}),patch);
 const objectives=await query(user,'objectives',patch.id);const activities=(await Promise.all(objectives.map(o=>query(user,'activities',o.id)))).flat();assert.deepEqual(activities.map(a=>a.type),['RECALL','CHOICE','EXPLAIN']);
 assert.deepEqual((await c.execute({sql:'SELECT * FROM cards WHERE user_id=?',args:[user]})).rows,before);
 const cards=(await legacy.loadAppData(user)).sets[0].cards;
 await retention.startStudySession(user,'legacy-session',cards.map(c=>c.id));assert.equal((await query(user,'lesson','legacy-session')).legacy,true);
 await assert.rejects(run(user,'startLesson',{lessonId:'legacy-session'}),/READ_ONLY/);
 const review=await legacy.reviewCard(user,cards[0].id,'good',100,'legacy-session',{operationId:'legacy-op',expectedReviewCount:0});
 assert.equal((await service.legacyHistory(user,cards[0].id))[0].reviewLogId,review);await legacy.undoReview(user,review,'legacy-session');assert.deepEqual(await service.legacyHistory(user,cards[0].id),[]);
 // Import has no implicit mastery/history conversion.
 assert.equal((await query(user,'objectiveState',objectives[0].id)),null);
 const f=await foundation(user),lesson=await newLesson(f);await run(user,'startLesson',{lessonId:lesson.id});
 assert.equal((await retention.retentionSnapshot(user)).session.id,'legacy-session');
 await assert.rejects(retention.startStudySession(user,lesson.id,cards.map(c=>c.id)),/セッションID/);
 await db.transaction(tx=>retention.reconcileStudy(tx,user,lesson.id,new Date().toISOString()));assert.equal((await query(user,'lesson',lesson.id)).status,'ACTIVE');
});

test('client uses supplied authenticated transport and stable operation ID; errors retain status without server payload leakage',async()=>{
 const requests=[];const client=createDomainClient(async(url,init)=>{requests.push({url,init});return Response.json({id:'attempt'});});
 const command={action:'recordAttempt',input:{activityId:'a',result:'CORRECT',response:'A',durationMs:1,operationId:'same-operation'}};
 await client.command(command);await client.command(command);assert.equal(requests[0].init.body,requests[1].init.body);
 await client.query({resource:'activities',id:'objective'});assert.equal(requests[2].url,'/api/domain?resource=activities&id=objective');
 const failed=createDomainClient(async()=>Response.json({code:'ACCOUNT_INACTIVE',secret:'private'},{status:403}));await assert.rejects(failed.query({resource:'patches'}),e=>e.status===403&&e.message==='ACCOUNT_INACTIVE');
});

test('new schema ownership validation includes all new relations',async()=>{await validateDatabase(c,await loadMigrations());});

test('encrypted backup restores new domain, ordered evidence and deletion retry; failed deletion rolls back and B/legacy survive',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {randomBytes}=await import('node:crypto');const {backup,restoreCheck}=await import('../scripts/infra/backup.mjs');
 const {resolveInternalUser}=await import('../db/auth-store.ts');const {createDeletionChallenge,requestDeletion}=await import('../db/account-deletion.ts');const {runDeletionJob}=await import('../lib/deletion-worker.ts');
 const issuer='https://domain-fixture.example',subject='user_domain_delete';const user=await resolveInternalUser(issuer,subject);
 const a=await foundation(user),b=await foundation(),lesson=await newLesson(a);await run(user,'startLesson',{lessonId:lesson.id});const input=attemptInput(a.activities[0],lesson);const recorded=await run(user,'recordAttempt',input);
 await run(user,'writeObjectiveState',{objectiveId:a.objective.id,mastery:0.25,incorrectCount:2,lastReviewedAt:null,nextReviewAt:null,expectedVersion:0});
 await c.execute("INSERT OR IGNORE INTO users(id,created_at) VALUES('loop-owner','now')");
 await legacy.loadAppData('loop-owner');
 await legacy.saveGeneratedSet('loop-owner',{title:'Isolated legacy',category:'',summary:'',keyPoints:[],sourceContent:'Legacy private',cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]});
 const bLesson=await newLesson(b);await run(b.user,'startLesson',{lessonId:bLesson.id});const bInput=attemptInput(b.activities[0],bLesson);const bAttempt=await run(b.user,'recordAttempt',bInput);
 const legacyBefore=(await c.execute("SELECT * FROM cards WHERE user_id='loop-owner'")).rows;
 const auth={issuer,subject,sessionId:'sess_domain_delete',claims:{reverification_id:'before'}};
 const challenge=await createDeletionChallenge(user,auth);await requestDeletion({...auth,claims:{reverification_id:'after',fva:[0,-1]}},{challengeId:challenge.challengeId,operationId:crypto.randomUUID(),receipt:'ce'.repeat(32)});
 await assert.rejects(run(user,'recordAttempt',input),/ACCOUNT_INACTIVE/);
 const dir=await mkdtemp('/private/tmp/patch-domain-backup-'),key=randomBytes(32);
 try {
  await backup(c,{directory:dir+'/backup',key,dbIdentifier:'isolated-domain',releaseSha:'test'});
  await restoreCheck(dir+'/backup',key,{verify:async restored=>{
    const restoredDb=createDatabase(restored),restoredService=createDomainService(createDomainUnitOfWork(restoredDb));globalThis.__domainDb=restoredDb;
    assert.equal((await restored.execute({sql:'SELECT id FROM attempts WHERE user_id=?',args:[user]})).rows[0].id,recorded.id);
    assert.deepEqual((await restored.execute({sql:'SELECT activity_id FROM lesson_activities WHERE user_id=? ORDER BY position',args:[user]})).rows.map(r=>r.activity_id),a.activities.map(v=>v.id));
    // Inject a transient mid-transaction database failure without modifying schema.
    let failOnce=true;
    globalThis.__domainDb={...restoredDb,transaction:action=>restoredDb.transaction(async tx=>{const execute=tx.execute.bind(tx);tx.execute=async statement=>{if(failOnce&&statement.sql==='DELETE FROM activities WHERE user_id=?'){failOnce=false;throw new Error('simulated outage');}return execute(statement);};return action(tx);})};
    let providerCalls=0;const remote={inspectApple:async()=>false,deleteUser:async()=>{providerCalls++;if(providerCalls===1)throw new Error('Clerk temporary failure');}};
    const start=Date.now();assert.equal((await runDeletionJob(remote,start)).state,'retry');assert.equal(providerCalls,0);
    assert.equal((await restored.execute({sql:'SELECT count(*) n FROM attempts WHERE user_id=?',args:[user]})).rows[0].n,1);
    globalThis.__domainDb=restoredDb;
    assert.equal((await runDeletionJob(remote,start+86400000)).state,'retry');
    for(const table of ['patches','sources','learning_objectives','activities','attempts','objective_states','lesson_activities','study_sessions'])assert.equal((await restored.execute({sql:`SELECT count(*) n FROM ${table} WHERE user_id=?`,args:[user]})).rows[0].n,0,table);
    assert.equal((await runDeletionJob(remote,start+172800000)).state,'completed');assert.equal(providerCalls,2);
    assert.deepEqual(await restoredService.command(b.user,{action:'recordAttempt',input:bInput}),bAttempt);
    assert.equal((await restoredService.query(b.user,{resource:'patch',id:b.patch.id})).id,b.patch.id);
    assert.deepEqual((await restored.execute("SELECT * FROM cards WHERE user_id='loop-owner'")).rows,legacyBefore);
    await assert.rejects(restoredService.command(user,{action:'recordAttempt',input}),/ACCOUNT_INACTIVE/);
    await validateDatabase(restored,await loadMigrations());
  }});
 } finally {globalThis.__domainDb=db;await rm(dir,{recursive:true,force:true});}
});

test('failed Lesson assignment and failed Undo roll back every preceding write',async()=>{
 const f=await foundation();
 const fault=fragment=>createDomainService(createDomainUnitOfWork({...db,transaction:action=>db.transaction(async tx=>{const execute=tx.execute.bind(tx);tx.execute=async statement=>{if(statement.sql.startsWith(fragment))throw new Error('injected DB failure');return execute(statement);};return action(tx);})}));
 await assert.rejects(fault('INSERT INTO lesson_activities').command(f.user,{action:'createLesson',input:{patchId:f.patch.id,targetMinutes:6,activityIds:f.activities.map(a=>a.id)}}),/injected/);
 assert.deepEqual(await query(f.user,'lessons',f.patch.id),[]);
 const l=await newLesson(f);await run(f.user,'startLesson',{lessonId:l.id});let last;
 for(const a of f.activities)last=await run(f.user,'recordAttempt',attemptInput(a,l));await run(f.user,'completeLesson',{lessonId:l.id});
 await assert.rejects(fault('UPDATE study_sessions').command(f.user,{action:'undoAttempt',input:{attemptId:last.id}}),/injected/);
 assert.equal((await query(f.user,'attempts',last.activityId)).at(-1).undoneAt,null);assert.equal((await query(f.user,'lesson',l.id)).status,'COMPLETED');
});

test('transport failure after committed Attempt can be retried with the identical operation',async()=>{
 const f=await foundation(),l=await newLesson(f);await run(f.user,'startLesson',{lessonId:l.id});let lost=true;
 const client=createDomainClient(async(_url,init)=>{const response=await service.command(f.user,JSON.parse(init.body));if(lost){lost=false;throw new TypeError('offline after commit');}return Response.json(response);});
 const command={action:'recordAttempt',input:attemptInput(f.activities[0],l)};
 await assert.rejects(client.command(command),/offline/);const recovered=await client.command(command);
 assert.equal((await query(f.user,'attempts',command.input.activityId)).length,1);assert.equal(recovered.operationId,command.input.operationId);
});
