import { createClient } from '@libsql/client';
import { migrate } from './infra/migrations.mjs';
// Run after npm run build. Real UI + authenticated APIs, isolated browser/DB and test-only SDK entry.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {headers as authHeaders, token} from '../tests/auth-fixture.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=process.cwd(), dir=await mkdtemp(join(tmpdir(),'patch-domain-lesson-browser-'));
const chromePath=process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appPort=Number(process.env.TEST_APP_PORT || 3148), debugPort=Number(process.env.TEST_DEBUG_PORT || 9398);
const origin=`http://127.0.0.1:${appPort}`;
const prep=createClient({url:`file:${dir}/test.db`});await migrate(prep);prep.close();
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(appPort),'--hostname','127.0.0.1'],{cwd:root,env:{...process.env,TURSO_DATABASE_URL:`file:${dir}/test.db`,TURSO_AUTH_TOKEN:'',OPENAI_API_KEY:'',VERCEL:''},stdio:'ignore'});
const chrome=spawn(chromePath,['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
let startupError;server.on('error',e=>startupError=e);chrome.on('error',e=>startupError=e);
let ws,fixtureServer;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw new Error('Timed out: '+fn);}

try {
 await until(async()=> (await fetch(origin)).ok);
 const identities={};for(const who of ['A','B']){const r=await fetch(origin+'/api/auth/session',{headers:authHeaders('user_lesson_'+who)});assert.equal(r.status,200);identities[who]=await r.json();}
 const command=async(action,input)=>{const r=await fetch(origin+'/api/domain',{method:'POST',headers:authHeaders('user_lesson_A',identities.A.userId,{'content-type':'application/json'}),body:JSON.stringify({action,input})});assert.equal(r.status,200);return r.json();};
 const query=async(resource,id)=>{const r=await fetch(origin+'/api/domain?'+new URLSearchParams({resource,id}),{headers:authHeaders('user_lesson_A',identities.A.userId)});assert.equal(r.status,200);return r.json();};
 const patch=await command('createPatch',{title:'Domain E2E Patch',mode:'TOPIC'});
 const objective=await command('createObjective',{patchId:patch.id,description:'Understand retrieval',objectiveType:'CONCEPT',difficulty:2});
 const activities=[];for(const type of ['LEARN','RECALL','CHOICE','EXPLAIN','APPLY','LEARN'])activities.push(await command('createActivity',{objectiveId:objective.id,type,prompt:type+' question',answer:'Answer',explanation:'Explanation',estimatedSeconds:60,metadata:type==='CHOICE'?{choices:['Answer','Other']}:{}}));
 const lesson=await command('createLesson',{patchId:patch.id,targetMinutes:6,activityIds:activities.map(a=>a.id)});
 fixtureServer=await createServer({configFile:false,root,plugins:[react(),{name:'lesson-identity',configureServer(server){server.middlewares.use('/__lesson_identity',(_req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({lessonId:lesson.id,...Object.fromEntries(['A','B'].map(who=>[who,{identity:identities[who],token:token('user_lesson_'+who,{exp:Math.floor(Date.now()/1000)+600})}]))}));});}}],server:{host:'127.0.0.1',port:5228,strictPort:true,proxy:{'/api':{target:origin}}}});await fixtureServer.listen();
 await until(async()=> (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const target=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(new Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const reload=async()=>{const before=await evaluate('performance.timeOrigin');await cdp('Page.reload');await until(()=>evaluate(`performance.timeOrigin!==${before} && document.readyState==="complete"`));};
 const text=()=>evaluate('document.body.textContent');
 const primary=()=>evaluate('document.querySelector("[data-primary]").click()');
 const type=()=>evaluate('document.querySelector("[data-activity-type]")?.dataset.activityType');
 const state=()=>evaluate('document.querySelector("[data-activity-state]")?.dataset.activityState');
 const answer=()=>evaluate(`(()=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'My answer');el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('input[type=radio]').click();})()`);
 const choose=()=>evaluate('document.querySelector("input[type=radio]").click()');
 const ready=expected=>until(async()=>(await type())===expected&&!(await evaluate('document.querySelector("[data-primary]")?.textContent.includes("保存中")')));
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:5228/tests/fixtures/domain-lesson.html?lesson='+lesson.id});
 await ready('LEARN');assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');assert.equal((await query('attempts',activities[0].id)).length,0);
 // Help does not write an Attempt.
 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="わからない・AIに聞く").click()');await primary();await until(async()=>(await text()).includes('AI機能へのデータ送信'));assert.equal(await evaluate('lessonFixture.helpCalls'),0);
 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="今は許可しない").click()');await until(async()=>(await text()).includes('AIへの送信が許可されていない'));assert.equal(await evaluate('lessonFixture.helpCalls'),0);
 await primary();await until(async()=>(await text()).includes('同意して続ける'));await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="同意して続ける").click()');await until(async()=>(await text()).includes('Test provider explanation'));assert.equal(await evaluate('lessonFixture.helpCalls'),1);
 assert.equal((await text()).includes('学びに残す'),false);await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="閉じる").click()');assert.equal((await query('attempts',activities[0].id)).length,0);
 await evaluate('lessonFixture.helpDelay=500;Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="わからない・AIに聞く").click()');await primary();await until(()=>evaluate('lessonFixture.helpCalls===2'));await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="閉じる").click()');await delay(650);assert.equal((await text()).includes('Test provider explanation'),false);await evaluate('lessonFixture.helpDelay=0');
 // Lost response after commit: explicit retry retains the same durable operation.
 await evaluate('lessonFixture.lose=true');await primary();await until(async()=>(await text()).includes('保存状態を確認できません'));assert.equal((await query('attempts',activities[0].id)).length,1);await primary();await ready('RECALL');assert.equal((await query('attempts',activities[0].id)).length,1);
 await reload();await ready('RECALL');assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');
 await primary();await until(()=>evaluate('!!document.querySelector("input[type=radio]")'));await choose();await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="中断してホームへ").click()');await until(async()=>(await text()).includes('Test Home'));assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');await evaluate('lessonFixture.openLesson()');await ready('RECALL');assert.equal(await evaluate('document.querySelector("input[type=radio]").checked'),true);await evaluate('lessonFixture.slow=true;for(let i=0;i<12;i++)document.querySelector("[data-primary]").click()');await until(async()=>(await state())==='FEEDBACK');assert.equal((await query('attempts',activities[1].id)).length,1);
 await evaluate('lessonFixture.slow=false');await primary();await ready('CHOICE');await choose();await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await ready('EXPLAIN');
 await answer();await reload();await ready('EXPLAIN');assert.equal(await evaluate('document.querySelector("textarea").value'),'My answer');assert.equal(await evaluate('document.querySelector("input[type=radio]").checked'),true);await evaluate('lessonFixture.fail=true');await primary();await until(async()=>(await state())==='ERROR');assert.equal((await query('attempts',activities[3].id)).length,0);assert.equal((await text()).includes('private upstream'),false);
 await evaluate('lessonFixture.fail=false');await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await ready('APPLY');await answer();await primary();await until(async()=>(await state())==='FEEDBACK');await primary();await ready('LEARN');
 assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');assert.equal((await text()).includes('Lesson Complete'),false);
 await evaluate('lessonFixture.failComplete=true');await primary();await until(async()=>(await text()).includes('保存状態を確認できません'));assert.equal((await query('lesson',lesson.id)).status,'ACTIVE');assert.equal((await text()).includes('Lesson Complete'),false);
 await evaluate('lessonFixture.failComplete=false');await primary();await until(async()=>(await text()).includes('Lesson Complete'));assert.equal((await query('lesson',lesson.id)).status,'COMPLETED');
 await reload();await until(async()=>(await text()).includes('Lesson Complete'));assert.equal((await text()).includes('Streak'),false);
 await evaluate('lessonFixture.switchAccount("B")');await until(async()=>(await text()).includes('読み込めませんでした'));assert.equal((await text()).includes('Domain E2E Patch'),false);
 // Old account load response must not land after switching/logging out.
 await evaluate('lessonFixture.slow=true;lessonFixture.switchAccount("A")');await delay(100);await evaluate('lessonFixture.switchAccount("B")');await delay(1200);assert.equal((await text()).includes('Lesson Complete'),false);
 await evaluate('lessonFixture.switchAccount("A")');await delay(100);await evaluate('lessonFixture.logout()');await delay(1200);assert.equal((await text()).includes('Lesson Complete'),false);assert.ok((await text()).includes('ログインしてください'));assert.ok(await evaluate('lessonFixture.aborts')>0);
 assert.deepEqual(errors,[]);
 console.log('PASS: signed A -> real Patch/Objective/six Activities/Lesson -> durable Attempt -> progress -> server Complete -> UI; consent denial/grant and late Help cancellation; selected Lesson entry, pause/Home/reentry, draft restoration; no Help Attempt writes; lost-response retry, duplicate tap, API failure, reload/resume, B isolation, stale switch/logout, AbortSignal');
} finally {
 await fixtureServer?.close();ws?.close();for(const p of [chrome,server])if(p.exitCode===null){p.kill('SIGTERM');await Promise.race([new Promise(r=>p.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
