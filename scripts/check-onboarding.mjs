// Run after npm run build. Uses an isolated browser profile and temporary database.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=process.cwd(), dir=await mkdtemp(join(tmpdir(),'patch-onboarding-browser-'));
const chromePath=process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const appPort=Number(process.env.TEST_APP_PORT || 3138), debugPort=Number(process.env.TEST_DEBUG_PORT || 9344);
const origin=`http://127.0.0.1:${appPort}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(appPort),'--hostname','127.0.0.1'],{cwd:root,env:{...process.env,TURSO_DATABASE_URL:`file:${dir}/test.db`,TURSO_AUTH_TOKEN:'',OPENAI_API_KEY:'',VERCEL:''},stdio:'ignore'});
const chrome=spawn(chromePath,['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
let startupError;server.on('error',e=>startupError=e);chrome.on('error',e=>startupError=e);
let ws;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw new Error('Timed out: '+fn);}
try {
 await until(async()=> (await fetch(origin)).ok);
 await until(async()=> (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const target=await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(new Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const waitText=text=>until(()=>evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`));
 const clickText=async text=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw Error('Button unavailable: '+${JSON.stringify(text)});b.click()})()`);await delay(100);};
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(100);};
 const data=async()=>await (await fetch(origin+'/api/data')).json();
 const noOverflow=async()=>assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
 const responsive=async(name)=>{for(const width of [320,768,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await noOverflow();}if(process.env.ONBOARDING_SCREENSHOT){const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(process.env.ONBOARDING_SCREENSHOT.replace('.png',`-${name}.png`),Buffer.from(shot.data,'base64'));}};
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:origin});await waitText('なんとお呼びすればいいですか？');
 await evaluate("document.querySelector('input').focus()");await cdp('Input.insertText',{text:'テストさん'});await until(()=>evaluate("!document.querySelector('form button').disabled"));await clickText('次へ');await waitText('何に興味がありますか？');
 assert.equal(await evaluate("document.querySelector('.onboarding-footer button').disabled"),true);
 await clickText('生成AI');await clickText('ChatGPT');
 assert.equal(await evaluate("document.querySelector('.onboarding-footer button').disabled"),true);
 await clickText('AIエージェント');assert.equal(await evaluate("document.querySelector('.onboarding-footer button').disabled"),false);
 assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='投資').disabled"),true);
 await clickText('ChatGPT');await clickText('ChatGPT');await responsive('interests');
 await clickText('次へ');await waitText('どんな目的で学びたいですか？');await clickText('仕事で使いたい');await clickText('次へ');await waitText('あなたに合いそうな3つを選びました');
 assert.equal(await evaluate("new Set([...document.querySelectorAll('.onboarding-preset strong')].map(e=>e.textContent)).size"),3);await responsive('recommendations');
 await evaluate(`{const original=window.fetch;let lose=true;window.fetch=async(...args)=>{const result=await original(...args);if(lose&&args[1]?.body?.includes('"step":"select"')){lose=false;throw new Error('接続が切れました');}return result;};}`);
 await click('.onboarding-preset');await waitText('接続が切れました');await click('.onboarding-preset');await waitText('まず3枚やってみる');assert.equal((await data()).sets.length,1);
 await cdp('Page.reload');await waitText('まず3枚やってみる');await clickText('まず3枚やってみる');await waitText('答えを見る');
 assert.equal(await evaluate("document.body.innerText.includes('このカードを修正')"),false);
 await clickText('答えを見る');await clickText('まだ覚えていない');await until(async()=> (await data()).reviews.length===1);
 // Reload mid-session, deleting browser workspace: DB progress must still resume.
 await evaluate('localStorage.removeItem("loop-workspace-v1")');await cdp('Page.reload');await waitText('まず3枚やってみる');await clickText('まず3枚やってみる');await waitText('2 / 3');await responsive('study');
 for(let i=0;i<2;i++){await waitText('答えを見る');await clickText('答えを見る');await clickText('覚えていた');if(i===0)await waitText('3 / 3');}
 await waitText('最初の学習、完了！');assert.equal((await data()).dailyReview.streak,1);assert.equal((await data()).reviews.length,3);await noOverflow();
 await responsive('complete');
 if(process.env.ONBOARDING_SCREENSHOT){const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(process.env.ONBOARDING_SCREENSHOT,Buffer.from(shot.data,'base64'));}
 await clickText('ホームへ');await waitText('連続学習');assert.equal((await data()).profile.onboardingCompleted,true);
 await cdp('Page.reload');await waitText('連続学習');assert.equal(await evaluate("document.body.innerText.includes('なんとお呼びすればいいですか？')"),false);await noOverflow();
 assert.deepEqual(errors,[]);console.log('PASS: first run, validation, recommendations, lost-save response, DB resume, 3 cards, Day 1, home, reload, responsive widths');
} finally {
 ws?.close();for(const child of [server,chrome])if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);}
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
