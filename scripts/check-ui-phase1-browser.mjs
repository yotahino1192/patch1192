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
const output=process.env.UI_SCREENSHOT_DIR||join(process.cwd(),'outputs/ui-phase1');
const port=5207,debugPort=9397;
let server,chrome,ws,startupError;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<150;i++){if(startupError)throw startupError;try{if(await fn())return;}catch{}await delay(100);}throw Error('Timed out: '+fn);}
try{
 await mkdir(output,{recursive:true});
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(dir,'vite-cache'),plugins:[{name:'test-only-screen-exports',enforce:'pre',transform(code,id){if(id.endsWith('/app/page.tsx'))return code+'\nexport { Shell, Study };';}},react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});await server.listen();
 chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});chrome.on('error',e=>startupError=e);
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(100);};
 const screenshot=async name=>{await evaluate('document.fonts.ready');await evaluate('window.scrollTo(0,0)');await delay(120);const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(shot.data,'base64'));await writeFile(join(output,name+'.json'),JSON.stringify(await evaluate(`(()=>{const e=document.querySelector('.patch-complete,.patch-home');const c=getComputedStyle(e);return {className:e.className,scrollY,top:e.getBoundingClientRect().top,padding:c.padding,font:c.fontFamily,height:innerHeight,width:innerWidth,fonts:document.fonts.status};})()`),null,2));};
 const viewport=(width,height=852)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 const navigate=async query=>{await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/ui-phase1.html?${query}`});await until(()=>evaluate('!!document.querySelector(".patch-greeting,.patch-complete")'));await evaluate('document.fonts.ready');await until(()=>evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'));};
 await cdp('Runtime.enable');await cdp('Page.enable');
 for(const state of ['empty','normal','hot','broken','completed','complete','stale']){
  await viewport(393);await navigate('state='+state);await screenshot(state+'-393');
  for(const width of [320,430,768]){await viewport(width,width===320?568:852);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${state}: ${width}px overflow`);}
 }
 await viewport(393);await navigate('state=normal');
 await click('.patch-current-node');await until(()=>evaluate('document.querySelector(".patch-sheet").open'));
 assert.equal(await evaluate('window.uiFixture.starts'),0,'Opening preview must not start study');
 assert.equal(await evaluate('document.activeElement.className'),'patch-sheet-close');
 await screenshot('preview-393');
 await cdp('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await until(()=>evaluate('!document.querySelector(".patch-sheet").open'));
 assert.equal(await evaluate('document.body.style.overflow'),'');
 await click('.patch-current-node');await click('.patch-sheet-close');assert.equal(await evaluate('window.uiFixture.starts'),0);
 await click('.patch-current-node');await click('.patch-sheet .patch-primary');assert.equal(await evaluate('window.uiFixture.starts'),1);
 await viewport(320,568);await navigate('state=normal&long=1&lang=ja');await click('.patch-current-node');await screenshot('preview-ja-long-320');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await viewport(393);await navigate('state=resume');
 await click('.patch-current-node');await until(()=>evaluate('window.uiFixture.pending.length===1'));
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
 assert.deepEqual(errors,[]);
 console.log('PASS: seven states, 320/393/430/768 widths, assets, read-only preview, Escape/close/start, long Japanese name, read-only saved estimate and stale response rejection. Screenshots: '+output);
}finally{ws?.close();if(chrome&&chrome.exitCode===null){const closed=new Promise(r=>chrome.once('exit',r));chrome.kill('SIGTERM');await closed;}await server?.close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
