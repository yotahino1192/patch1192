import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setImmediate as turn} from 'node:timers/promises';
import {registerHooks} from 'node:module';
import {createClient} from '@libsql/client';
import {migrate} from '../scripts/infra/migrations.mjs';
import {schema,hash} from '../scripts/infra/schema.mjs';
import {checkSchema} from '../db/runtime-schema.ts';
import {readinessProbe} from '../lib/reliability/server.ts';
import {readinessDiagnostic,readinessMeasure} from '../lib/reliability/readiness-diagnostics.ts';
import {validateServer} from '../lib/env/server.ts';
const manifest=JSON.parse(await readFile(new URL('../config/schema-manifest.json',import.meta.url),'utf8'));
const quiet=()=>{};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function fixture(action){const c=createClient({url:':memory:'});try{await migrate(c);await action(c);}finally{c.close();}}
function readOnly(c,gate){
 const calls=[];
 const sql=s=>typeof s==='string'?s:s.sql;
 return {calls,client:{
  async execute(statement){assert.match(sql(statement),/^(SELECT|PRAGMA) /);calls.push(['execute',sql(statement)]);await gate?.();return c.execute(statement);},
  async batch(statements,mode){assert.equal(mode,'read');statements.forEach(s=>assert.match(sql(s),/^(SELECT|PRAGMA) /));calls.push(['batch',statements.length]);await gate?.();return c.batch(statements,mode);},
 }};
}

test('full migrated schema retains the exact manifest fingerprint using three read-only transport calls',async()=>{
 await fixture(async c=>{
  const before=await c.execute('SELECT total_changes() n');
  const {client,calls}=readOnly(c),stages=[];
  await checkSchema(client,readinessMeasure((stage,outcome)=>stages.push([stage,outcome])));
  assert.deepEqual(calls.map(c=>c[0]),['batch','execute','batch']);
  assert.equal(calls[0][1],2);assert.equal(calls[2][1],52);
  assert.deepEqual(stages,[['database','ok'],['migration','ok'],['schema','ok']]);
  assert.equal(hash(JSON.stringify(await schema(c))),manifest.schemaChecksum);
  assert.deepEqual((await c.execute('SELECT total_changes() n')).rows,before.rows);
 });
});

test('slow healthy schema completes once in background; concurrent callers time out then use completion cache',async t=>{
 await fixture(async c=>{
  t.mock.timers.enable({apis:['setTimeout','Date']});
  const gate=deferred(),records=[],kept=[];
  const {client,calls}=readOnly(c,()=>gate.promise);
  const ready=readinessProbe(()=>checkSchema(client),2000,5000,(...r)=>records.push(r));
  const requests=Array.from({length:12},()=>ready(work=>kept.push(work)));
  await turn();assert.equal(calls.length,1);assert.equal(new Set(kept).size,1);
  t.mock.timers.tick(2000);assert.deepEqual(await Promise.all(requests),Array(12).fill(false));
  gate.resolve();assert.equal(await kept[0],true);
  assert.equal(calls.length,3);assert.equal(await ready(),true);assert.equal(calls.length,3);
  t.mock.timers.tick(4999);assert.equal(await ready(),true);assert.equal(calls.length,3);
  t.mock.timers.tick(1);assert.equal(await ready(),true);assert.equal(calls.length,6);
  assert.equal(records.filter(r=>r[1]==='timeout').length,12);
  assert.equal(records.filter(r=>r[1]==='ok').length,2);
 });
});

test('fast success is cached from completion and expired cache must recheck',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});let count=0,fail=false;
 const ready=readinessProbe(async()=>{count++;if(fail)throw Error('private');},2000,5000,quiet);
 assert.equal(await ready(),true);assert.equal(await ready(),true);assert.equal(count,1);
 fail=true;t.mock.timers.tick(5000);assert.equal(await ready(),false);assert.equal(count,2);
 assert.equal(await ready(),false);assert.equal(count,2);
 fail=false;t.mock.timers.tick(5000);assert.equal(await ready(),true);assert.equal(count,3);
});

test('late DB failure never creates a successful cache; synchronous rejection and hanging work fail closed',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const gate=deferred();let count=0,kept;
 const ready=readinessProbe(()=>{count++;return gate.promise;},2000,5000,quiet);
 const first=ready(p=>kept=p);t.mock.timers.tick(2000);assert.equal(await first,false);
 gate.reject(Error('token private upstream'));assert.equal(await kept,false);assert.equal(await ready(),false);assert.equal(count,1);
 const broken=readinessProbe(()=>{throw Error('secret');},2000,5000,quiet);assert.equal(await broken(),false);
 let hangs=0;const hanging=readinessProbe(()=>{hangs++;return new Promise(()=>{});},2000,5000,quiet);
 for(let i=0;i<3;i++){const request=hanging();t.mock.timers.tick(2000);assert.equal(await request,false);}
 assert.equal(hangs,1);
});

