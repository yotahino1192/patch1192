import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { documentFixtures as fixtures, fixtureText as source } from '../tests/fixtures/document-files.mjs';
const dir = await mkdtemp(join(tmpdir(), 'patch-import-browser-'));
const port=5224,debugPort=9414;let server,chrome,ws;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<300;i++){if(await fn().catch(()=>false))return;await delay(100);}throw Error('Timed out');}
try {
 await mkdir('outputs/import-qa',{recursive:true});
 for(const [ext,data]of Object.entries(fixtures))await writeFile(join(dir,'safe.'+ext),data);
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(dir,'cache'),plugins:[{name:'test-exports',enforce:'pre',transform(code,id){if(id.endsWith('/app/page.tsx'))return code+'\nexport { Shell, Generate };';}},react()],define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[process.cwd(),realpathSync('node_modules')]}}});await server.listen();
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
 await until(async()=>(await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok);
 const tab=await(await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let seq=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data);if(pending.has(m.id)){const{resolve,reject}=pending.get(m.id);pending.delete(m.id);if(m.error)reject(Error(JSON.stringify(m.error)));else resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/build-patch.html`});await until(()=>evaluate('!!window.buildFixture?.ready'));
 const results=[];
 for(const ext of Object.keys(fixtures)){
  await evaluate(`buildFixture.update(w=>({...w,importDraft:{...w.importDraft,text:'',inputKind:'source',attachments:[],build:{...w.importDraft.build,step:2}}}))`);await delay(100);
  const dom=await cdp('DOM.getDocument');const {nodeId}=await cdp('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type=file]'});await cdp('DOM.setFileInputFiles',{nodeId,files:[join(dir,'safe.'+ext)]});
  await until(()=>evaluate('buildFixture.getWorkspace().importDraft.attachments.length===1 && buildFixture.getWorkspace().importDraft.attachments[0].status!=="reading"'));
  const result=await evaluate(`(()=>{const a=buildFixture.getWorkspace().importDraft.attachments[0];return {status:a.status,textMatches:a.text.replace(/\\s+/g,' ').trim()===${JSON.stringify(source)},canContinue:!document.querySelector('.build-primary').disabled,error:a.error}})()`);
  if(result.status==='failed')result.parserError=await evaluate(`(async()=>{try{await(await import('/lib/document-import.ts')).extractDocument(new File([Uint8Array.from(${JSON.stringify(Array.from(typeof fixtures[ext]==='string'?Buffer.from(fixtures[ext]):fixtures[ext]))})],'safe.${ext}'));return null;}catch(e){return {name:e.name,message:e.message}}})()`);
  results.push({format:ext,...result});
 }
 assert.ok(results.every(r=>r.status==='accepted'&&r.textMatches&&r.canContinue));
 await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/tests/fixtures/document-import-flow.html`});
 await until(()=>evaluate('!!window.importResults'));
 const flow=await evaluate('window.importResults');
 assert.ok(flow.every(r=>r.format ? r.accepted&&r.textMatches&&r.canContinue&&r.continued&&r.malformedRejected : r.ok),JSON.stringify(flow));
 const report={selection:'CDP file input with generated files on disk',results,flow};
 console.log(JSON.stringify(report,null,2));await writeFile('outputs/import-qa/browser.json',JSON.stringify(report,null,2));
}finally{ws?.close();if(chrome && chrome.exitCode===null){const exited=new Promise(r=>chrome.once('exit',r));chrome.kill();await exited;}await server?.close();await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
