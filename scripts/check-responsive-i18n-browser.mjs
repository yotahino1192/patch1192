// Real UI components + isolated display fixtures; no API, auth bypass or production data.
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const dir=await mkdtemp(join(tmpdir(),'patch-ui-browser-'));
const output=process.env.UI_SCREENSHOT_DIR||join(process.cwd(),'outputs/responsive-i18n');
const port=5217,debugPort=9407;
let server,chrome,ws,startupError;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try{
 await mkdir(output,{recursive:true});
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(dir,'vite-cache'),plugins:[{name:'test-only-screen-exports',enforce:'pre',transform(code,id){if(id.endsWith('/app/page.tsx'))return code+'\nexport { Shell, Study, SetDetail, Records, ImportScreen, Generate };';}},react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{watch:{ignored:['**/.next/**','**/dist/**','**/ios/App/App/public/**','**/outputs/**']},host:'127.0.0.1',port,strictPort:true,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=async selector=>{await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.focus();element.click();})()`);await delay(100);};
 const screenshot=async name=>{await evaluate('document.fonts.ready');await evaluate('window.scrollTo(0,0)');await delay(120);const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(shot.data,'base64'));await writeFile(join(output,name+'.json'),JSON.stringify(await evaluate(`(()=>{const e=document.querySelector('.patch-complete,.patch-home,.library-page,.records-page,.import-page,.generation-page,.build-ready,.study-page');const c=getComputedStyle(e);return {className:e.className,scrollY,top:e.getBoundingClientRect().top,padding:c.padding,font:c.fontFamily,height:innerHeight,width:innerWidth,fonts:document.fonts.status};})()`),null,2));};
 const viewport=(width,height=852)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 await cdp('Runtime.enable');await cdp('Page.enable');
 const results=[],navigation=new Map();
 const open=async query=>{await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?${query}`});await until(()=>evaluate('!!document.querySelector("main > *")'));await evaluate('document.fonts.ready');await delay(100);};
 const metrics=()=>evaluate(`(()=>{const nav=document.querySelector('.bottom-nav'),r=nav?.getBoundingClientRect();return {width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,nav:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,body:getComputedStyle(document.body).backgroundColor,html:getComputedStyle(document.documentElement).backgroundColor,bodyFont:getComputedStyle(document.querySelector('main')).fontFamily,outside:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,12).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right})),headingFont:getComputedStyle(document.querySelector('main h1,main h2')||document.body).fontFamily};})()`);
 for(const language of ['en','ja']) for(const [width,height] of (process.env.PATCH_RESPONSIVE_QUICK?[[320,568],[375,812]]:[[320,568],[375,667],[375,812],[390,844],[430,932],[768,1024],[1024,768]])) {
  for(const query of ['screen=home','screen=home&state=empty','screen=sets','screen=records','screen=import','screen=import&step=2','screen=import&step=3','screen=import&step=3&whole','screen=import&step=3&topic','screen=import&step=review','screen=ready','screen=study']) {
   await viewport(width,height); await open(query+'&lang='+language);
   // CSS safe-area injection exercises layout reservations; native device QA remains required.
   await evaluate(`document.documentElement.style.setProperty('--safe-top','44px');document.documentElement.style.setProperty('--safe-bottom','34px')`);
   await delay(50);const normal=await metrics();results.push({query,language,...normal});
   assert.ok(normal.scrollWidth<=width,JSON.stringify(results.at(-1)));
   assert.equal(normal.body,'rgb(255, 255, 255)');assert.equal(normal.html,'rgb(255, 255, 255)');
   if(normal.nav){const key=[language,width,height].join(':');if(navigation.has(key))assert.deepEqual(normal.nav,navigation.get(key),'All main tabs use identical navigation geometry');else navigation.set(key,normal.nav);await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');const scrolled=await metrics();assert.deepEqual(scrolled.nav,normal.nav,'Navigation stays fixed while scrolling');}
   if(query==='screen=import')assert.ok((await evaluate(`getComputedStyle(document.querySelector('.build-destination-option strong')).fontFamily`)).includes(language==='ja'?'M PLUS Rounded 1c':'Nunito Sans'),'Destination emphasis uses the locale heading font');
   assert.ok(normal.bodyFont.startsWith(language==='ja'?'\"Noto Sans JP\"':'Inter'),'Locale selects body font');
   if(width===375&&height===812&&['screen=home','screen=home&state=empty','screen=import','screen=import&step=2','screen=import&step=3&whole','screen=import&step=3&topic'].includes(query))assert.ok(normal.documentHeight<=height,'Compact screen fits: '+JSON.stringify(results.at(-1)));
   if(width===375&&height===812) await screenshot(query.replaceAll('&','-').replaceAll('=','-')+'-'+language);
   // Text-only scaling, measured from the unscaled layout so descendants scale once.
   await evaluate(`window.baseText=[...document.querySelectorAll('.app-shell *')].filter(e=>!e.closest('svg')).map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);void 0;`);
   for(const scale of [1.5,2]) {
    await evaluate(`window.baseText.forEach(([e,size])=>e.style.fontSize=size*${scale}+'px')`);await delay(30);
    const enlarged=await metrics();if(enlarged.scrollWidth>width){await screenshot('overflow');console.log(await evaluate(`JSON.stringify([...document.querySelectorAll('html,body,.app-shell,main,.records-page,.chart-panel,.bar-chart,.record-stats,.reminder-list')].map(e=>({tag:e.tagName,cls:e.className,r:e.getBoundingClientRect().toJSON(),overflow:getComputedStyle(e).overflowX,scroll:e.scrollWidth,client:e.clientWidth})))`));}assert.ok(enlarged.scrollWidth<=width,'Text scaling fits width: '+JSON.stringify({query,language,scale,...enlarged}));
    await evaluate(`document.querySelector('main .build-primary,main .patch-lesson-start,main .record-choice,main .swipe-actions button')?.scrollIntoView({block:'center'})`);
    const reachable=await evaluate(`(()=>{const e=document.querySelector('main .build-primary,main .patch-lesson-start,main .record-choice,main .swipe-actions button');if(!e)return true;const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
    assert.ok(reachable,`Action reachable: ${query} ${language} ${width} ${scale}`);
   }
  }
 }
 for(const language of ['ja','en']) for(const step of ['2','3','review']) {
  await viewport(375,360);await open(`screen=import&step=${step}&lang=${language}`);
  await evaluate(`const input=document.querySelector('main textarea,main input:not([type=radio])');input.focus();input.scrollIntoView({block:'center'});`);
  assert.ok(await evaluate(`(()=>{const r=document.activeElement.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;})()`),'Focused input reachable in keyboard-sized viewport');
  assert.equal(await evaluate(`!!document.querySelector('.bottom-nav')`),false,'Focused subflows preserve hidden navigation');
  await evaluate(`document.querySelector('.build-primary').scrollIntoView({block:'center'})`);
  assert.ok(await evaluate(`(()=>{const e=document.querySelector('.build-primary'),r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`),'Keyboard-sized primary action reachable');
  await viewport(375,812);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 }
 await viewport(375,812);await open('screen=home&lang=en');
 await click('.settings-button');await click('.settings-language button:first-of-type');
 assert.equal(await evaluate('document.documentElement.lang'),'ja');
 assert.equal(await evaluate('document.querySelector(".bottom-nav button").textContent'),'ホーム');
 await click('.settings-language button:last-of-type');assert.equal(await evaluate('document.documentElement.lang'),'en');
 await writeFile(join(output,'layout-matrix.json'),JSON.stringify(results,null,2));
 console.log(`PASS: ${results.length} layouts; 100/150/200% text; stable shared navigation; compact fit; keyboard-sized inputs; locale switching. Results: ${output}`);
 assert.deepEqual(errors,[]);
}finally{ws?.close();if(chrome&&chrome.exitCode===null){const closed=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await closed;}await server?.close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
