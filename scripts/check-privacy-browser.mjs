// Real React lifecycle/storage test, with a fake SDK and transport; no live Clerk keys or production DB.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const dir=await mkdtemp(join(tmpdir(),'patch-auth-browser-'));
const debugPort=Number(process.env.TEST_DEBUG_PORT||9356);
let server,chrome,ws,startupError;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try {
 server=await createServer({configFile:false,root:process.cwd(),plugins:[react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5196,strictPort:true}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tabs=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 const privateReady=user=>until(()=>evaluate(`document.querySelector('[data-private="user_${user}"]')?.textContent.includes('workspace ready')`));
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:5196/tests/fixtures/auth.html'});
 await until(()=>evaluate('!!window.fixture'));
 assert.equal(await evaluate('document.querySelector("[data-private]")'),null);
 await evaluate('fixture.change("A");fixture.ready()');await privateReady('A');
 const clickText=text=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)});if(!b)throw Error('missing button');b.click()})()`);
 const aiCount=()=>evaluate('fixture.calls.filter(c=>c.path.startsWith("/api/ai/")).length');
 await click('summary');await until(()=>evaluate('document.getElementById("result").textContent==="summary blocked"'));assert.equal(await aiCount(),0);
 assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),false);
 await click('generate');await until(()=>evaluate('!!document.querySelector("dialog[open]")'));assert.equal(await aiCount(),0);
 await clickText('今は許可しない');await until(()=>evaluate('document.getElementById("result").textContent==="AI blocked"'));assert.equal(await aiCount(),0);
 await click('generate');await until(()=>evaluate('!!document.querySelector("dialog[open]")'));await clickText('同意して続ける');await until(async()=>await aiCount()===1);
 await click('revoke');await until(()=>evaluate('fixture.calls.filter(c=>c.path==="/api/privacy/consents").length>=6'));
 await click('generate');await until(()=>evaluate('!!document.querySelector("dialog[open]")'));assert.equal(await aiCount(),1);
 // Switching while A's modal is pending must not authorize or send as B.
 await evaluate('fixture.change("B")');await privateReady('B');assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),false);assert.equal(await aiCount(),1);
 await click('generate');await until(()=>evaluate('!!document.querySelector("dialog[open]")'));await clickText('閉じる');assert.equal(await aiCount(),1);
 await click('edit');await evaluate('localStorage.setItem("patch:workspace:v2:"+fixture.accounts.A.userId,"A preserved");fixture.loseDeletionResponse=true');
 await click('delete');await clickText('本人確認コードを送る');await until(()=>evaluate('!!document.querySelector("input[autocomplete=one-time-code]")'));
 await evaluate('document.querySelector("input[autocomplete=one-time-code]").focus()');await cdp('Input.insertText',{text:'123456'});await clickText('確認する');await until(()=>evaluate('document.body.textContent.includes("本人確認を行いました")'));
 await clickText('アカウントを削除する');await until(()=>evaluate('fixture.deletedLogout===true'));
 assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:"+fixture.accounts.B.userId)'),null);
 assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:"+fixture.accounts.A.userId)'),'A preserved');
 assert.equal(await evaluate('localStorage.getItem("patch:privacy-stop:"+fixture.accounts.B.userId)'),null);
 assert.equal(await aiCount(),1);
 // Deletion detected on another device purges this account on the next protected call.
 await evaluate('fixture.deletedLogout=false;fixture.change("A")');await privateReady('A');await click('edit');
 await evaluate('fixture.remoteDeleted=true;localStorage.setItem("patch:workspace:v2:"+fixture.accounts.B.userId,"B preserved")');await click('request');await until(()=>evaluate('fixture.deletedLogout===true'));
 assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:"+fixture.accounts.A.userId)'),null);
 assert.equal(await evaluate('localStorage.getItem("patch:workspace:v2:"+fixture.accounts.B.userId)'),'B preserved');
 assert.deepEqual(errors,[]);
 console.log('PASS: automatic summary blocked, explicit consent, denied/granted/revoked, modal account switch, deletion reauth UX, lost response receipt, scoped cleanup and deletion logout');
} finally {
 ws?.close();await server?.close();if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
