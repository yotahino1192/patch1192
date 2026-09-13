// Run after npm run build. No auth, database preparation or external API requests.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'patch-public-browser-')),port=Number(process.env.PUBLIC_TEST_PORT||3216),debugPort=Number(process.env.PUBLIC_DEBUG_PORT||9380),origin=`http://127.0.0.1:${port}`;
const env={...process.env,PATCH_ENV:'development',OPENAI_API_KEY:'',CLERK_SECRET_KEY:'',CLERK_JWT_KEY:'',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'',TURSO_DATABASE_URL:'file:'+join(dir,'must-not-exist.db'),VERCEL:''};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port),'--hostname','127.0.0.1'],{env,stdio:'ignore'});
const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
let startupError,ws,embedded;server.on('error',e=>startupError=e);chrome.on('error',e=>startupError=e);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let n=0;n<200;n++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Public page readiness timeout');}
try{
 await until(async()=> (await fetch(origin+'/privacy')).ok);
 for(const kind of ['privacy','terms','support']){const response=await fetch(origin+'/'+kind,{redirect:'manual'});assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('<h1'));assert.match(html,/<meta name="robots" content="noindex, nofollow"/);assert.ok(html.includes('未確定'));assert.ok(!html.includes('NEXT_REDIRECT'));}
 await until(async()=> (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),requests=[],exceptions=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await cdp('Network.enable');await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.bringToFront');
 for(const kind of ['privacy','terms','support']){
  await cdp('Page.navigate',{url:origin+'/'+kind});await until(()=>evaluate(`document.querySelector('nav a[aria-current="page"]')?.getAttribute('href')==='/${kind}'`));
  for(const width of [320,768,1280]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,kind+' '+width);
   assert.equal(await evaluate('document.querySelectorAll("h1").length'),1);assert.equal(await evaluate('document.querySelectorAll("main").length'),1);
   assert.equal(await evaluate(`Array.from(document.querySelectorAll('a[href^="#"]')).every(a=>document.getElementById(a.hash.slice(1)))`),true);
   const image=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile(`/private/tmp/patch-public-${kind}-${width}.png`,Buffer.from(image.data,'base64'));
  }
 }
 await cdp('Page.navigate',{url:origin+'/support'});await until(()=>evaluate('document.title.includes("サポート")'));
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await evaluate('document.activeElement.textContent'),'本文へスキップ');assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'),'solid');
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await until(()=>evaluate('document.activeElement.id==="public-main"'));
 await cdp('Emulation.setScriptExecutionDisabled',{value:true});await cdp('Page.navigate',{url:origin+'/privacy'});await delay(500);
 const doc=await cdp('DOM.getDocument');const html=await cdp('DOM.getOuterHTML',{nodeId:doc.root.nodeId});assert.ok(html.outerHTML.includes('privacy-deletion'));assert.ok(html.outerHTML.includes('アカウント削除'));
 assert.ok(!requests.some(url=>/\/api\/|clerk\.accounts|api\.openai/.test(url)));assert.deepEqual(exceptions,[]);
 const {access}=await import('node:fs/promises');await assert.rejects(access(join(dir,'must-not-exist.db')));
 console.log('PASS: anonymous HTTP 200, noindex, headings/anchors, 320/768/1280 reflow, keyboard skip/focus, no-JS content, no auth/API/DB access');

 await cdp('Emulation.setScriptExecutionDisabled',{value:false});
 const {createServer}=await import('vite');const {default:react}=await import('@vitejs/plugin-react');
 embedded=await createServer({configFile:false,root:process.cwd(),plugins:[react()],server:{host:'127.0.0.1',port:5198,strictPort:true}});
 await embedded.listen();
 const embeddedURL='http://127.0.0.1:5198/tests/fixtures/public-legal.html';
 await cdp('Page.navigate',{url:embeddedURL});
 await until(()=>evaluate('document.querySelector("#root .legal-content h2")?.textContent.includes("プライバシー")'));
 await evaluate('Array.from(document.querySelectorAll("#root .legal-content button")).find(b=>b.textContent.includes("通知・Widgetの使い方")).click()');
 await until(()=>evaluate('document.querySelector("#root .legal-content h2")?.textContent==="サポート"'));
 assert.equal(await evaluate('document.activeElement.textContent'),'Notification / Widget — 通知とホーム画面');
 assert.equal(await evaluate('location.href'),embeddedURL);
 await evaluate('Array.from(document.querySelectorAll("#root .legal-content button")).find(b=>b.textContent.includes("通知・Widgetが扱うデータ")).click()');
 await until(()=>evaluate('document.querySelector("#root .legal-content h2")?.textContent==="プライバシーポリシー"'));
 assert.equal(await evaluate('document.activeElement.textContent'),'Local Notification / Widget');
 assert.equal(await evaluate('location.href'),embeddedURL);
 assert.equal(await evaluate('new Set(Array.from(document.querySelectorAll("[id]"),e=>e.id)).size===document.querySelectorAll("[id]").length'),true);
 assert.ok(!requests.some(url=>/\/api\/|clerk\.accounts|api\.openai/.test(url)));assert.deepEqual(exceptions,[]);
 console.log('PASS: embedded legal navigation stays inside React, focuses the destination heading, and has unique anchors');
}finally{await embedded?.close();ws?.close();chrome.kill('SIGTERM');server.kill('SIGTERM');await delay(350);await rm(dir,{recursive:true,force:true});}
