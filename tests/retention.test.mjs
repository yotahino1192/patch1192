import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {migrate} from '../scripts/infra/migrations.mjs';
import {nextMidnight,advanceClock,planStudy,widgetState,notificationPlan,parseDeepLink} from '../lib/retention.ts';
const client=createClient({url:':memory:'});await migrate(client);globalThis.__retentionDb=createDatabase(client);after(()=>client.close());
registerHooks({resolve(s,c,n){if(s==='./client')return {url:'data:text/javascript,export function database(){return globalThis.__retentionDb} export async function initializeDatabase(){await globalThis.__retentionDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){const url=new URL(s+'.ts',c.parentURL);if(existsSync(url))return n(url.href,c);}return n(s,c);}});
const {startStudySession,retentionSnapshot}=await import('../db/retention.ts');
const {saveGeneratedSet,loadAppData,reviewCard,undoReview,updateOnboarding}=await import('../db/store.ts');
const {continueLearning,resolveDeepLink,acceptsPendingLink}=await import('../lib/continue-learning.ts');
const iso=s=>Date.parse(s);
test('DST uses actual 23/25-hour days, Tokyo midnight and travel cannot award twice',()=>{
 assert.equal(nextMidnight(iso('2026-03-08T05:00:00Z'),'America/New_York')-iso('2026-03-08T05:00:00Z'),23*3600000);
 assert.equal(nextMidnight(iso('2026-11-01T04:00:00Z'),'America/New_York')-iso('2026-11-01T04:00:00Z'),25*3600000);
 assert.equal(nextMidnight(iso('2026-09-13T14:59:59Z'),'Asia/Tokyo'),iso('2026-09-13T15:00:00Z'));
 const clock={day:4,end:iso('2026-09-13T15:00:00Z'),timezone:'Asia/Tokyo',pendingTimezone:'Asia/Tokyo'};
 const travel=advanceClock(clock,clock.end-1,'America/Los_Angeles');assert.equal(travel.day,4);assert.equal(travel.end,clock.end);assert.equal(travel.timezone,'Asia/Tokyo');
 const next=advanceClock(travel,clock.end);assert.equal(next.day,4);assert.equal(advanceClock(next,next.end).day,5);assert.equal(next.timezone,'America/Los_Angeles');assert(next.end>clock.end);
});
test('official duration estimate depends on material, not fixed card count',()=>{
 const easy={question:'Q',answer:'A',format:'qa',difficulty:1};const long={question:'Explain '.repeat(100),answer:'Answer '.repeat(100),format:'self_explain',difficulty:3};
 assert.equal(planStudy([easy,easy,easy]).qualifies,false);assert.equal(planStudy([long,long,long]).qualifies,true);assert(planStudy(Array(100).fill(easy)).estimatedSeconds<=600);
});
async function cards(owner,n=10){await saveGeneratedSet(owner,{title:'Retention',category:'',summary:'',keyPoints:[],sourceContent:'source',cards:Array.from({length:n},(_,i)=>({question:'Q'+i,answer:'A',format:'qa',choices:[],difficulty:2}))});return (await loadAppData(owner)).sets[0].cards;}
test('official session completes once, retries preserve evidence, undo recalculates, second completed set preserves day',async()=>{
 const owner='retention-A',all=await cards(owner);const first=await startStudySession(owner,'session1',all.map(c=>c.id));assert(first.qualifies);
 assert.deepEqual(await startStudySession(owner,'session1',all.map(c=>c.id)),first);
 let last;for(const id of first.cardIds)last=await reviewCard(owner,id,'good',100,'session1',{operationId:'op-'+id,expectedReviewCount:0});
 let snapshot=await retentionSnapshot(owner);assert.equal(snapshot.streak,1);assert(snapshot.completed);
 await reviewCard(owner,first.cardIds.at(-1),'good',100,'session1',{operationId:'op-'+first.cardIds.at(-1),expectedReviewCount:0});assert.equal((await retentionSnapshot(owner)).streak,1);
 await undoReview(owner,last,'session1');assert.equal((await retentionSnapshot(owner)).streak,0);
 await reviewCard(owner,first.cardIds.at(-1),'good',100,'session1');
 const second=await startStudySession(owner,'session2',all.map(c=>c.id));for(const id of second.cardIds)last=await reviewCard(owner,id,'good',100,'session2');
 await undoReview(owner,last,'session2');assert.equal((await retentionSnapshot(owner)).streak,1);
 await assert.rejects(startStudySession('retention-B','foreign',all.map(c=>c.id)));
});
test('due count includes overdue, later today and long-term, excludes new, tomorrow and archived; no 500-log cap',async()=>{
 const owner='due-owner',all=await cards(owner,6);const snapshot=await retentionSnapshot(owner);const end=snapshot.dayEnd;
 for(const [i,card] of all.entries())await client.execute({sql:'UPDATE cards SET review_count=?,status=?,interval_days=?,due_at=? WHERE id=?',args:[i===0?0:1,i===0?'未学習':i===5?'アーカイブ':'復習待ち',i===3?90:1,new Date(i===4?end:i===2?end-1:0).toISOString(),card.id]});
 const due=await retentionSnapshot(owner);assert.equal(due.dueCount,3);assert(due.dueCardIds.includes(all[3].id));
 // Session reconstruction is an unbounded evidence query, independent of AppData's 500-row display cap.
 const active=await cards('many-owner',10);const session=await startStudySession('many-owner','many-session',active.map(c=>c.id));for(const id of session.cardIds)await reviewCard('many-owner',id,'good',1,'many-session');
 for(let i=0;i<501;i++)await reviewCard('many-owner',active.at(-1).id,'good',1,'noise');
 assert.equal((await loadAppData('many-owner')).reviews.length,500);assert.equal((await retentionSnapshot('many-owner')).streak,1);
});
test('hot threshold, break and midnight reset are server-derived',async()=>{
 const owner='hot-owner',all=await cards(owner);await retentionSnapshot(owner);await client.execute({sql:'UPDATE retention_state SET day=5 WHERE user_id=?',args:[owner]});
 for(let i=1;i<=5;i++)await client.execute({sql:"INSERT INTO study_sessions (user_id,id,set_id,card_ids,estimated_seconds,qualifies,created_at,completed_at,earned_day) VALUES (?,?,?,?,300,1,'now','now',?)",args:[owner,'day'+i,all[0].setId,'[]',i]});
 const hot=await retentionSnapshot(owner);assert.equal(hot.streak,5);assert(hot.hot);
 const tomorrow=await retentionSnapshot(owner,undefined,hot.dayEnd);assert.equal(tomorrow.streak,5);assert(!tomorrow.completed);
 const missed=await retentionSnapshot(owner,undefined,tomorrow.dayEnd);assert.equal(missed.streak,0);assert(missed.broken);
});
test('onboarding exception awards Day 1 and undo revokes the only evidence',async()=>{
 const owner='intro-retention';await loadAppData(owner);await updateOnboarding(owner,{step:'name',displayName:'Test'});
 const {INTEREST_GROUPS,GOALS,recommend}=await import('../lib/onboarding.ts');
 const interests=Object.values(INTEREST_GROUPS).flat().slice(0,3);await updateOnboarding(owner,{step:'interests',interests});await updateOnboarding(owner,{step:'goal',learningGoal:GOALS[0]});
 const preset=recommend(interests,GOALS[0])[0].preset;await updateOnboarding(owner,{step:'select',presetId:preset.id});const profile=(await loadAppData(owner)).profile;
 let last;for(const id of profile.initialCardIds)last=await reviewCard(owner,id,'again',1,profile.initialSessionId);
 assert.equal((await retentionSnapshot(owner)).streak,1);await undoReview(owner,last,profile.initialSessionId);assert.equal((await retentionSnapshot(owner)).streak,0);
});
test('all widget states and notification cancellation share the same snapshot',()=>{
 const now=iso('2026-09-13T08:00:00Z');const base={version:1,generatedAt:now,expiresAt:now+12*3600000,day:3,dayEnd:now+10*3600000,timezone:'UTC',streak:3,hot:false,completed:false,broken:false,dueCount:4,dueCardIds:[],reminderTime:'09:00',reviewReminder:true,streakWarning:true};
 assert.equal(widgetState(null,now),'SIGNED_OUT');assert.equal(widgetState({...base,streak:0},now),'NEW_USER');assert.equal(widgetState(base,now),'NORMAL');assert.equal(widgetState(base,now+4*3600000),'AT_RISK');assert.equal(widgetState(base,now+7*3600000),'LAST_CHANCE');assert.equal(widgetState({...base,completed:true},now),'COMPLETED');assert.equal(widgetState({...base,broken:true,streak:0},now),'BROKEN');assert.equal(widgetState({...base,expiresAt:now},now),'STALE');
 assert.equal(notificationPlan(base,now).length,2);assert.equal(notificationPlan({...base,dueCount:0,completed:true},now).length,0);assert.equal(notificationPlan(base,base.dayEnd).length,0);
 assert.equal(notificationPlan(base,now+8*3600000).length,0); // no replay of an already fired warning
});
test('continue priorities and deep links reject foreign/deleted resources and wrong account/expired pending intents',async()=>{
 const data=await loadAppData('retention-A');data.profile.onboardingCompleted=true;
 assert.equal(continueLearning({...data,profile:{...data.profile,onboardingCompleted:false}},[]).kind,'onboarding');
 assert.equal(continueLearning(data,[{id:'local',done:false,queue:[data.sets[0].cards[0].id]}]).id,'local');
 const withoutSession={...data,retention:{...data.retention,session:undefined,dueCount:2}};assert.equal(continueLearning(withoutSession,[]).kind,'review');
 assert.equal(resolveDeepLink('patch://set/foreign',data,[]).kind,'home');assert.equal(resolveDeepLink('patch://card/foreign',data,[]).kind,'home');
 assert.equal(parseDeepLink('https://continue'),null);assert.equal(parseDeepLink('patch://set/../card/x'),null);assert.equal(parseDeepLink('patch://continue?token=x'),null);
 assert(!acceptsPendingLink({at:1000,owner:'B'},'A',1001));assert(acceptsPendingLink({at:1000},'A',1001));assert(!acceptsPendingLink({at:1000},'A',400000));
});
test('account cleanup serializes against late publications, clears notifications/snapshot and permits a fresh account',async()=>{
 const {configureRetention,activateRetention,publishRetention,clearRetention}=await import('../lib/retention-platform.ts');let owner=null,cache=null;const events=[];
 configureRetention({activate:async v=>{owner=v.userId},clear:async v=>{events.push('clear:'+v.userId);if(owner===v.userId){owner=null;cache=null}},publish:async v=>{events.push('publish:'+v.userId);cache=v},permission:async()=>({granted:true}),links:async()=>({links:[]})});
 await activateRetention('A');const snapshot=await retentionSnapshot('retention-A');await publishRetention('A',snapshot);assert(!('dueCardIds' in cache.snapshot));assert(!('session' in cache.snapshot));
 await clearRetention('A');await publishRetention('A',snapshot);assert.equal(cache,null);await activateRetention('B');await clearRetention('A');await publishRetention('B',snapshot);assert.equal(cache.userId,'B');await publishRetention('B',{...snapshot,generatedAt:snapshot.generatedAt-1000,dueCount:999});assert.equal(cache.snapshot.dueCount,snapshot.dueCount);
});

test('completed study and undo propagate authoritative due/streak to native output; lifecycle cleanup is account-scoped', async t => {
 t.mock.timers.enable({apis:['Date'],now:iso('2026-09-13T08:00:00Z')});
 const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 const all=await cards(owner),plan=await startStudySession(owner,'regression-session',all.map(c=>c.id),'UTC');
 await client.execute({sql:"UPDATE retention_state SET day=1,timezone='UTC',pending_timezone='UTC',day_end=?,review_reminder=1,streak_warning=1,reminder_time='09:00' WHERE user_id=?",args:[nextMidnight(Date.now(),'UTC'),owner]});
 await client.execute({sql:"INSERT INTO study_sessions (user_id,id,set_id,card_ids,estimated_seconds,qualifies,created_at,completed_at,earned_day) VALUES (?,'yesterday',?,'[]',300,1,'yesterday','yesterday',0)",args:[owner,all[0].setId]});
 for(const id of plan.cardIds)await client.execute({sql:"UPDATE cards SET review_count=1,status='復習待ち',due_at='1970-01-01T00:00:00.000Z' WHERE id=?",args:[id]});
 const {configureRetention,activateRetention,publishRetention}=await import('../lib/retention-platform.ts');
 const {cleanupAccount,privacyStopKey}=await import('../lib/account-cleanup.ts');
 let deviceOwner=null,snapshot=null,notifications=[],links=[];
 configureRetention({
  activate:async ({userId})=>{deviceOwner=userId;},
  clear:async ({userId})=>{if(deviceOwner===userId){deviceOwner=null;snapshot=null;notifications=[];links=[];}},
  publish:async value=>{assert.equal(value.userId,deviceOwner);snapshot=value.snapshot;notifications=value.notifications;},
  permission:async()=>({granted:true}),links:async()=>({links}),
 });
 await activateRetention(owner);
 const before=await retentionSnapshot(owner);assert.equal(before.streak,1);assert.equal(before.completed,false);assert.equal(before.dueCount,plan.cardIds.length);
 await publishRetention(owner,before);assert.equal(notifications.length,2);assert.equal(widgetState(snapshot,Date.now()),'NORMAL');
 let last;for(const id of plan.cardIds)last=await reviewCard(owner,id,'good',100,plan.id);
 const completed=await retentionSnapshot(owner);assert.equal(completed.streak,2);assert.equal(completed.dueCount,0);
 await publishRetention(owner,completed);assert.equal(widgetState(snapshot,Date.now()),'COMPLETED');assert.deepEqual(notifications,[]);
 await undoReview(owner,last,plan.id);
 const undone=await retentionSnapshot(owner);assert.equal(undone.streak,1);assert.equal(undone.completed,false);assert.equal(undone.dueCount,1);
 await publishRetention(owner,undone);assert.equal(widgetState(snapshot,Date.now()),'NORMAL');assert.equal(notifications.length,2);
 const values=new Map([[`patch:workspace:v2:${owner}`,'A'],[`patch:workspace:v2:${other}`,'B'],[privacyStopKey(owner),'pending']]);
 const storage={removeItem:key=>values.delete(key)};
 links.push({url:'patch://continue',owner,at:Date.now()});
 await cleanupAccount(storage,owner);assert.equal(snapshot,null);assert.deepEqual(notifications,[]);assert.deepEqual(links,[]);assert.equal(values.get(`patch:workspace:v2:${other}`),'B');assert.equal(values.get(privacyStopKey(owner)),'pending');
 await publishRetention(owner,completed);assert.equal(snapshot,null);
 await cards(other);await activateRetention(other);const b=await retentionSnapshot(other);await publishRetention(other,b);
 assert.equal(snapshot.streak,0);assert.equal(snapshot.dueCount,0);
 await cleanupAccount(storage,owner,true);assert.equal(values.has(privacyStopKey(owner)),false);assert.equal(snapshot.streak,0);assert.equal(deviceOwner,other);
 await cleanupAccount(storage,other,true);assert.equal(snapshot,null);assert.deepEqual(notifications,[]);
});
