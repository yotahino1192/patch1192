import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createClient} from '@libsql/client';
import {migrate,loadMigrations,validateDatabase} from '../scripts/infra/migrations.mjs';
test('0012 preserves old content/evidence/session timestamps and defaults provenance without guessing old MCQ selections',async()=>{
 const directory=await mkdtemp('/private/tmp/patch-free-upgrade-'),c=createClient({url:':memory:'});
 try{
  const migrations=await loadMigrations();for(const m of migrations.filter(m=>m.name<'0012_'))await writeFile(directory+'/'+m.name,m.sql);
  await migrate(c,{directory});await c.execute("INSERT INTO users(id,created_at) VALUES('owner','now')");
  await c.execute("INSERT INTO sources(id,user_id,title,content,created_at,updated_at) VALUES('source','owner','T','Original source','now','now')");
  await c.execute("INSERT INTO card_sets(id,user_id,source_id,title,category,summary,key_points,created_at,updated_at) VALUES('set','owner','source','T','','','[]','now','now')");
  await c.execute("INSERT INTO cards(id,user_id,set_id,question,answer,format,choices,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at) VALUES('card','owner','set','Q','A','multiple_choice','[\"A\",\"B\",\"C\",\"D\"]','苦手',1,'now',0,1,0,'now','now')");
  await c.execute("INSERT INTO review_logs(id,user_id,card_id,session_id,rating,response_ms,reviewed_at) VALUES('review','owner','card','session','again',10,'now')");
  await c.execute("INSERT INTO study_sessions(user_id,id,set_id,card_ids,estimated_seconds,qualifies,created_at) VALUES('owner','session','set','[\"card\"]',50,0,'now')");
  const before={};for(const t of ['sources','cards','review_logs','study_sessions'])before[t]=(await c.execute(`SELECT * FROM ${t}`)).rows[0];
  await migrate(c);await migrate(c);await validateDatabase(c,migrations);
  for(const [table,row] of Object.entries(before)){const after=(await c.execute(`SELECT * FROM ${table}`)).rows[0];for(const key of Object.keys(row))assert.deepEqual(after[key],row[key]);}
  assert.equal((await c.execute('SELECT response_json,payload_hash FROM review_logs')).rows[0].response_json,null);
  assert.equal((await c.execute('SELECT input_kind FROM sources')).rows[0].input_kind,'source');
  assert.equal((await c.execute('SELECT completed_at FROM study_sessions')).rows[0].completed_at,null);
 }finally{c.close();await rm(directory,{recursive:true,force:true});}
});
