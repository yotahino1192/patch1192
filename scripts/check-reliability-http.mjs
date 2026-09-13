// Run after build. Ephemeral SQLite only, never hosted credentials or migrations.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createClient} from '@libsql/client';
const dir=await mkdtemp('/private/tmp/patch-reliability-http-'),port=Number(process.env.RELIABILITY_HTTP_PORT||3227),url=`http://127.0.0.1:${port}`,dbURL=`file:${dir}/unprepared.db`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env:{...process.env,PATCH_ENV:'development',VERCEL:'',TURSO_DATABASE_URL:dbURL,TURSO_AUTH_TOKEN:'',CLERK_SECRET_KEY:'',CLERK_JWT_KEY:'',OPENAI_API_KEY:''},stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let client;
try{
 let up=false;for(let i=0;i<150;i++){try{up=(await fetch(url+'/api/health')).ok;if(up)break;}catch{}await delay(100);}assert.ok(up);
 const h=await fetch(url+'/api/health');assert.deepEqual(await h.json(),{status:'ok'});assert.equal(h.headers.get('cache-control'),'no-store');assert.match(h.headers.get('x-request-id'),/^[a-f0-9-]{36}$/);
 const ready=await fetch(url+'/api/ready');assert.equal(ready.status,503);assert.deepEqual(await ready.json(),{status:'unavailable'});assert.equal(ready.headers.get('cache-control'),'no-store');
 client=createClient({url:dbURL});assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.length,0);
 for(const route of ['/privacy','/terms','/support'])assert.equal((await fetch(url+route)).status,200);
 console.log('PASS: anonymous liveness, fail-closed readiness, no schema creation, no secrets, public pages during DB outage');
}finally{client?.close();server.kill('SIGTERM');await delay(300);await rm(dir,{recursive:true,force:true});}
