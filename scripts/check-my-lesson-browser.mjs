// Real React lifecycle/storage test, with a fake SDK and transport; no live Clerk keys or production DB.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const dir=await mkdtemp(join(tmpdir(),'patch-my-lesson-browser-'));
const debugPort=Number(process.env.TEST_DEBUG_PORT||9397);
let server,chrome,ws,startupError;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try {
 server=await createServer({configFile:false,root:process.cwd(),plugins:[react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:5218,strictPort:true}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};

 await cdp('Runtime.enable');await cdp('Page.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:'http://127.0.0.1:5218/tests/fixtures/my-lesson.html'});
 const text=()=>evaluate('document.body.textContent');
 const primary=()=>evaluate('document.querySelector("[data-primary]").click()');
 const type=()=>evaluate('document.querySelector("[data-activity-type]")?.dataset.activityType');
 const state=()=>evaluate('document.querySelector("[data-activity-state]")?.dataset.activityState');
 const button=label=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
 const answer=async value=>evaluate(`(()=>{const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const choose=()=>evaluate('document.querySelector("input[type=radio]").click()');
 const unique=async()=>assert.equal(await evaluate('document.querySelectorAll("[data-primary]").length'),1);
 await until(()=>evaluate('!!window.fixture'));
 // Failed load is sanitized and retry/empty are normal states.
 await evaluate('fixture.loadFail=true');await primary();await until(async()=>(await text()).includes('読み込めませんでした'));
 assert.equal((await text()).includes('raw secret'),false);
 await evaluate('fixture.loadFail=false');await primary();await until(async()=>(await type())==='LEARN');
 await unique();assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await cdp('Page.bringToFront');
 const shot=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true});await writeFile('/private/tmp/patch-my-lesson-mobile.png',Buffer.from(shot.data,'base64'));
 await button('わからない・AIに聞く');await until(()=>evaluate('!!document.querySelector("dialog[open]")'));await unique();
 await evaluate('fixture.slow=true');await evaluate('for(let i=0;i<10;i++)document.querySelector("[data-primary]").click()');
 await until(async()=>(await text()).includes('プレビューの説明'));assert.equal(await evaluate('fixture.helpCalls'),1);
 await answer('別の例は？');await primary();await until(()=>evaluate('fixture.helpCalls===2 && !document.querySelector("[data-primary]").disabled'));
 await evaluate('for(let i=0;i<10;i++)Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="学びに残す").click()');
 await until(async()=>(await text()).includes('次のLessonに反映します ✓'));assert.equal(await evaluate('fixture.captures'),1);assert.equal((await text()).includes('カードを追加'),false);
 await delay(1100);assert.ok(await evaluate('fixture.budget.elapsedSeconds')>=1);
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until(()=>evaluate('!document.querySelector("dialog[open]")'));assert.equal(await type(),'LEARN');
 assert.equal(await evaluate('document.activeElement.textContent'),'わからない・AIに聞く');
 await primary();await until(async()=>(await type())==='RECALL');await unique();
 await primary();await until(async()=>(await state())==='ANSWERING');await choose();await primary();await until(async()=>(await state())==='FEEDBACK');await primary();
 await until(async()=>(await type())==='CHOICE');assert.equal(await evaluate('document.querySelector("[data-primary]").disabled'),true);await choose();
 const before=await evaluate('fixture.calls');await evaluate('for(let i=0;i<12;i++)document.querySelector("[data-primary]").click()');await until(async()=>(await state())==='FEEDBACK');assert.equal(await evaluate('fixture.calls'),before+1);
 await primary();await until(async()=>(await type())==='EXPLAIN');await answer('自分の言葉で思い出す');
 await button('わからない・AIに聞く');await button('閉じる');assert.equal(await evaluate('document.querySelector("textarea").value'),'自分の言葉で思い出す');
 await evaluate('fixture.fail=true');await primary();await until(async()=>(await state())==='ERROR');assert.equal((await text()).includes('raw secret'),false);assert.equal(await evaluate('document.querySelector("textarea").value'),'自分の言葉で思い出す');
 await evaluate('fixture.fail=false');await primary();await until(async()=>(await state())==='FEEDBACK');assert.equal(await evaluate('fixture.operations.at(-1)===fixture.operations.at(-2)'),true);
 await primary();await until(async()=>(await type())==='APPLY');await answer('明日は何も見ずに単語を説明する');await primary();await until(async()=>(await state())==='FEEDBACK');await primary();
 await until(async()=>(await type())==='LEARN');assert.equal((await text()).includes('Lesson Complete'),false);assert.equal(await evaluate('fixture.budget.estimatedSeconds'),30);
 await primary();await until(async()=>(await text()).includes('Lesson Complete'));await unique();assert.ok((await text()).includes('Streak：3日'));
 const duration=await evaluate('fixture.budget.elapsedSeconds');await delay(1100);assert.equal(await evaluate('fixture.budget.elapsedSeconds'),duration);
 await primary();await until(async()=>(await text()).includes("Today's My Lesson"));
 await evaluate('fixture.start(true)');await until(async()=>(await text()).includes('今日は学ぶものがありません'));assert.equal(await evaluate('!!document.querySelector("[role=alert]")'),false);await unique();await primary();
 // Delayed old-scope result cannot land in a new session.
 await evaluate('fixture.start(false)');await until(async()=>(await type())==='LEARN');await primary();await until(async()=>(await type())==='RECALL');await primary();await choose();await primary();
 await evaluate('fixture.scope("account-B")');await until(async()=>(await type())==='LEARN');await delay(600);assert.equal(await state(),'READY');assert.equal((await text()).includes('自分の理解を確認できました'),false);
 // Burst next cannot skip an activity; zero remaining does not force completion (covered by state test too).
 await evaluate('for(let i=0;i<10;i++)document.querySelector("[data-primary]").click()');await until(async()=>(await type())==='RECALL');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: five renderers, six-activity full completion, Help/follow-up/capture, focus return, time budget, empty/loading/error, answer retention, duplicate submit/next, stable retry operation, stale scope response, 375px/1280px');
} finally {
 ws?.close();await server?.close();if(chrome&&chrome.exitCode===null){chrome.kill('SIGTERM');await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
