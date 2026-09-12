import { migrate } from '../scripts/infra/migrations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { readFile, readdir } from 'node:fs/promises';

test('fresh libSQL database initializes all schema and retains state on restart', async () => {
  const client = createClient({url:':memory:'});
  try {
    await migrate(client);
    const db = createDatabase(client);
    await Promise.all([db.initialize(),db.initialize()]);
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(r=>r.name);
    for(const name of ['users','auth_identities','cards','sources','card_sets','folders','daily_review_plans','review_logs','chat_messages']) assert.ok(tables.includes(name));
    assert.equal((await db.prepare('SELECT count(*) AS n FROM _patch_migrations').first()).n,9);
    await db.prepare('INSERT INTO folders VALUES (?,?,?,?,?,?)').bind('f','owner',null,'History','now','now').run();
    await createDatabase(client).initialize();
    assert.equal((await db.prepare('SELECT name FROM folders WHERE id=?').bind('f').first()).name,'History');
    assert.equal(await db.prepare('SELECT id FROM folders WHERE id=?').bind('missing').first(),null);
  } finally { client.close(); }
});
test('libSQL batch is atomic and bind values are independent', async () => {
  const client = createClient({url:':memory:'});
  try {
    await migrate(client);
    const db = createDatabase(client);
    const prepared = db.prepare('INSERT INTO folders VALUES (?,?,?,?,?,?)');
    await assert.rejects(db.batch([prepared.bind('f','u',null,'A','n','n'), prepared.bind('f','u',null,'B','n','n')]));
    assert.equal((await db.prepare('SELECT count(*) AS n FROM folders').first()).n,0);
    await db.batch([prepared.bind('a','u',null,'A','n','n'),prepared.bind('b','u',null,'B','n','n')]);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM folders').first()).n,2);
  } finally { client.close(); }
});
test('an existing Cloudflare schema requires explicit validated baseline', async () => {
  const client = createClient({url:':memory:'});
  try {
    const dir = new URL('../drizzle/',import.meta.url);
    for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) await client.executeMultiple(await readFile(new URL(name,dir),'utf8'));
    await client.execute("INSERT INTO sources VALUES ('s','loop-owner','Original','Keep this text','n','n')");
    const db = createDatabase(client);
    await assert.rejects(db.initialize(), /SCHEMA_NOT_READY/);
    await migrate(client,{baseline:true});
    await db.initialize();
    assert.equal((await db.prepare("SELECT content FROM sources WHERE id='s'").first()).content,'Keep this text');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM _patch_migrations').first()).n,9);
  } finally { client.close(); }
});
