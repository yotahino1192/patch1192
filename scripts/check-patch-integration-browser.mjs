import { createClient } from '@libsql/client';
import { migrate } from './infra/migrations.mjs';
// Run after npm run build. Real UI + authenticated APIs, isolated browser/DB and test-only SDK entry.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {headers as authHeaders, token} from '../tests/auth-fixture.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {realpathSync} from 'node:fs';
import {continueLearning} from '../lib/continue-learning.ts';
const root=process.cwd(), dir=await mkdtemp(join(tmpdir(),'patch-integration-browser-'));
const chromePath=process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appPort=Number(process.env.TEST_APP_PORT || 3158), debugPort=Number(process.env.TEST_DEBUG_PORT || 9408);
const origin=`http://127.0.0.1:${appPort}`;
const output=process.env.INTEGRATION_SCREENSHOT_DIR||join(root,'outputs/integration');await mkdir(output,{recursive:true});
const prep=createClient({url:`file:${dir}/test.db`});await migrate(prep);prep.close();
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(appPort),'--hostname','127.0.0.1'],{cwd:root,env:{...process.env,TURSO_DATABASE_URL:`file:${dir}/test.db`,TURSO_AUTH_TOKEN:'',OPENAI_API_KEY:'',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'',VERCEL:''},stdio:'ignore'});
const chrome=spawn(chromePath,['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
let startupError;server.on('error',e=>startupError=e);chrome.on('error',e=>startupError=e);
let ws,fixtureServer;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw new Error('Timed out: '+fn);}

try {
 await until(async()=> (await fetch(origin)).ok);
 const identities={};for(const who of ['A','B']){const r=await fetch(origin+'/api/auth/session',{headers:authHeaders('user_lesson_'+who)});assert.equal(r.status,200);identities[who]=await r.json();}
 const command=async(action,input)=>{const r=await fetch(origin+'/api/domain',{method:'POST',headers:authHeaders('user_lesson_A',identities.A.userId,{'content-type':'application/json'}),body:JSON.stringify({action,input})});assert.equal(r.status,200, r.status===200?'':await r.text());return r.json();};
 const query=async(resource,id)=>{const r=await fetch(origin+'/api/domain?'+new URLSearchParams({resource,id}),{headers:authHeaders('user_lesson_A',identities.A.userId)});assert.equal(r.status,200, r.status===200?'':await r.text());return r.json();};
 const post=async(path,body,who='A')=>{const r=await fetch(origin+path,{method:'POST',headers:authHeaders('user_lesson_'+who,identities[who].userId,{'content-type':'application/json'}),body:JSON.stringify(body)});assert.equal(r.status,200, r.status===200?'':await r.text());return r.json();};
 const data=async()=>await(await fetch(origin+'/api/data',{headers:authHeaders('user_lesson_A',identities.A.userId)})).json();
 // Existing-user fixture: creating material before the first profile read follows the existing onboarding policy.
 for(const who of ['A','B'])await post('/api/data',{action:'saveSet',material:{title:'Existing card material',category:'Test',summary:'Existing Continue Learning',keyPoints:[],sourceContent:'Existing source',cards:Array.from({length:8},(_,i)=>({question:'Legacy question '+i,answer:'Legacy answer',format:'qa',choices:[],difficulty:2}))}},who);
 assert.equal((await data()).profile.onboardingCompleted,true);
 const patch=await command('createPatch',{title:'Learning through recall — 統合レッスン',mode:'TOPIC'});
 const objective=await command('createObjective',{patchId:patch.id,description:'Understand retrieval',objectiveType:'CONCEPT',difficulty:2});
 const activities=[];for(const type of ['LEARN','RECALL','CHOICE','EXPLAIN','APPLY','LEARN'])activities.push(await command('createActivity',{objectiveId:objective.id,type,prompt:type+' question',answer:'Answer',explanation:'Explanation',estimatedSeconds:60,metadata:type==='CHOICE'?{choices:['Answer','Other']}:{}}));
 const lesson=await command('createLesson',{patchId:patch.id,targetMinutes:6,activityIds:activities.map(a=>a.id)});
 const standalone=await command('createActivity',{objectiveId:objective.id,type:'LEARN',prompt:'Review the learning strategy',answer:'Answer',explanation:'Explanation',estimatedSeconds:300,metadata:{}});
 const abandoned=await command('createLesson',{patchId:patch.id,targetMinutes:5,activityIds:[standalone.id]});await command('abandonLesson',{lessonId:abandoned.id});
 const before=await data();const selectionBefore=continueLearning(before,[]);
 // Historical U2 compatibility fixture only. Free v1 production entry remains disabled;
 // check-build-review-browser verifies the actual Free v1 route and hidden features.
 const legacyLessonFixture={name:'legacy-lesson-fixture',enforce:'pre',transform(code,id){if(id.endsWith('/app/page.tsx'))return code.replace('const advancedStudyEnabled = false;','const advancedStudyEnabled = true;');}};
 fixtureServer=await createServer({configFile:false,root,cacheDir:join(dir,'vite-cache'),plugins:[legacyLessonFixture,react(),{name:'lesson-identity',configureServer(server){server.middlewares.use('/__lesson_identity',(_req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({lessonId:lesson.id,...Object.fromEntries(['A','B'].map(who=>[who,{identity:identities[who],token:token('user_lesson_'+who,{exp:Math.floor(Date.now()/1000)+600})}]))}));});}}],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{fs:{allow:[root,realpathSync('node_modules')]},host:'127.0.0.1',port:5238,strictPort:true,proxy:{'/api':{target:origin}}}});await fixtureServer.listen();
 await until(async()=> (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const target=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(new Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const watchStartup=()=>evaluate(`window.splashReturns=0;new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches('.patch-startup')||n.querySelector('.patch-startup')))window.splashReturns++;}).observe(document.getElementById('root'),{childList:true,subtree:true});`);
 const reload=async()=>{const before=await evaluate('performance.timeOrigin');await cdp('Page.reload');await until(()=>evaluate(`performance.timeOrigin!==${before} && document.readyState==="complete"`));};
 const text=()=>evaluate('document.body.textContent');
 const primary=()=>evaluate('document.querySelector("[data-primary]").click()');
 const type=()=>evaluate('document.querySelector("[data-activity-type]")?.dataset.activityType');
 const state=()=>evaluate('document.querySelector("[data-activity-state]")?.dataset.activityState');
 const answer=()=>evaluate(`(()=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'My answer');el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('input[type=radio]').click();})()`);
 const choose=()=>evaluate('document.querySelector("input[type=radio]").click()');
 const ready=expected=>until(async()=>(await type())===expected&&!(await evaluate('document.querySelector("[data-primary]")?.textContent.includes("保存中")')));
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const clickText=label=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
 const home=()=>until(()=>evaluate('!!document.querySelector(".patch-home")'));
 const openPreview=async id=>{await until(()=>evaluate(`!!document.querySelector('[data-lesson-id="${id}"]')`));await click(`[data-lesson-id="${id}"]`);await until(()=>evaluate('!!document.querySelector(".patch-sheet[open]")'));};
 const start=async id=>{await openPreview(id);await click('.patch-sheet[open] .patch-primary');};
 const capture=async name=>{
  await evaluate('document.fonts.ready');await until(()=>evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'));
  for(const width of [320,393,430]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:852,deviceScaleFactor:1,mobile:true});await delay(120);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${name} ${width}: overflow`);
   await evaluate('window.scrollTo(0,0)');const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${name}-${width}.png`),Buffer.from(shot.data,'base64'));
   const reachable=await evaluate(`(()=>{const button=document.querySelector('.patch-sheet[open] .patch-primary')||document.querySelector('[data-primary]')||document.querySelector('.study-card-editor .primary')||document.querySelector('.swipe-actions .correct')||document.querySelector('[data-lesson-id]');if(!button)return true;button.scrollIntoView({block:'center'});const r=button.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&!!hit&&button.contains(hit);})()`);
   assert.equal(reachable,true,`${name} ${width}: primary action reachable`);
   if(width===320){const actionShot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,`${name}-${width}-action.png`),Buffer.from(actionShot.data,'base64'));}

  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 };
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:'http://127.0.0.1:5238/tests/fixtures/patch-integration.html?startup=1'});
 for(const phase of ['session','account','data']) {
  await until(()=>evaluate(`window.integrationFixture?.startupPhase===${JSON.stringify(phase)}`));
  assert.equal(await evaluate('!!document.querySelector(".patch-startup")'),true,phase+' boot wait uses startup splash');
  assert.equal(await evaluate('!!document.querySelector(".bottom-nav")'),false,'No app navigation before initial data');
  await evaluate(`integrationFixture.releaseStartup(${JSON.stringify(phase)})`);
 }
 await home();await until(()=>evaluate(`!!document.querySelector('[data-lesson-id="${lesson.id}"]')`));
 assert.equal(await evaluate('!!document.querySelector(".patch-startup")'),false,'Ready Home removes splash without a branding delay');
 await evaluate(`history.replaceState(null,'',location.pathname)`);await watchStartup();

 assert.equal(await evaluate(`!!document.querySelector('[data-lesson-id="${abandoned.id}"]')`),false);
 await capture('home');
 // The original CTA continues to select its original card/review destination.
 await click('.patch-lesson-start');await until(()=>evaluate('!!document.querySelector(".patch-sheet[open]")'));
 const expectedTitle=selectionBefore.kind==='set'?before.sets.find(s=>s.id===selectionBefore.id).title:'今日の復習';
 assert.equal(await evaluate('document.querySelector(".patch-sheet[open] h2").textContent'),expectedTitle);
 await click('.patch-sheet[open] .patch-sheet-close');
 const beforeWrites=await evaluate('integrationFixture.writes.length');
 await openPreview(lesson.id);await until(()=>evaluate('document.querySelector(".patch-sheet[open]").textContent.includes("6分")'));
 assert.equal((await query('lesson',lesson.id)).status,'CREATED');assert.equal(await evaluate('integrationFixture.writes.length'),beforeWrites);
 assert.equal(await evaluate('document.querySelector(".patch-sheet[open] h2").textContent'),'Learning through recall — 統合レッスン');
 assert.equal(await evaluate('(()=>{const ids=[...document.querySelectorAll("[id]")].map(e=>e.id);return new Set(ids).size===ids.length})()'),true,'Unique dialog heading IDs');
 await capture('preview');await click('.patch-sheet[open] .patch-sheet-close');
 assert.equal((await query('lesson',lesson.id)).status,'CREATED');
 await start(lesson.id);await ready('LEARN');assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');
 assert.equal(await evaluate('!!document.querySelector(".bottom-nav")'),false);await capture('learn');
 // Consent/Help stays in the real App privacy boundary and never records an Attempt.
 await clickText('わからない・AIに聞く');await primary();await until(async()=>(await text()).includes('AI機能へのデータ送信'));
 await clickText('今は許可しない');await until(async()=>(await text()).includes('AIへの送信が許可されていない'));assert.equal(await evaluate('integrationFixture.helpCalls'),0);
 await primary();await until(async()=>(await text()).includes('同意して続ける'));await clickText('同意して続ける');await until(async()=>(await text()).includes('Integration test explanation'));await capture('help');await clickText('閉じる');
 assert.equal((await query('attempts',activities[0].id)).length,0);
 await evaluate('integrationFixture.lose=true');await primary();await until(async()=>(await text()).includes('保存状態を確認できません'));await primary();await ready('RECALL');
 assert.equal((await query('attempts',activities[0].id)).length,1);
 await primary();await until(()=>evaluate('!!document.querySelector("input[type=radio]")'));await choose();await capture('recall');
 await clickText('中断してホームへ');await home();assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');
 await start(lesson.id);await ready('RECALL');assert.equal(await evaluate('document.querySelector("input[type=radio]").checked'),true);
 await evaluate('for(let i=0;i<8;i++)document.querySelector("[data-primary]").click()');await until(async()=>(await state())==='FEEDBACK');assert.equal((await query('attempts',activities[1].id)).length,1);
 await primary();await ready('CHOICE');await capture('choice');
 await evaluate('document.querySelectorAll("input[type=radio]")[1].click()');await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await choose();await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await ready('EXPLAIN');
 await answer();assert.equal(await evaluate('window.splashReturns'),0,'Preview, activities and AI never restore splash');await reload();await ready('EXPLAIN');await watchStartup();assert.equal(await evaluate('document.querySelector("textarea").value'),'My answer');await capture('explain');
 await evaluate('integrationFixture.fail=true');await primary();await until(async()=>(await state())==='ERROR');await evaluate('integrationFixture.fail=false');await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await ready('APPLY');
 await answer();await capture('apply');await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await ready('LEARN');
 await evaluate('integrationFixture.failComplete=true');await primary();await until(async()=>(await text()).includes('保存状態を確認できません'));assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');assert.equal(await evaluate('!!document.querySelector(".patch-complete")'),false);
 await evaluate('integrationFixture.failComplete=false');await primary();await until(()=>evaluate('!!document.querySelector(".patch-complete")'));
 assert.equal((await query('lesson',lesson.id)).status,'COMPLETED');
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".patch-results strong")].map(e=>e.textContent)'),['6','1']);
 assert.ok((await text()).includes('完了したアクティビティ'));await capture('complete');
 assert.equal(await evaluate('window.splashReturns'),0,'Save and completion never restore splash');
 await reload();await until(()=>evaluate('!!document.querySelector(".patch-complete")'));await watchStartup();assert.deepEqual(await evaluate('[...document.querySelectorAll(".patch-results strong")].map(e=>e.textContent)'),['6','1']);
 await click('.completion-actions .patch-primary');await home();await capture('post-home-unqualified');assert.equal(await evaluate('window.splashReturns'),0,'Preview, activities, AI, save and return Home never restore splash');
 const after=await data();for(const key of ['streak','completed','dueCount','dueCardIds'])assert.deepEqual(after.retention[key],before.retention[key],key+' must not change from a U2 lesson');
 assert.deepEqual(continueLearning(after,[]),selectionBefore);assert.equal(after.reviews.length,before.reviews.length);
 assert.equal(await evaluate('!!document.querySelector(".patch-home-completed")'),false);
 await until(()=>evaluate('!document.querySelector(".patch-home-lessons")'));assert.equal(await evaluate(`!!document.querySelector('[data-lesson-id="${lesson.id}"]')`),false);
 // Existing official review qualification still supplies the completed-today Home.
 const plan=await post('/api/retention',{action:'start',id:'integration-legacy',cardIds:after.sets[0].cards.map(c=>c.id)});
 assert.equal(plan.qualifies,true);
 for(const cardId of plan.cardIds)await post('/api/data',{action:'reviewCard',cardId,rating:'good',responseMs:100,sessionId:plan.id,operationId:crypto.randomUUID(),expectedReviewCount:0});
 const earned=await data();assert.equal(earned.retention.completed,true);assert.equal(earned.retention.streak,1);
 const next=await command('createLesson',{patchId:patch.id,targetMinutes:5,activityIds:[standalone.id]});
 await reload();await home();assert.equal(await evaluate('!!document.querySelector(".patch-home-completed")'),true);
 await start(next.id);await ready('LEARN');await primary();await until(()=>evaluate('!!document.querySelector(".patch-complete")'));await click('.completion-actions .patch-primary');await home();await capture('post-home-qualified');
 assert.equal((await data()).retention.streak,1);assert.equal(await evaluate('!!document.querySelector(".patch-home-completed")'),true);
 // Existing card-set study uses the Home palette and remains usable on narrow screens.
 await click('.bottom-nav button:nth-child(2)');await until(()=>evaluate('!!document.querySelector(".library-set-open")'));
 await click('.library-set-open');await until(()=>evaluate('!!document.querySelector(".set-page > .primary")'));
 await click('.set-page > .primary');await until(()=>evaluate('!!document.querySelector(".flashcard-tap")'));
 await capture('card-question');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".flashcard")).backgroundColor'),'rgb(255, 255, 255)');
 assert.equal(await evaluate('document.querySelector(".swipe-actions .correct").disabled'),true);
 await click('.flashcard-tap');await until(()=>evaluate('!!document.querySelector(".flashcard.flipped")'));await capture('card-answer');
 assert.equal(await evaluate('document.querySelector(".swipe-actions .correct").disabled'),false);
 await click('.edit-study-button');await until(()=>evaluate('!!document.querySelector(".study-card-editor")'));await capture('card-editor');
 await clickText('キャンセル');await until(()=>evaluate('!!document.querySelector(".flashcard")'));
 await click('.pause-study');await until(()=>evaluate('!!document.querySelector(".bottom-nav")'));await click('.bottom-nav button:first-child');await home();
 // List failure/retry and stale account replies cannot leak titles or completed results.
 const pendingLesson=await command('createLesson',{patchId:patch.id,targetMinutes:5,activityIds:[standalone.id]});
 await reload();await home();
 // Reload resets the transport fixture, so exercise the error by remounting Home via a real Lesson.
 await start(pendingLesson.id);await ready('LEARN');await evaluate('integrationFixture.failList=true');await clickText('中断してホームへ');await home();await until(async()=>(await text()).includes('マイレッスンを読み込めませんでした。'));
 await evaluate('integrationFixture.failList=false');await clickText('再試行');await until(()=>evaluate(`!!document.querySelector('[data-lesson-id="${pendingLesson.id}"]')`));
 await start(pendingLesson.id);await ready('LEARN');await evaluate('integrationFixture.listDelay=800');await clickText('中断してホームへ');await home();await evaluate('integrationFixture.switchAccount("B")');await delay(1300);await home();assert.equal((await text()).includes('Learning through recall'),false);
 await evaluate(`{const url=new URL(location.href);url.searchParams.set('lesson',${JSON.stringify(lesson.id)});history.pushState(null,'',url);dispatchEvent(new PopStateEvent('popstate'));}`);
 await until(async()=>(await text()).includes('読み込めませんでした'));assert.equal(await evaluate('!!document.querySelector(".patch-complete")'),false);
 await evaluate('integrationFixture.switchAccount(null)');await until(async()=>(await text()).includes('ログイン'));assert.equal((await text()).includes('Learning through recall'),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: real App Home -> read-only preview -> U2 six activities -> durable Phase 1 completion -> Home; consent, duplicate/lost response, retry, draft/reload/resume, incorrect count; unchanged Continue/Due/Streak; unqualified and qualified post-Home; list retry and account/logout isolation. Screenshots: '+output);
} finally {
 await fixtureServer?.close();ws?.close();for(const p of [chrome,server])if(p.exitCode===null){p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
