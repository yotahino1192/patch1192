// Real UI components + isolated display fixtures; no API, auth bypass or production data.
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const dir=await mkdtemp(join(tmpdir(),'patch-ui-browser-'));
const output=process.env.UI_SCREENSHOT_DIR||join(process.cwd(),'outputs/ui-phase1');
const port=5207,debugPort=9397;
let server,chrome,ws,startupError;
// Test-only image responses exercise drop-in artwork without altering public files.
let mascotMode='current';const mascotRequests=[];
const finalMascotPaths=['/patch/mascot-standing.png','/patch/mascot-reading.png','/patch/mascot-celebrate.png','/patch/mascot-happy.png'];
const replacementPng=await readFile('public/home-landscape.png');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try{
 await mkdir(output,{recursive:true});
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(dir,'vite-cache'),plugins:[{name:'test-only-mascot-responses',configureServer(vite){vite.middlewares.use((req,res,next)=>{
  const path=req.url?.split('?')[0];
  if(!finalMascotPaths.includes(path)&&path!=='/loop-companion.jpeg')return next();
  mascotRequests.push(path);
  if(mascotMode==='replacement'&&finalMascotPaths.includes(path)){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end(replacementPng);return;}
  if(mascotMode==='missing-standing'&&(path===finalMascotPaths[0]||path==='/loop-companion.jpeg')){res.statusCode=404;res.end();return;}
  next();
 });}},{name:'test-only-screen-exports',enforce:'pre',transform(code,id){if(id.endsWith('/app/page.tsx'))return code+'\nexport { Shell, Study, SetDetail, Records, ImportScreen, Generate };';}},react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=async selector=>{await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.focus();element.click();})()`);await delay(100);};
 const screenshot=async name=>{await evaluate('document.fonts.ready');await evaluate('window.scrollTo(0,0)');await delay(120);const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(shot.data,'base64'));await writeFile(join(output,name+'.json'),JSON.stringify(await evaluate(`(()=>{const e=document.querySelector('.patch-complete,.patch-home,.library-page,.records-page,.import-page,.generation-page');const c=getComputedStyle(e);return {className:e.className,scrollY,top:e.getBoundingClientRect().top,padding:c.padding,font:c.fontFamily,height:innerHeight,width:innerWidth,fonts:document.fonts.status};})()`),null,2));};
 const viewport=(width,height=852)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 const navigate=async query=>{await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?${query}`});await until(()=>evaluate('!!document.querySelector(".patch-greeting,.patch-complete")'));await evaluate('document.fonts.ready');await until(()=>evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'));};
 await cdp('Runtime.enable');await cdp('Page.enable');
 // Main navigation visual consistency and the existing Sets actions.
 for(const screen of ['sets','records','import','generate']) {
  for(const width of [320,393,430,768]) {
   await viewport(width,width===320?568:852);
   await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?screen=${screen}&lang=ja&long=1`});
   await until(()=>evaluate('!!document.querySelector(".library-page,.records-page,.import-page,.generation-page")'));
   await screenshot(`${screen}-${width}`);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${screen}: ${width}px overflow`);
  }
 }
 await viewport(393);
 await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?screen=sets&lang=ja`});
 await until(()=>evaluate('!!document.querySelector(".library-set-open")'));
 await click('.folder-controls .secondary');
 assert.equal(await evaluate('!!document.querySelector("#folder-create-form")'),true);
 await screenshot('folder-form-393');
 await click('.folder-create .folder-text-button');
 await click('.library-sets .folder-text-button');
 await screenshot('move-set-393');
 await click('.folder-move button[type="button"]');
 await evaluate(`(()=>{const e=document.querySelector('#material-search-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'recall');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await until(()=>evaluate('!!document.querySelector(".search-hit-list")'));
 await screenshot('search-393');
 await click('.search-hit-list button');
 await until(()=>evaluate('!!document.querySelector(".set-hero")'));
 for(const width of [320,393,430,768]) {
  await viewport(width,width===320?568:852);await screenshot(`set-detail-${width}`);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`Set detail: ${width}px overflow`);
 }
 await viewport(393);
 await evaluate('document.querySelector(".topic-list button:last-child").scrollIntoView({block:"end"})');
 await evaluate('window.scrollTo(0,document.body.scrollHeight)');
 assert.equal(await evaluate('document.querySelector(".topic-list button:last-child").getBoundingClientRect().bottom <= document.querySelector(".bottom-nav").getBoundingClientRect().top'),true,'Last card stays reachable above navigation');
 const cardsShot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'set-detail-cards-393.png'),Buffer.from(cardsShot.data,'base64'));
 await click('.set-page > .primary.wide');
 assert.equal(await evaluate('window.uiFixture.lastStart[0]'),'s0','Set study still starts the selected set');
 await click('.topic-list button');
 assert.deepEqual(await evaluate('window.uiFixture.lastStart'),['s0','c0s0'],'Individual card action retains its set/card target');
 await click('.set-view-toolbar .secondary');await viewport(393);await screenshot('set-editor-393');
 await click('.bottom-nav button:nth-child(4)');
 assert.equal(await evaluate('!!document.querySelector(".records-page")'),true);
 await click('.settings-button');await screenshot('settings-393');await click('.settings-close');
 await click('.bottom-nav button:nth-child(3)');
 assert.equal(await evaluate('!!document.querySelector(".import-page")'),true);
 assert.equal(await evaluate('document.querySelector(".import-page > .primary").disabled'),true,'Empty material must still disable generation');
 await click('.bottom-nav button:nth-child(1)');
 assert.equal(await evaluate('!!document.querySelector(".patch-home")'),true);
 for(const state of ['empty','normal','hot','broken','completed','complete','stale']){
  await viewport(393);await navigate('state='+state);await screenshot(state+'-393');
  for(const width of [320,430,768]){await viewport(width,width===320?568:852);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${state}: ${width}px overflow`);if(width!==768)await screenshot(state+'-'+width);}
 }
 // History length and unusually long content must not hide or misroute the CTA.
 for(const query of ['state=normal&history=0','state=normal&history=1','state=normal&history=2','state=normal&long=1&lang=ja','state=normal&streak=1','state=hot&streak=123']) {
  for(const width of [320,393,430]) {
   await viewport(width,width===320?568:852);await navigate(query);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,query+' Home overflow');
   await screenshot('home-'+query.replaceAll('&','-').replaceAll('=','-')+'-'+width);
   await evaluate('document.querySelector(".patch-lesson-start").scrollIntoView({block:"center"})');
   assert.equal(await evaluate('document.querySelector(".patch-lesson-start").getBoundingClientRect().bottom < document.querySelector(".bottom-nav").getBoundingClientRect().top'),true,'Home CTA stays reachable above navigation');
   await click('.patch-lesson-start');await click('.patch-sheet .patch-primary');
   assert.equal(await evaluate('window.uiFixture.starts'),1,'Variable Home composition still starts the existing learning flow');
  }
 }
 for(const query of ['screen=sets&state=empty&lang=ja','screen=sets&lang=en&long=1','screen=records&lang=en','screen=import&lang=en']) {
  await viewport(320,568);
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?${query}`});
  await until(()=>evaluate('!!document.querySelector(".library-page,.records-page,.import-page")'));
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,query+' overflow');
  await screenshot(query.replaceAll('&','-').replaceAll('=','-'));
 }
 await viewport(393);await navigate('state=normal');
 assert.equal(await evaluate('document.querySelector(".patch-lesson-start").getBoundingClientRect().bottom < document.querySelector(".bottom-nav").getBoundingClientRect().top'),true,'Primary action is visible at 393 × 852 without scrolling');
 assert.equal(await evaluate('!!document.querySelector(".patch-current-node .patch-lesson-start")'),true,'Primary learning action belongs inside Today’s Lesson');
 assert.equal(await evaluate('document.querySelector(".patch-current-node h2").textContent'),'Learning through recall','Home displays the real selected set');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".patch-current-node")).backgroundColor'),'rgb(18, 86, 79)');
 await click('.patch-lesson-start');await until(()=>evaluate('document.querySelector(".patch-sheet").open'));
 assert.equal(await evaluate('window.uiFixture.starts'),0,'Opening preview must not start study');
 assert.equal(await evaluate('document.activeElement.className'),'patch-sheet-close');
 await screenshot('preview-393');
 await cdp('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await until(()=>evaluate('!document.querySelector(".patch-sheet").open'));
 assert.equal(await evaluate('document.body.style.overflow'),'');
 assert.equal(await evaluate('document.activeElement.className'),'patch-lesson-start','Escape restores trigger focus');
 await click('.patch-lesson-start');
 for(let i=0;i<5;i++){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await evaluate('document.activeElement===document.body||document.querySelector(".patch-sheet").contains(document.activeElement)'),true,'Tab never enters inert Home controls (browser chrome may receive focus)');}
 assert.equal(await evaluate('document.querySelector(".patch-sheet").getBoundingClientRect().bottom < document.querySelector(".bottom-nav").getBoundingClientRect().top'),true,'Sheet leaves dimmed navigation visible');
 await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:3,y:20,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:3,y:20,button:'left',clickCount:1});await until(()=>evaluate('!document.querySelector(".patch-sheet").open'));

 await click('.patch-lesson-start');await click('.patch-sheet-close');assert.equal(await evaluate('window.uiFixture.starts'),0);
 await click('.patch-lesson-start');await click('.patch-sheet .patch-primary');assert.equal(await evaluate('window.uiFixture.starts'),1);
 await viewport(320,568);await navigate('state=normal&long=1&lang=ja');await click('.patch-lesson-start');await screenshot('preview-ja-long-320');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 assert.equal(await evaluate('(()=>{const e=document.querySelector(".patch-sheet"),r=e.getBoundingClientRect();return r.top>=15&&r.bottom<=innerHeight-87;})()'),true,'Long mobile sheet stays within safe bounds');
 await evaluate('document.querySelector(".patch-sheet .patch-primary").scrollIntoView({block:"end"})');
 assert.equal(await evaluate('(()=>{const r=document.querySelector(".patch-sheet .patch-primary").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()'),true,'Long sheet Start remains reachable');
 const scrolledShot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'preview-ja-long-320-scrolled.png'),Buffer.from(scrolledShot.data,'base64'));
 await click('.patch-sheet .patch-primary');assert.equal(await evaluate('window.uiFixture.starts'),1);
 await viewport(393);await navigate('state=complete');await click('.completion-actions .patch-primary');
 await until(()=>evaluate('!!document.querySelector(".patch-home-completed .is-completed")'));await screenshot('post-lesson-home-393');
 assert.equal(await evaluate('document.querySelector(".patch-current-node").tagName'),'DIV','Today completion is a status, not another start button');
 await navigate('state=normal');await evaluate('window.uiFixture.updateSnapshot({streak:9,hot:true,completed:true,achievedDays:[18,19,20]})');
 await until(()=>evaluate('!!document.querySelector(".patch-streak-hot")'));
 assert.equal(await evaluate('document.querySelector(".patch-streak-count").textContent'),'9 days','Streak uses refreshed authoritative value');
 assert.equal(await evaluate('!!document.querySelector(".patch-home-completed")'),true);
 await evaluate('window.uiFixture.updateSnapshot({streak:0,hot:false,completed:false,broken:true})');await until(()=>evaluate('!!document.querySelector(".patch-streak-broken")'));
 assert.equal(await evaluate('document.querySelector(".patch-streak-count").textContent'),'0 days');
 await viewport(393);await navigate('state=resume');
 await click('.patch-lesson-start');await until(()=>evaluate('window.uiFixture.pending.length===1'));
 assert.equal(await evaluate("window.uiFixture.reads.find(r=>r.url.startsWith('/api/domain?')).method"),'GET');
 assert.ok((await evaluate("window.uiFixture.reads.find(r=>r.url.startsWith('/api/domain?')).url")).includes('id=saved-a'));
 await click('.patch-sheet-close');
 await click('.home-resume-list .patch-action-card:nth-child(2)');await until(()=>evaluate('window.uiFixture.pending.length===2'));
 await evaluate('window.uiFixture.pending[0]()');await delay(100);
 assert.equal(await evaluate('document.querySelector(".patch-preview-time")===null'),true,'Late prior-session estimate must be ignored');
 await evaluate('window.uiFixture.pending[1]()');await until(()=>evaluate('document.querySelector(".patch-preview-time")?.textContent.includes("8 minutes")'));
 assert.equal(await evaluate('document.querySelector(".patch-sheet").textContent.includes("6 cards remaining")'),true);
 await screenshot('resume-preview-393');
 assert.equal(await evaluate('window.uiFixture.starts'),0);
 assert.equal(await evaluate('window.uiFixture.reads.every(r=>r.method==="GET")'),true);
 // The same displayed boxes must survive a replacement PNG with a different
 // intrinsic aspect ratio. Check neighboring CTAs too, not only the image itself.
 await cdp('Network.enable');await cdp('Network.setCacheDisabled',{cacheDisabled:true});
 const layout=()=>evaluate(`Array.from(document.querySelectorAll('.patch-mascot,.patch-greeting,.patch-current-node,.patch-primary,.bottom-nav,.patch-results,.patch-complete>h1,.patch-sheet[open]')).map(e=>({name:e.className,rect:e.getBoundingClientRect().toJSON()})).filter(e=>e.rect.width&&e.rect.height)`);
 for(const [state,pose] of [['empty','standing'],['normal','reading'],['complete','celebrate']]){
  await viewport(393);mascotMode='current';await navigate('state='+state);const before=await layout();
  mascotMode='replacement';mascotRequests.length=0;await navigate('state='+state);
  assert.equal(await evaluate(`document.querySelector('.patch-mascot-${pose}').getAttribute('src')`),`/patch/mascot-${pose}.png`);
  assert.equal(await evaluate(`document.querySelector('.patch-mascot-${pose}').naturalWidth`),replacementPng.readUInt32BE(16),'Replacement PNG loaded');
  assert.equal(mascotRequests.includes('/loop-companion.jpeg'),false,'Valid final artwork never uses the fallback');
  assert.deepEqual(await layout(),before,`${pose}: new artwork must not move the UI`);
 }
 mascotMode='current';await navigate('state=normal');await click('.patch-lesson-start');const previewLayout=await layout();
 mascotMode='replacement';await navigate('state=normal');await click('.patch-lesson-start');assert.deepEqual(await layout(),previewLayout,'Preview stays stable with replacement artwork');
 // A missing final image must keep its canvas without resurrecting temporary art.
 mascotMode='missing-standing';mascotRequests.length=0;
 await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?state=empty`});
 await until(()=>evaluate('document.querySelector(".patch-mascot-standing")?.getAttribute("src")==="/patch/mascot-standing.png"&&document.querySelector(".patch-mascot-standing").complete'));
 await delay(150);
 assert.equal(mascotRequests.filter(p=>p==='/patch/mascot-standing.png').length,1);
 assert.equal(mascotRequests.filter(p=>p==='/loop-companion.jpeg').length,0,'No temporary mascot fallback');
 assert.equal(await evaluate('document.querySelector(".patch-mascot-standing").getBoundingClientRect().height'),264,'Missing artwork still reserves its canvas');
 mascotMode='current';
 assert.deepEqual(errors,[]);
 console.log('PASS: main tabs (Sets/search/folders/detail/editor, Records, Import/Generate, Settings), preserved set/card study targets, seven Home states, 320/393/430/768 widths, assets, read-only preview, focus containment/restore, backdrop/Escape/close/start, completion to Home, authoritative streak refresh, long Japanese name and scrollable preview, read-only saved estimate and stale response rejection, canonical mascot replacement with stable layout and no temporary fallback. Screenshots: '+output);
}finally{ws?.close();if(chrome&&chrome.exitCode===null){const closed=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await closed;}await server?.close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
