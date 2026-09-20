// Real App, authenticated data/Retention routes and isolated SQLite.
// AI is disabled by default; PATCH_LIVE_AI_QA=1 opts into one development-only provider call.
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { migrate } from './infra/migrations.mjs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { headers, token } from '../tests/auth-fixture.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import nextEnv from '@next/env';
import { grantAi } from '../tests/ai-consent-fixture.mjs';
const dir=await mkdtemp(join(tmpdir(),'patch-review-browser-')),root=process.cwd(),origin='http://127.0.0.1:3162',port=5242,debugPort=9412;
// Explicit opt-in only: one provider dispatch in an isolated development ledger.
const liveAi = process.env.PATCH_LIVE_AI_QA === '1';
if(liveAi) { nextEnv.loadEnvConfig(root,true,{info(){},error(){}});assert.equal(process.env.PATCH_ENV,'development');assert.ok(process.env.OPENAI_API_KEY); }
const output=join(root,'outputs/add-material-review');await mkdir(output,{recursive:true});
const db=createClient({url:`file:${dir}/test.db`});await migrate(db);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3162','--hostname','127.0.0.1'],{cwd:root,env:{...process.env,PATCH_ENV:'development',TURSO_DATABASE_URL:`file:${dir}/test.db`,TURSO_AUTH_TOKEN:'',OPENAI_API_KEY:liveAi?process.env.OPENAI_API_KEY:'',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'',VERCEL:''},stdio:'ignore'});
const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
let ws,vite;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<600;i++){try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try{
 await until(async()=>(await fetch(origin)).ok);
 const identity=await(await fetch(origin+'/api/auth/session',{headers:headers('user_review')})).json();
 const auth=()=>headers('user_review',identity.userId,{'content-type':'application/json'});
 const data=async()=>await(await fetch(origin+'/api/data',{headers:auth()})).json();
 const original={title:'Existing Economics',category:'Test',summary:'',keyPoints:['Existing learning'],sourceContent:'Original source',cards:[{question:'Original question',answer:'Original answer',format:'qa',choices:[],difficulty:1}]};
 const seeded=await(await fetch(origin+'/api/data',{method:'POST',headers:auth(),body:JSON.stringify({action:'saveSet',material:original})})).json();
 assert.equal(seeded.data.profile.onboardingCompleted,true);
 vite=await createServer({configFile:false,root,cacheDir:join(dir,'cache'),plugins:[react(),{name:'review-test-identity',configureServer(s){s.middlewares.use('/__build_review_identity',(_req,res)=>{res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.end(JSON.stringify({identity,token:token('user_review',{exp:Math.floor(Date.now()/1000)+1200})}));});}}],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[root,realpathSync('node_modules')]},proxy:{'/api':{target:origin}}}});await vite.listen();
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(80);};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(80);};
 const shot=async name=>{await evaluate('document.fonts.ready');await until(()=>evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'));await evaluate('window.scrollTo({top:0,behavior:"instant"})');await delay(150);const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(output,name+'.png'),Buffer.from(r.data,'base64'));};
 const openReview=async(format='qa',focus=false,invalid=false)=>{const before=await evaluate('performance.timeOrigin');await evaluate(`reviewFixture.stage(${JSON.stringify(format)},${focus},${invalid})`);await cdp('Page.reload');await until(()=>evaluate(`performance.timeOrigin!==${before}&&!!document.querySelector('.patch-home')`));await click('.bottom-nav button:nth-child(3)');await until(()=>evaluate('!!document.querySelector(".build-review")'));};
 const saveWrites=()=>evaluate('reviewFixture.writes.filter(w=>["saveSet","addCardsToSet"].includes(w.body?.action))');
 const progress=async()=>{const d=await data();const retention={...d.retention};delete retention.generatedAt;delete retention.expiresAt;return {reviews:d.reviews,retention,counts:(await db.execute("SELECT (SELECT count(*) FROM attempts) AS attempts,(SELECT count(*) FROM review_logs) AS reviews")).rows[0]};};
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/build-review.html`});await until(()=>evaluate('!!document.querySelector(".patch-home")'));
 if(process.env.PATCH_CORE_ONLY !== '1') {
 await openReview();const before=await progress();
 await shot('prompt08-flashcard-390');
 assert.equal(await evaluate('!!document.querySelector(".build-preview-answer")'),false);
 await click('.build-reveal');assert.match(await evaluate('document.querySelector(".build-preview-answer").textContent'),/reducing spending/);
 await click('[aria-label="Next preview"]');assert.equal(await evaluate('!!document.querySelector(".build-preview-answer")'),false);
 assert.equal(await evaluate('document.querySelector(".build-preview-navigation span").textContent'),'2 of 2');
 await click('[aria-label="Previous preview"]');
 assert.equal(await evaluate('document.querySelectorAll(".build-outcomes button,.build-review-preferences button").length'),0);
 assert.deepEqual(await progress(),before,'Preview creates no Attempt, review, Retention or Streak writes');
 assert.equal((await saveWrites()).length,0);assert.equal(await evaluate('reviewFixture.aiCalls'),0);
 await fill('#build-patch-name','My edited Patch');
 const outcomeTop=await evaluate('document.querySelector(".build-outcomes").getBoundingClientRect().top+scrollY');
 await click('.dropdown-trigger');await shot('prompt11-dropdown-390');
 assert.equal(await evaluate('document.querySelector(".build-outcomes").getBoundingClientRect().top+scrollY'),outcomeTop,'Dropdown overlays content');
 assert.match(await evaluate('document.querySelector(".dropdown-options").textContent'),/Create a new Patch.*Existing Patches.*Existing Economics/);
 await click('.dropdown-options [role=option]:last-child');
 assert.equal(await evaluate('document.querySelector(".build-review .build-primary").textContent'),'Add to Patch');assert.equal(await evaluate('!!document.querySelector("#build-patch-name")'),false);
 await click('.dropdown-trigger');await click('.dropdown-options [role=option]:first-child');assert.equal(await evaluate('document.querySelector("#build-patch-name").value'),'My edited Patch');
 await click('.dropdown-trigger');await evaluate('document.querySelector(".dropdown-trigger").focus()');await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate('!!document.querySelector(".dropdown-options")'),false);
 await click('.build-back');assert.equal(await evaluate('reviewFixture.workspace().draft.title'),'My edited Patch');await click('.build-primary');await until(()=>evaluate('!!document.querySelector(".build-review")'));assert.equal(await evaluate('reviewFixture.aiCalls'),0);
 await evaluate('reviewFixture.failSave=true');await click('.build-review .build-primary');await until(()=>evaluate('!!document.querySelector(".build-review [role=alert]")'));assert.equal(await evaluate('!!document.querySelector(".build-ready")'),false);assert.equal((await data()).sets.length,1);
 await fill('#build-patch-name','Saved Economics');await evaluate('reviewFixture.failSave=false;reviewFixture.holdSave=true;reviewFixture.loseSave=true');
 await click('.build-review .build-primary');await until(()=>evaluate('!!reviewFixture.releaseSave'));await click('.build-review .build-primary');assert.equal((await saveWrites()).length,2,'Rapid repeated save is blocked');
 await evaluate('reviewFixture.holdSave=false;reviewFixture.releaseSave()');await until(()=>evaluate('document.querySelector(".build-review .build-primary")?.textContent==="Retry save"'));
 assert.equal((await data()).sets.length,2,'Commit succeeded before simulated response loss');assert.equal(await evaluate('!!document.querySelector(".build-ready")'),false);
 const operation=(await saveWrites()).at(-1).body.operationId;
 await cdp('Page.reload');await until(()=>evaluate('!!document.querySelector(".patch-home")'));await click('.bottom-nav button:nth-child(3)');await until(()=>evaluate('!!document.querySelector(".build-review")'));
 assert.equal(await evaluate('document.querySelector("#build-patch-name").value'),'Saved Economics');assert.equal(await evaluate('reviewFixture.workspace().pendingMaterialSave.operationId'),operation);
 await click('.build-review .build-primary');await until(()=>evaluate('!!document.querySelector(".build-ready")'));assert.equal((await data()).sets.length,2);assert.equal((await saveWrites()).at(-1).body.operationId,operation);
 assert.equal(await evaluate('reviewFixture.workspace().draft'),null);await shot('prompt10-ready-390');
 await click('.build-ready-home');await until(()=>evaluate('!!document.querySelector(".patch-home")'));await click('.bottom-nav button:nth-child(3)');assert.equal(await evaluate('reviewFixture.workspace().importDraft.text'),'');assert.equal(await evaluate('!!document.querySelector(".build-destinations")'),true);
 await openReview('multiple_choice',true);await shot('prompt08-choice-390');assert.equal(await evaluate('document.querySelectorAll(".build-preview-options li").length'),4);
 const choiceBefore=await progress();await click('.build-reveal');await click('[aria-label="Next preview"]');assert.deepEqual(await progress(),choiceBefore);
 assert.match(await evaluate('document.querySelector(".build-review-focus").textContent'),/How interest rates affect inflation/);
 await click('.dropdown-trigger');await evaluate(`Array.from(document.querySelectorAll('.dropdown-options [role=option]')).find(e=>e.textContent.includes('Existing Economics')).click()`);
 const oldCard=seeded.data.sets.find(s=>s.id===seeded.setId).cards[0];
 await click('.build-review .build-primary');await until(()=>evaluate('!!document.querySelector(".build-ready")'));
 assert.equal(await evaluate('document.querySelector(".build-ready h1").textContent'),'Your Patch is updated.');await shot('prompt10-updated-390');
 const appended=(await data()).sets.find(s=>s.id===seeded.setId);assert.equal(appended.title,original.title);assert.equal(appended.cards.length,3);assert.deepEqual(appended.cards.find(c=>c.id===oldCard.id),oldCard);
 await evaluate('reviewFixture.failStart=true');await click('.build-ready .build-primary');await until(()=>evaluate('!!document.querySelector(".build-ready [role=alert]")'));assert.equal(await evaluate('!!document.querySelector(".build-ready")'),true);
 await evaluate('reviewFixture.failStart=false');await click('.build-ready .build-primary');await until(()=>evaluate('!!document.querySelector(".study-page")'));
 const session=await evaluate('reviewFixture.workspace().session');assert.equal(session.queue.length,2);assert.ok(!session.queue.includes(oldCard.id));
 const start=await evaluate('reviewFixture.writes.filter(w=>w.url==="/api/retention"&&w.body?.action==="start").at(-1)');assert.deepEqual(start.body.cardIds,session.queue);
 assert.equal((await data()).reviews.length,0);assert.equal((await data()).retention.streak,0);
 for(const width of [320,390,430,768]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:844,deviceScaleFactor:1,mobile:true});await openReview('multiple_choice',true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('review-'+width);
  await evaluate('document.querySelector(".build-review .build-primary").scrollIntoView({block:"end"})');assert.equal(await evaluate('document.querySelector(".build-review .build-primary").getBoundingClientRect().bottom<=innerHeight'),true);
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await openReview();
 await evaluate('[...document.querySelectorAll(".build-review *,.build-header *")].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]).forEach(([e,size])=>{e.style.fontSize=size*1.5+"px"})');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('review-larger-text-390');
 await openReview();await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:450,deviceScaleFactor:1,mobile:true});await evaluate('document.querySelector("#build-patch-name").focus()');
 assert.equal(await evaluate('(()=>{const r=document.querySelector("#build-patch-name").getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})()'),true);
 await openReview('qa',false,true);assert.equal(await evaluate('document.querySelector(".build-review .build-primary").disabled'),true);assert.match(await evaluate('document.querySelector(".build-review [role=alert]").textContent'),/outcomes/);
 assert.equal(await evaluate('reviewFixture.aiCalls'),0);assert.deepEqual(errors,[]);
 // Free v1 uses the actual card session and real review/Retention routes.
 await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 for(const format of ['qa','multiple_choice']) {
  await openReview(format);await click('.build-review .build-primary');await until(()=>evaluate('!!document.querySelector(".build-ready")'));
  await click('.build-ready .build-primary');await until(()=>evaluate('!!document.querySelector(".study-page")'));
  assert.equal(await evaluate('!!document.querySelector(".card-ai-button,.inline-ai-panel,[data-activity-type]")'),false);
  const activeId=await evaluate('reviewFixture.workspace().session.id');
  for(const width of [320,390,393,430,768]) {
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:852,deviceScaleFactor:1,mobile:true});
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   await shot('free-'+format+'-'+width);
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
  const reviewsBefore=(await data()).reviews.length;
  if(format==='multiple_choice') {
   await click('.study-choice-grid button:nth-child(2)');
   await until(()=>evaluate('!!document.querySelector(".choice-feedback.is-incorrect")'));
   assert.equal(await evaluate('document.querySelectorAll(".study-choice-grid button").length'),4);
   assert.equal(await evaluate('document.querySelectorAll(".study-choice-grid button[aria-pressed=true]").length'),1);
   assert.equal((await data()).reviews.length,reviewsBefore,'Selecting and revealing feedback does not submit an Attempt');
   assert.equal(await evaluate('!!document.querySelector(".choice-feedback.is-incorrect")'),true);
   await shot('free-choice-selected-393');
   await click('.record-choice');await until(()=>evaluate('!reviewFixture.workspace().session.flipped'));
  } else {
   await click('.flashcard-tap');await shot('free-flashcard-answer-393');
   assert.equal((await data()).reviews.length,reviewsBefore,'Reveal does not record a review');
   await click('.edit-study-button');await until(()=>evaluate('!!document.querySelector(".study-card-editor")'));
   await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:450,deviceScaleFactor:1,mobile:true});
   await evaluate('document.querySelector(".study-card-editor textarea").focus();document.querySelector(".manager-actions").scrollIntoView({block:"end"})');
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('free-editor-keyboard');
   await click('.manager-actions .secondary');await until(()=>evaluate('!!document.querySelector(".study-page")'));
   await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
  }
  await evaluate('[...document.querySelectorAll(".study-page strong,.study-page button,.study-page small,.study-page h1")].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]).forEach(([e,size])=>e.style.fontSize=size*1.5+"px")');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await shot('free-'+format+'-larger-text');
  for(let i=0;i<6 && !await evaluate('!!document.querySelector(".session-complete")');i++) {
   const beforeQueue=await evaluate('JSON.stringify(reviewFixture.workspace().session.queue)');
   if(format==='qa') {
    if(!await evaluate('reviewFixture.workspace().session.flipped'))await click('.flashcard-tap');
    await until(()=>evaluate('!!document.querySelector(".swipe-actions .correct:not(:disabled)")'));
    await click('.swipe-actions .correct');
   }
   else {
    await until(()=>evaluate('!!document.querySelector(".study-choice-grid button:first-child:not(:disabled)")'));
    await click('.study-choice-grid button:first-child');
    await until(()=>evaluate('!!document.querySelector(".record-choice:not(:disabled)")'));
    await click('.record-choice');
   }
   await until(()=>evaluate(`JSON.stringify(reviewFixture.workspace().session.queue)!==${JSON.stringify(beforeQueue)} || !!document.querySelector('.session-complete')`));
  }
  assert.equal(await evaluate('!!document.querySelector(".session-complete")'),true,'Existing session reaches Complete');
  assert.equal(await evaluate('reviewFixture.workspace().session.id'),activeId);
  assert.equal(await evaluate('!!document.querySelector(".lesson-ai-recap,.inline-ai-panel")'),false);
  assert.ok((await data()).reviews.length>reviewsBefore);
  await shot('free-'+format+'-complete-393');
  await click('.completion-actions .patch-primary');await until(()=>evaluate('!!document.querySelector(".patch-home")'));
  assert.equal(await evaluate('!!document.querySelector(".available-lessons,[data-activity-type],.patch-startup")'),false);
  await click('.bottom-nav button:last-child');await until(()=>evaluate('!!document.querySelector(".records-page")'));
  assert.equal(await evaluate('!!document.querySelector(".ai-history-disclosure,.record-stat-memory")'),false);await shot('free-'+format+'-history-393');
 }
 assert.equal(await evaluate('reviewFixture.aiCalls'),0,'Free v1 study/completion never auto-calls AI');

 }
 // Topic, pasted source and uploaded PDF all use the integrated generation flow.
 // Only the provider transport is deterministic; persistence/assignment/grading are real.
 await grantAi(db,identity.userId);
 const sourceText='Plants use sunlight to convert water and carbon dioxide into sugars. Chlorophyll absorbs light and oxygen is released during photosynthesis.';
 const stream=`BT /F1 11 Tf 40 700 Td (${sourceText}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const pdfFile=join(dir,'Photosynthesis.pdf');await writeFile(pdfFile,pdf);
 for(const input of ['topic','text','pdf'])for(const format of ['qa','multiple_choice']) {
  await evaluate('reviewFixture.reset()');await cdp('Page.reload');await until(()=>evaluate('!!document.querySelector(".patch-home")'));
  await evaluate('reviewFixture.mockGeneration=true');
  await click('.bottom-nav button:nth-child(3)');await until(()=>evaluate('!!document.querySelector(".build-destinations")'));await click('.build-primary');
  if(input==='topic')await evaluate(`(()=>{const e=document.querySelector('[aria-label="Input type"]');e.value='topic';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  if(input==='pdf') {
   const dom=await cdp('DOM.getDocument');const {nodeId}=await cdp('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});await cdp('DOM.setFileInputFiles',{nodeId,files:[pdfFile]});
   await until(()=>evaluate('!!document.querySelector(".build-files") && !document.querySelector(".build-files").textContent.includes("Checking file")'));
   assert.equal(await evaluate('reviewFixture.workspace().importDraft.attachments[0]?.status'),'accepted',await evaluate('JSON.stringify(reviewFixture.workspace().importDraft.attachments[0])'));
  } else await evaluate(`(()=>{const e=document.querySelector('.build-text textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(input==='topic'?'Photosynthesis':sourceText)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await delay(80);assert.equal(await evaluate('document.querySelector(".build-primary").disabled'),false);
  await shot('core-input-'+input+'-'+format);await click('.build-primary');await click(format==='qa'?'.build-format label:first-child':'.build-format label:last-child');await click('.build-primary');
  await until(()=>evaluate('!!document.querySelector(".build-review")'));
  assert.equal(await evaluate('reviewFixture.aiCalls'),1);
  const generated=await evaluate('reviewFixture.writes.find(w=>w.url==="/api/ai/cards").body');assert.equal(generated.inputKind==='topic',input==='topic');
  if(input==='pdf')assert.match(generated.text,/Plants use sunlight/);
  await click('.build-review .build-primary');await until(()=>evaluate('!!document.querySelector(".build-ready")'));await click('.build-ready .build-primary');await until(()=>evaluate('!!document.querySelector(".study-page")'));
  const activeId=await evaluate('reviewFixture.workspace().session.id');
  for(let i=0;i<2;i++) {
   if(format==='qa'){await click('.flashcard-tap');await click('.swipe-actions .incorrect');}
   else {await click('.study-choice-grid button:nth-child(2)');await click('.record-choice');}
   await until(async()=>Number((await db.execute({sql:'SELECT count(*) n FROM review_logs WHERE session_id=? AND undone_at IS NULL',args:[activeId]})).rows[0].n)===i+1);
   if(i===0) {
    await until(()=>evaluate('reviewFixture.workspace().session.queue.length===1'));
    await cdp('Page.reload');await until(()=>evaluate('!!document.querySelector(".patch-home")'));
    assert.equal(await evaluate('reviewFixture.workspace().session.queue.length'),1);
    await click('.home-resume-list button');await click('dialog .patch-primary');await until(()=>evaluate('!!document.querySelector(".study-page")'));
    assert.equal(await evaluate('reviewFixture.workspace().session.id'),activeId);
   }
  }
  await until(()=>evaluate('!!document.querySelector(".session-complete")'));
  const saved=await data(),history=saved.studyHistory.find(h=>h.id===activeId);
  assert.equal(history.processed,2);assert.equal(history.status,'COMPLETED');assert.equal(saved.retention.streak,1);assert.ok(saved.retention.dueCount>=2);
  assert.equal(history.results.every(r=>r.rating==='again'),true,'All incorrect still completes');
  if(format==='multiple_choice')assert.equal(history.results.every(r=>r.response.selectedChoice==='Wind'&&!r.response.correct),true);
  assert.equal(await evaluate('reviewFixture.aiCalls'),0,'Reloaded Study makes no generation or grading AI call');
  await click('.completion-actions .patch-primary');await click('.bottom-nav button:last-child');await until(()=>evaluate('!!document.querySelector(".study-history")'));
  await click('.study-history details:first-child summary');await shot('core-history-'+input+'-'+format);
  await click('.study-history details:first-child button');await until(()=>evaluate('!document.querySelector(".records-page")'));
  assert.equal((await data()).studyHistory.find(h=>h.id===activeId).results.length,2);
 }
 console.log('PASS: topic/text/PDF x Flashcards/MCQ -> Generate (fixture provider) -> Review/Save/Ready -> wrong answers -> reload/resume -> Complete -> History/Review; short +1/day and Due preserved.');
 if(liveAi) {
  assert.equal((await db.execute('SELECT count(*) n FROM ai_requests')).rows[0].n,0);
  await grantAi(db,identity.userId);
  await click('.bottom-nav button:nth-child(3)');await until(()=>evaluate('!!document.querySelector(".build-destinations")'));
  await click('.build-primary');
  await evaluate(`(()=>{const e=document.querySelector('.build-text textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Plants use sunlight to convert water and carbon dioxide into sugars through photosynthesis. Chlorophyll absorbs light. Oxygen is released. Roots absorb water, while leaves take in carbon dioxide through small openings called stomata.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('.build-primary');await click('.build-format label:last-child');await click('.build-primary');
  await until(()=>evaluate('!!document.querySelector(".build-dots")'));await shot('live-preparing-393');
  await until(()=>evaluate('!!document.querySelector(".build-review,.build-preparing [role=alert]")'));
  const ledger=(await db.execute('SELECT state,input_tokens,output_tokens FROM ai_requests')).rows;
  console.log('Live generation ledger:',JSON.stringify(ledger));
  assert.equal(ledger.length,1,'Only one operation; never retry an unresolved call');assert.equal(ledger[0].state,'succeeded');
  assert.equal(await evaluate('!!document.querySelector(".build-review")'),true);await shot('live-review-393');
  await click('.build-review .build-primary');await until(()=>evaluate('!!document.querySelector(".build-ready")'));await shot('live-ready-393');
  assert.equal(await evaluate('reviewFixture.aiCalls'),1);console.log('PASS: one real provider generation -> Review -> durable Save -> Ready');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: real App Review/Ready; flashcard/choice previews without progress; Back; destination overlay; new save; append; double-submit; failure; lost response/reload/retry; real Retention lesson start on added cards only; mobile layouts.');
 console.log('PASS: Free v1 Flashcard/Choice -> feedback -> saved Complete -> Home/History; deferred features hidden; 320/390/393/430/768; text scale and keyboard.');
 console.log('Screenshots: '+output);
}finally{ws?.close();await vite?.close();server.kill('SIGTERM');chrome.kill('SIGTERM');db.close();await delay(250);if(liveAi)console.log('Live QA ledger retained for audit: '+dir);else await rm(dir,{recursive:true,force:true});}
