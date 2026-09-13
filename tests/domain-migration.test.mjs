import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createClient} from '@libsql/client';
import {migrate,loadMigrations,validateDatabase} from '../scripts/infra/migrations.mjs';
import {createDatabase} from '../db/client.ts';
import {createDomainUnitOfWork} from '../db/domain-repository.ts';
import {createDomainService} from '../lib/domain/service.ts';

test('0011 upgrade is additive: existing CardSet, Source, review evidence and session survive byte-for-byte',async()=>{
 const directory=await mkdtemp('/private/tmp/patch-domain-upgrade-'),c=createClient({url:':memory:'});
 try {
  const migrations=await loadMigrations(),old=migrations.filter(m=>m.name<'0011_');for(const m of old)await writeFile(directory+'/'+m.name,m.sql);
  await migrate(c,{directory});
  await c.execute("INSERT INTO users(id,created_at) VALUES('legacy-user','now')");
  await c.execute("INSERT INTO sources VALUES('s','legacy-user','title','content','now','now')");
  await c.execute("INSERT INTO card_sets(id,user_id,source_id,title,category,summary,key_points,created_at,updated_at) VALUES('set','legacy-user','s','title','','','[]','now','now')");
  await c.execute("INSERT INTO cards(id,user_id,set_id,question,answer,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at) VALUES('card','legacy-user','set','Q','A','復習待ち',2,'now',1,1,1,'now','now')");
  await c.execute("INSERT INTO review_logs(id,user_id,card_id,session_id,rating,response_ms,reviewed_at,operation_id) VALUES('review','legacy-user','card','session','good',10,'now','review-operation')");
  await c.execute("INSERT INTO study_sessions VALUES('legacy-user','session','set','[\"card\"]',300,1,0,'now','now',0)");
  const tables=['sources','card_sets','cards','review_logs','study_sessions'],before={};for(const t of tables)before[t]=(await c.execute(`SELECT * FROM ${t}`)).rows;
  const checksums=(await c.execute('SELECT name,checksum FROM _patch_migrations ORDER BY name')).rows;
  await migrate(c);await migrate(c);await validateDatabase(c,migrations);
  assert.deepEqual((await c.execute('SELECT name,checksum FROM _patch_migrations ORDER BY name')).rows.slice(0,old.length),checksums);
  for(const t of tables){const after=(await c.execute(`SELECT * FROM ${t}`)).rows.map(row=>Object.fromEntries(Object.keys(before[t][0]).map(k=>[k,row[k]])));assert.deepEqual(after,before[t]);}
  assert.equal((await c.execute('SELECT patch_id FROM sources')).rows[0].patch_id,null);
  assert.equal((await c.execute('SELECT count(*) n FROM patches')).rows[0].n,0);
  const service=createDomainService(createDomainUnitOfWork(createDatabase(c))),session=await service.query('legacy-user',{resource:'lesson',id:'session'});assert.equal(session.legacy,true);assert.equal(session.status,'COMPLETED');assert.deepEqual(session.legacyCardIds,['card']);
 } finally {c.close();await rm(directory,{recursive:true,force:true});}
});
