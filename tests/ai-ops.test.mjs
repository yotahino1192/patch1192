import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrate } from '../scripts/infra/migrations.mjs';
test('operator stop/status/reconcile/resume is explicit and retains maximum charge in isolated DB',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'patch-ai-ops-')),url='file:'+join(dir,'db'),c=createClient({url});
 const run=(...args)=>execFileSync(process.execPath,['scripts/ai-control.mjs',...args,'--url',url],{env:{...process.env,PATCH_ENV:'development'},encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{await migrate(c);await c.execute("INSERT INTO users VALUES ('a','now')");const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 await c.execute({sql:"INSERT INTO ai_requests(id,user_id,key_hash,payload_hash,endpoint,state,created_at,lease_until,result_until,cost_micros) VALUES(?,'a','key','payload','cards','unknown',0,0,0,3600)",args:[id]});
 assert.match(run('stop'),/AI_CONTROL_UPDATED/);assert.equal((await c.execute('SELECT enabled FROM ai_control')).rows[0].enabled,0);
 assert.equal(JSON.parse(run('status')).states[0].cost_micros,3600);
 assert.throws(()=>run('resume','--confirm-reviewed'));
 assert.throws(()=>run('resolve-final','--request',id));
 run('resolve-final','--request',id,'--confirm-provider-final','--retain-maximum-cost');
 const row=(await c.execute('SELECT state,cost_micros FROM ai_requests')).rows[0];assert.equal(row.state,'failed_final');assert.equal(row.cost_micros,3600);
 run('resume','--confirm-reviewed');assert.equal((await c.execute('SELECT enabled FROM ai_control')).rows[0].enabled,1);
 }finally{c.close();await rm(dir,{recursive:true,force:true});}
});