test('ledger count/name/checksum/status and schema columns/indexes/FKs/triggers still fail closed',async()=>{
 const changes=[
  "DELETE FROM _patch_migrations WHERE name=(SELECT min(name) FROM _patch_migrations)",
  "UPDATE _patch_migrations SET name='changed' WHERE name=(SELECT min(name) FROM _patch_migrations)",
  "UPDATE _patch_migrations SET checksum='changed'",
  "UPDATE _patch_migrations SET status='failed'",
  "ALTER TABLE users ADD COLUMN unexpected TEXT",
  "CREATE INDEX unexpected ON users(id)",
  "CREATE TABLE unexpected (id TEXT REFERENCES users(id))",
  "CREATE TRIGGER unexpected AFTER INSERT ON users BEGIN SELECT 1; END",
 ];
 for(const change of changes)await fixture(async c=>{
  await c.execute(change);const stages=[];
  await assert.rejects(checkSchema(readOnly(c).client,readinessMeasure((...r)=>stages.push(r))),/SCHEMA_NOT_READY/);
  assert.equal(stages.at(-1)[1],'failed');
  assert.equal(stages.at(-1)[0],change.includes('_patch_migrations')?'migration':'schema');
 });
});

test('DB/configuration errors and malformed batches are sanitized; diagnostics accept only fixed fields',async()=>{
 const lines=[],original=console.info,secret='private-token-provider-message';console.info=line=>lines.push(JSON.parse(line));
 try{
  const measure=readinessMeasure();
  await assert.rejects(measure('configuration',()=>validateServer({PATCH_ENV:'invalid'})),/CONFIG_INVALID/);
  await assert.rejects(checkSchema({batch:async()=>{throw Error(secret);}},measure),e=>e.message==='SCHEMA_NOT_READY'&&!e.message.includes(secret));
  await assert.rejects(checkSchema({batch:async()=>[]},measure),/SCHEMA_NOT_READY/);
  await fixture(async c=>{
   const wrapped=readOnly(c).client,originalBatch=wrapped.batch;let n=0;
   wrapped.batch=async(...args)=>++n===2?[]:originalBatch(...args);
   await assert.rejects(checkSchema(wrapped,measure),/SCHEMA_NOT_READY/);
  });
  readinessDiagnostic(secret,'failed',0);readinessDiagnostic('total',secret,0);readinessDiagnostic('total','ok',NaN);
  assert.ok(!JSON.stringify(lines).includes(secret));
  assert.ok(lines.every(r=>Object.keys(r).sort().join(',')==='durationMs,event,outcome,stage'));
  assert.ok(lines.every(r=>r.event==='readiness'&&Number.isFinite(r.durationMs)));
  assert.ok(lines.some(r=>r.stage==='configuration'&&r.outcome==='failed'));
  assert.ok(lines.some(r=>r.stage==='database'&&r.outcome==='failed'));
  const throwing=readinessMeasure(()=>{throw Error(secret);});assert.equal(await throwing('schema',()=>42),42);
  const ready=readinessProbe(async()=>{},2000,5000,()=>{throw Error(secret);});assert.equal(await ready(),true);
 }finally{console.info=original;}
});

test('actual readiness route attaches its one in-flight check to Next after and keeps HTTP no-store contract',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const gate=deferred(),callbacks=[];let calls=0;
 globalThis.__readinessCheck=()=>{calls++;return gate.promise;};
 globalThis.__readinessAfter=callback=>callbacks.push(callback);
 const hooks=registerHooks({resolve(s,c,n){
  if(c.parentURL?.endsWith('/app/api/ready/route.ts')){
   if(s==='next/server')return {url:'data:text/javascript,export const after=globalThis.__readinessAfter',shortCircuit:true};
   if(s==='../../../db/client')return {url:'data:text/javascript,export const initializeReadinessDatabase=globalThis.__readinessCheck',shortCircuit:true};
   if(s.startsWith('.')&&!/\.[a-z]+$/.test(s))return n(new URL(s+'.ts',c.parentURL).href,c);
  }
  return n(s,c);
 }});
 const info=console.info;console.info=quiet;
 try{
  const {GET,maxDuration}=await import('../app/api/ready/route.ts');assert.equal(maxDuration,60);
  const pending=GET(new Request('https://test.invalid/api/ready'));
  await turn();t.mock.timers.tick(2000);
  const response=await pending;assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{status:'unavailable'});assert.equal(callbacks.length,1);
  gate.resolve();await callbacks[0]();
  const success=await GET(new Request('https://test.invalid/api/ready'));
  assert.equal(success.status,200);assert.equal(success.headers.get('cache-control'),'no-store');
  assert.deepEqual(await success.json(),{status:'ready'});assert.equal(calls,1);
 }finally{console.info=info;hooks.deregister();delete globalThis.__readinessCheck;delete globalThis.__readinessAfter;}
});
