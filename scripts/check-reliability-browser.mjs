// Real React lifecycle/storage test, with a fake SDK and transport; no live Clerk keys or production DB.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const dir=await mkdtemp(join(tmpdir(),'patch-reliability-browser-'));
const debugPort=Number(process.env.TEST_DEBUG_PORT||9384);
let server,chrome,ws,startupError;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try {
 server=await createServer({configFile:false,root:process.cwd(),plugins:[react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5199,strictPort:true}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:5199/tests/fixtures/reliability.html?offline=1'});
 await until(()=>evaluate('document.body.textContent.includes("アカウントを読み込めません")'));
 assert.equal(await evaluate('document.querySelector("[data-private]")'),null);
 assert.equal(await evaluate('fixture.calls'),0);
 await evaluate('Object.defineProperty(navigator,"onLine",{configurable:true,value:true});window.dispatchEvent(new Event("online"));Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="再試行").click()');
 await until(()=>evaluate('fixture.calls>0 && document.body.textContent.includes("アカウントを読み込めません")'));
 assert.equal(await evaluate('document.body.textContent.includes("secret@example.com")'),false);
 await evaluate('fixture.down=false;Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="再試行").click()');
 await until(()=>evaluate('document.body.textContent.includes("workspace ready")'));await click('load');await until(()=>evaluate('document.getElementById("card").textContent==="saved card"'));await click('edit');
 // Current data and account-scoped draft survive a network failure; no automatic replay on reconnect.
 await evaluate('fixture.down=true');await click('load');await until(()=>evaluate('document.getElementById("error").textContent.length>0'));
 assert.equal(await evaluate('document.getElementById("card").textContent'),'saved card');assert.equal(await evaluate('document.getElementById("draft").textContent'),'unsaved study');
 await evaluate('Object.defineProperty(navigator,"onLine",{configurable:true,value:false});window.dispatchEvent(new Event("offline"))');
 await until(()=>evaluate('document.body.textContent.includes("オフライン")'));const before=await evaluate('fixture.calls');await click('load');await delay(50);assert.equal(await evaluate('fixture.calls'),before);
 await evaluate('Object.defineProperty(navigator,"onLine",{configurable:true,value:true});fixture.down=false;window.dispatchEvent(new Event("online"));document.dispatchEvent(new Event("visibilitychange"))');await delay(50);assert.equal(await evaluate('fixture.calls'),before);
 await evaluate('fixture.status=429');await click('load');await until(()=>evaluate('document.getElementById("error").textContent.includes("利用制限")'));assert.equal(await evaluate('document.getElementById("card").textContent'),'saved card');
 await evaluate('fixture.status=200;fixture.slow=true');const count=await evaluate('fixture.calls');await evaluate('for(let i=0;i<15;i++)document.getElementById("load").click()');await delay(300);assert.equal(await evaluate('fixture.calls'),count+1);
 await click('crash');await until(()=>evaluate('document.body.textContent.includes("Patchを表示できませんでした")'));assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:10000000-0000-4000-8000-000000000001").includes("unsaved study")'),true);
 await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="再試行").click()');await until(()=>evaluate('document.body.textContent.includes("workspace ready")'));assert.equal(await evaluate('document.getElementById("draft").textContent'),'unsaved study');
 await click('failed-recovery');await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="再読み込み").click()');await until(()=>evaluate('document.body.textContent.includes("復旧できませんでした")'));await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="再試行").click()');await until(()=>evaluate('document.body.textContent.includes("復旧できませんでした")'));assert.equal(await evaluate('document.body.textContent.includes("raw secret")'),false);
 await evaluate('fixture.failRetry=false;Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="再試行").click()');await until(()=>evaluate('document.body.textContent.includes("workspace ready")'));
 console.log('PASS: offline startup, API-down startup, offline study, reconnect without replay, 429, retry burst, fatal fallback, failed recovery, normal recovery, draft preservation');

} finally {
 ws?.close();await server?.close();if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
