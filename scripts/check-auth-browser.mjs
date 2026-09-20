// Real React lifecycle/storage test, with a fake SDK and transport; no live Clerk keys or production DB.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const dir=await mkdtemp(join(tmpdir(),'patch-auth-browser-'));
const debugPort=Number(process.env.TEST_DEBUG_PORT||9356);
let server,chrome,ws,startupError;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try {
 server=await createServer({configFile:false,root:process.cwd(),plugins:[react(),{name:'startup-document-fixture',configureServer(vite){vite.middlewares.use('/__startup_document',async(_req,res)=>{const html=(await readFile('mobile/index.html','utf8')).replace(/<script type="module"[^>]*><\/script>/,'');res.setHeader('Content-Type','text/html');res.end(html);});}}],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 const ready=async()=>{await until(()=>evaluate('!!window.fixture'));await evaluate('window.fixture.ready()');};
 const privateReady=user=>until(()=>evaluate(`document.querySelector('[data-private="user_${user}"]')?.textContent.includes('workspace ready')`));
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:5196/tests/fixtures/auth.html'});
 await until(()=>evaluate('!!window.fixture'));
 assert.equal(await evaluate('document.querySelector("[data-private]")'),null);
 await until(()=>evaluate('!!document.querySelector(".patch-startup")'));
 await mkdir('outputs/startup',{recursive:true});
 for(const [width,height] of [[320,568],[393,852],[430,932],[852,393]]) {
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await evaluate('document.fonts.ready');await until(()=>evaluate('document.querySelector(".patch-startup img").naturalWidth>0'));
  assert.equal(await evaluate('innerWidth'),width,'Fixture uses the actual mobile viewport');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".patch-startup")).backgroundColor'),'rgb(18, 86, 79)');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.equal(await evaluate('document.querySelector(".patch-startup").textContent.trim()'),'Patch');
  assert.equal(await evaluate('!!document.querySelector(".patch-startup button,.bottom-nav")'),false);
  const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(`outputs/startup/splash-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});
 await evaluate('fixture.change("A");fixture.ready()');await privateReady('A');
 assert.equal(await evaluate('!!document.querySelector(".patch-startup")'),false);
 await evaluate(`window.splashReturns=0;new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches('.patch-startup')||n.querySelector('.patch-startup')))window.splashReturns++;}).observe(document.getElementById('root'),{childList:true,subtree:true});`);
 await evaluate('document.dispatchEvent(new Event("visibilitychange"))');
 assert.equal(await evaluate('window.splashReturns'),0,'Foreground refresh never restores splash');
 await click('edit');assert.equal(await evaluate('document.getElementById("draft").textContent'),'draft user_A');
 await evaluate('delete window.fixture');await cdp('Page.reload');await until(()=>evaluate('!!window.fixture'));
 assert.equal(await evaluate('document.querySelector("[data-private]")'),null);await ready();await privateReady('A');
 assert.equal(await evaluate('document.getElementById("draft").textContent'),'draft user_A');
 // A response is deliberately delivered after B has mounted.
 await evaluate('fixture.hold=true');await click('request');await until(()=>evaluate('fixture.calls.some(c=>c.path==="/api/data")'));
 await evaluate(`window.splashReturns=0;new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches('.patch-startup')||n.querySelector('.patch-startup')))window.splashReturns++;}).observe(document.getElementById('root'),{childList:true,subtree:true});`);
 await evaluate('fixture.change("B")');await privateReady('B');assert.equal(await evaluate('window.splashReturns'),0,'Account switch after startup never restores splash');await evaluate('fixture.release()');await delay(100);
 assert.equal(await evaluate('document.getElementById("draft").textContent'),'');assert.equal(await evaluate('document.getElementById("result").textContent'),'');
 assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:"+fixture.accounts.A.userId)'),null);
 await click('edit');await click('logout');await until(()=>evaluate('!document.querySelector("[data-private]")'));
 assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:"+fixture.accounts.B.userId)'),null);
 await evaluate('delete window.fixture');await cdp('Page.reload');await ready();await until(()=>evaluate('document.body.textContent.includes("メールアドレス")'));
 assert.equal(await evaluate('document.querySelector("[data-private]")'),null);
 assert.equal(await evaluate('!!document.querySelector(".patch-startup")'),false,'Signed-out first screen ends startup');
 // An interrupted/offline logout locks immediately and survives a process reload.
 await evaluate('fixture.change("A")');await privateReady('A');await click('edit');await evaluate('fixture.failLogout=true');await click('logout');
 await until(()=>evaluate('document.body.textContent.includes("ロックされています")'));
 assert.equal(await evaluate('localStorage.getItem("patch:logout:sess_A")'),'pending');
 await evaluate('delete window.fixture');await cdp('Page.reload');await ready();await until(()=>evaluate('document.body.textContent.includes("メールアドレス")'));
 assert.equal(await evaluate('fixture.calls.some(c=>c.path==="/api/auth/session")'),false);
 // A stalled initial mobile bundle retains a recoverable error state.
 await cdp('Page.navigate',{url:'http://127.0.0.1:5196/__startup_document'});
 await until(()=>evaluate('!!document.querySelector("#patch-startup-document")'));
 assert.equal(await evaluate('document.querySelector("#patch-startup-recovery").hidden'),true);
 await until(()=>evaluate('document.querySelector(".patch-startup img").naturalWidth>0'));
 const initialShot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile('outputs/startup/mobile-document.png',Buffer.from(initialShot.data,'base64'));
 await delay(15500);
 assert.equal(await evaluate('!!document.querySelector(".patch-startup")'),false,'Failed bundle cannot leave an endless splash');
 assert.equal(await evaluate('document.querySelector("#patch-startup-recovery").hidden'),false);
 assert.equal(await evaluate('!!document.querySelector("#patch-startup-recovery button")'),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: auth gate, StrictMode, scoped hydration, SDK session reload, account switch, stale native response, logout, interrupted logout/reload');
} finally {
 ws?.close();await server?.close();if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
