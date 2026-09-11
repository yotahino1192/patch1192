import assert from 'node:assert/strict';
import test, {after} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {PRESETS,INTEREST_GROUPS,GOALS,recommend,validInterests} from '../lib/onboarding.ts';
import {EMPTY_SESSION,reconcileSession} from '../lib/workspace.ts';
const dir=await mkdtemp('/tmp/patch-onboarding-');
const client=createClient({url:`file:${dir}/test.db`});
const db=createDatabase(client);globalThis.__onboardingDb=db;
after(async()=>{client.close();await rm(dir,{recursive:true,force:true});});
registerHooks({resolve(specifier,context,next){
 if(specifier==='./client')return {url:'data:text/javascript,export function database(){return globalThis.__onboardingDb} export async function initializeDatabase(){await globalThis.__onboardingDb.initialize()}',shortCircuit:true};
 if(specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))return next(new URL(specifier+'.ts',context.parentURL).href,context);
 return next(specifier,context);
}});
const {loadAppData,loadProfile,updateOnboarding,reviewCard,seedIfEmpty}=await import('../db/store.ts');
async function select(user){
 await loadAppData(user);
 await updateOnboarding(user,{step:'name',displayName:'テスト'});
 await updateOnboarding(user,{step:'interests',interests:['生成AI','ChatGPT','AIエージェント']});
 await updateOnboarding(user,{step:'goal',learningGoal:'仕事で使いたい'});
 await updateOnboarding(user,{step:'select',presetId:'ai-basics'});
 return (await loadAppData(user)).profile;
}
test('18 usable presets and exactly 3 unique recommendations for every interest and goal',()=>{
 assert.equal(PRESETS.length,18);assert.equal(new Set(PRESETS.map(p=>p.id)).size,18);
 for(const p of PRESETS){assert.ok(p.cards.length>=8&&p.cards.length<=12);assert.equal(new Set(p.cards.map(c=>c.question)).size,p.cards.length);for(const c of p.cards){assert.ok(c.question.trim());assert.ok(c.answer.trim());assert.ok(p.sourceContent.includes(c.answer));}}
 for(const interest of Object.values(INTEREST_GROUPS).flat())for(const goal of GOALS){const r=recommend([interest,'宇宙','写真'],goal);assert.equal(r.length,3);assert.equal(new Set(r.map(x=>x.preset.id)).size,3);}
 assert.deepEqual(recommend(['宇宙','写真','料理'],'ただ気になる').map(r=>r.preset.id),['ai-basics','bias','invest']);
 assert.equal(validInterests(['生成AI','ChatGPT']),false);assert.equal(validInterests(['生成AI','生成AI','ChatGPT']),false);
});
test('new and existing owners branch without changing existing materials',async()=>{
 assert.equal((await loadProfile('new')).onboardingCompleted,false);
 await seedIfEmpty('existing');const before=await loadAppData('existing');
 assert.equal(before.profile.onboardingCompleted,true);
 await updateOnboarding('existing',{step:'name',displayName:'ignored'});
 assert.deepEqual((await loadAppData('existing')).sets,before.sets);
});
test('server validates order, interests and goal; preset adoption is atomic and retry-safe',async()=>{
 await assert.rejects(updateOnboarding('validation',{step:'interests',interests:['生成AI','ChatGPT']}));
 await assert.rejects(updateOnboarding('validation',{step:'goal',learningGoal:'invalid'}));
 await assert.rejects(updateOnboarding('validation',{step:'finish'}));
 const p=await select('selection');
 await Promise.all([updateOnboarding('selection',{step:'select',presetId:'ai-basics'}),updateOnboarding('selection',{step:'select',presetId:'agents'})]);
 const data=await loadAppData('selection');assert.equal(data.sets.length,1);assert.equal(data.sets[0].cards.length,8);assert.equal(data.profile.initialSetId,p.initialSetId);assert.equal(p.initialCardIds.length,3);
});
test('3 answers including again finish once, recover from DB and mark Day 1 once',async()=>{
 const user='first';const p=await select(user);
 const operations=[];
 for(let i=0;i<3;i++){
  const op={operationId:crypto.randomUUID(),expectedReviewCount:0};operations.push(op);
  await reviewCard(user,p.initialCardIds[i],i===0?'again':'good',100,p.initialSessionId,op);
  if(i<2)assert.equal((await loadProfile(user)).firstLearningCompletedAt,null);
 }
 const data=await loadAppData(user);assert.ok(data.profile.firstLearningCompletedAt);assert.equal(data.dailyReview.streak,1);assert.equal(data.dailyReview.completed,true);assert.equal(data.dailyReview.completedCardIds.length,3);
 const restored=reconcileSession({...EMPTY_SESSION,id:p.initialSessionId,scope:p.initialSetId,setId:p.initialSetId,queue:p.initialCardIds,total:3},data);assert.equal(restored.done,true);
 await reviewCard(user,p.initialCardIds[2],'good',100,p.initialSessionId,operations[2]);
 await updateOnboarding(user,{step:'finish'});await updateOnboarding(user,{step:'finish'});
 const final=await loadAppData(user);assert.equal(final.profile.onboardingCompleted,true);assert.equal(final.dailyReview.streak,1);assert.equal(final.reviews.length,3);
 assert.equal((await db.prepare('SELECT count(*) n FROM daily_review_plans WHERE user_id=? AND completed_at IS NOT NULL').bind(user).first()).n,1);
});
test('failed preset transaction rolls back profile and material together',async()=>{
 const user='rollback';await loadProfile(user);await updateOnboarding(user,{step:'name',displayName:'名前'});await updateOnboarding(user,{step:'interests',interests:['生成AI','ChatGPT','AIエージェント']});await updateOnboarding(user,{step:'goal',learningGoal:'仕事で使いたい'});
 await db.prepare("CREATE TRIGGER fail_preset BEFORE INSERT ON cards WHEN NEW.user_id='rollback' BEGIN SELECT RAISE(ABORT,'test failure'); END").run();
 await assert.rejects(updateOnboarding(user,{step:'select',presetId:'ai-basics'}));
 assert.equal((await loadProfile(user)).initialSetId,null);assert.equal((await loadAppData(user)).sets.length,0);
 await db.prepare('DROP TRIGGER fail_preset').run();await updateOnboarding(user,{step:'select',presetId:'ai-basics'});assert.equal((await loadAppData(user)).sets.length,1);
});
test('a session spanning Tokyo dates achieves the completion day, with only 3 initial ToDos',async()=>{
 const OriginalDate=Date;let clock=new OriginalDate('2026-09-10T14:50:00Z').getTime();
 globalThis.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 try {
  const user='overnight',p=await select(user);
  await reviewCard(user,p.initialCardIds[0],'again',100,p.initialSessionId,{operationId:crypto.randomUUID(),expectedReviewCount:0});
  clock=new OriginalDate('2026-09-10T15:10:00Z').getTime();
  assert.equal((await loadAppData(user)).dailyReview.cardIds.length,3);
  for(const cardId of p.initialCardIds.slice(1))await reviewCard(user,cardId,'good',100,p.initialSessionId,{operationId:crypto.randomUUID(),expectedReviewCount:0});
  const data=await loadAppData(user);assert.deepEqual(data.dailyReview.achievedDays,['2026-09-11']);assert.equal(data.dailyReview.streak,1);assert.equal(data.dailyReview.completedCardIds.length,3);
 }finally{globalThis.Date=OriginalDate;}
});
