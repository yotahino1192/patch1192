import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {createClient} from '@libsql/client';
import {createDatabase} from '../db/client.ts';
import {migrate} from '../scripts/infra/migrations.mjs';
import {headers,issuer,origin} from './auth-fixture.mjs';
const c=createClient({url:':memory:'});await migrate(c);const db=createDatabase(c);globalThis.__domainApiDb=db;after(()=>c.close());
registerHooks({resolve(s,context,next){if(s==='./client'||s.endsWith('/db/client'))return {url:'data:text/javascript,export function database(){return globalThis.__domainApiDb} export async function initializeDatabase(){await globalThis.__domainApiDb.initialize()}',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){const url=new URL(s+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context);}return next(s,context);}});
const {GET,POST}=await import('../app/api/domain/route.ts');const {resolveInternalUser}=await import('../db/auth-store.ts');
const a=await resolveInternalUser(issuer,'user_domain_A'),b=await resolveInternalUser(issuer,'user_domain_B');
const request=(subject,owner,input,path='')=>new Request(origin+'/api/domain'+path,{method:input?'POST':'GET',headers:headers(subject,owner,{'content-type':'application/json'}),...(input?{body:JSON.stringify(input)}:{})});
test('domain API uses actual signed session/account binding, no anonymous writes or client-chosen owners',async()=>{
 assert.equal((await POST(new Request(origin+'/api/domain',{method:'POST'}))).status,401);
 assert.equal((await GET(request('user_domain_A',b,undefined,'?resource=patches'))).status,409);
 const bad=await POST(request('user_domain_A',a,{action:'createPatch',input:{title:'Bad',mode:'TOPIC',ownerId:b}}));assert.equal(bad.status,400);
 const response=await POST(request('user_domain_A',a,{action:'createPatch',input:{title:'Only A',mode:'TOPIC'}}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('x-request-id'),/^[a-f0-9-]{36}$/);
 const patch=await response.json();assert.equal(patch.ownerId,a);
 assert.equal((await GET(request('user_domain_B',b,undefined,'?resource=patch&id='+patch.id))).status,404);
 assert.deepEqual(await (await GET(request('user_domain_B',b,undefined,'?resource=patches'))).json(),[]);
});
test('domain API rejects invalid enum, oversized input and ambiguous queries; database failure is sanitized',async()=>{
 assert.equal((await POST(request('user_domain_A',a,{action:'createActivity',input:{objectiveId:'x',type:'CUSTOM_AI_TYPE'}}))).status,400);
 assert.equal((await POST(request('user_domain_A',a,{action:'createSource',input:{content:'x'.repeat(300000)}}))).status,413);
 assert.equal((await GET(request('user_domain_A',a,undefined,'?resource=patches&resource=patch'))).status,400);
 assert.equal((await GET(request('user_domain_A',a,undefined,'?resource=patches&ownerId='+b))).status,400);
 globalThis.__domainApiDb={...db,transaction:async()=>{throw new Error('private sql credential');}};
 try{const response=await GET(request('user_domain_A',a,undefined,'?resource=patches'));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private'));}finally{globalThis.__domainApiDb=db;}
});
