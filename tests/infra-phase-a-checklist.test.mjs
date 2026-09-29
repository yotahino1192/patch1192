import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client';
import { migrate, loadMigrations, validateDatabase } from '../scripts/infra/migrations.mjs';
import { backup, restoreCheck } from '../scripts/infra/backup.mjs';
import { operationsStatus } from '../scripts/infra/operations.mjs';

// Execute the operator's actual heredocs, not a separately maintained validator.
// Replace only environment/IO boundaries: no Production env or target() is loaded.
const document = await readFile('docs/phase-a-final-operator-checklist.md', 'utf8');
function block(name) {
  const matches = [...document.matchAll(new RegExp("<<'" + name + "'\\n([\\s\\S]*?)\\n" + name + '\\n', 'g'))];
  assert.equal(matches.length, 1);
  return matches[0][1];
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const baselineSource = block('BASELINE');
const cliImport = "import { command, target } from './scripts/infra/cli.mjs';\n";
assert.ok(baselineSource.startsWith(cliImport));
const baseline = new AsyncFunction('command', 'target', 'console', baselineSource.slice(cliImport.length));
const ageImports = "import {readFile} from 'node:fs/promises';\nimport {join} from 'node:path';\n";
assert.ok(block('AGE').startsWith(ageImports));
const checkAge = new AsyncFunction('readFile', 'join', 'process', 'console', block('AGE').slice(ageImports.length));

async function fixture(action) {
  const client = createClient({ url: ':memory:' });
  try { await migrate(client); await action(client); } finally { client.close(); }
}
async function runBaseline(client, override = () => undefined) {
  const logs = [];
  let closed = false;
  await baseline(fn => fn(), () => ({ client: {
    execute: async sql => {
      // Fail if a future checklist edit introduces any write on the checked DB.
      assert.match(sql, /^(SELECT\b|PRAGMA (?:integrity_check|foreign_key_check)$)/);
      return override(sql) ?? client.execute(sql);
    },
    close: () => { closed = true; },
  } }), { log: message => logs.push(message) });
  assert.equal(closed, true);
  assert.deepEqual(logs, ['PRODUCTION_BASELINE_INITIALIZED_VALIDATED']);
}
const rows = values => ({ rows: values });

test('documented baseline accepts exactly the migrated seed, stays read-only, and ops remains zero', async () => {
  await fixture(async client => {
    const migrations = await loadMigrations();
    assert.equal(migrations.length, 13);
    await validateDatabase(client, migrations);
    const before = JSON.stringify((await client.execute('SELECT * FROM ai_control')).rows);
    assert.equal(before, '[{"id":1,"enabled":1}]');
    const history = JSON.stringify((await client.execute('SELECT * FROM _patch_migration_runs')).rows);
    await runBaseline(client);
    assert.equal(JSON.stringify((await client.execute('SELECT * FROM ai_control')).rows), before);
    assert.equal(JSON.stringify((await client.execute('SELECT * FROM _patch_migration_runs')).rows), history);
    const status = await operationsStatus(client);
    for (const group of [status.ai, status.deletion]) assert.ok(Object.values(group).every(value => value === 0));
  });
});

for (const [name, sql] of [
  ['missing singleton', 'DELETE FROM ai_control'],
  ['changed singleton', 'UPDATE ai_control SET enabled=0 WHERE id=1'],
]) test('documented baseline rejects ' + name, async () => {
  await fixture(async client => {
    await client.execute(sql);
    await assert.rejects(runBaseline(client), /AI_CONTROL_INITIAL_STATE_INVALID/);
  });
});

test('documented baseline rejects malformed or extra control rows, not merely their count', async () => {
  await fixture(async client => {
    for (const control of [[{id: 2, enabled: 1}], [{id: 1, enabled: 2}], [{id: 1, enabled: 1}, {id: 2, enabled: 1}]]) {
      await assert.rejects(runBaseline(client, sql => sql === 'SELECT id,enabled FROM ai_control' ? rows(control) : undefined), /AI_CONTROL_INITIAL_STATE_INVALID/);
    }
  });
});

test('documented baseline rejects a real unexpected user and a row in each of the other 25 tables', async () => {
  await fixture(async client => {
    const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_patch_%' AND name<>'ai_control'")).rows;
    assert.equal(tables.length, 25);
    for (const {name} of tables) {
      const count = 'SELECT count(*) n FROM "' + name + '"';
      await assert.rejects(runBaseline(client, sql => sql === count ? rows([{n: 1}]) : undefined), /UNEXPECTED_PRODUCTION_DATA/, name);
    }
    await client.execute("INSERT INTO users(id,created_at) VALUES('unexpected','now')");
    await assert.rejects(runBaseline(client), /UNEXPECTED_PRODUCTION_DATA/);
  });
});

for (const [name, sql] of [
  ['missing table', 'DROP TABLE chat_messages'],
  ['extra table with reserved-looking prefix', 'CREATE TABLE _patch_unexpected(id INTEGER)'],
]) test('documented baseline rejects ' + name, async () => {
  await fixture(async client => {
    await client.execute(sql);
    await assert.rejects(runBaseline(client), /PRODUCTION_TABLE_INVENTORY_INVALID/);
  });
});

test('documented baseline rejects unreleased or missing migration lock', async () => {
  await fixture(async client => {
    for (const sql of ["UPDATE _patch_migration_lock SET owner='unexpected'", 'UPDATE _patch_migration_lock SET owner=NULL,lease_until=1', 'DELETE FROM _patch_migration_lock']) {
      await client.execute(sql);
      await assert.rejects(runBaseline(client), /MIGRATION_LOCK_NOT_RELEASED/);
    }
  });
});

test('documented baseline rejects integrity or foreign-key failure and absent integrity evidence', async () => {
  await fixture(async client => {
    for (const integrity of [[], [{integrity_check: 'corrupt'}]]) {
      await assert.rejects(runBaseline(client, sql => sql === 'PRAGMA integrity_check' ? rows(integrity) : undefined), /INTEGRITY_INVALID/);
    }
    await assert.rejects(runBaseline(client, sql => sql === 'PRAGMA foreign_key_check' ? rows([{table: 'cards'}]) : undefined), /FOREIGN_KEY_INVALID/);
  });
});

test('documented backup AGE block accepts migrated seed after encrypted backup, copy and restore; rejects stale/wrong evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'phase-a-checklist-'));
  const source = join(dir, 'backup'), copy = join(dir, 'offsite-fixture');
  const key = randomBytes(32), sha = 'a'.repeat(40); // Local synthetic evidence only.
  try {
    await fixture(async client => {
      await runBaseline(client);
      await backup(client, {directory: source, key, dbIdentifier: 'mepamo-production', keyId: 'mepamo-production-v1', releaseSha: sha});
    });
    const seedSurvives = async client => assert.deepEqual((await client.execute('SELECT id,enabled FROM ai_control')).rows.map(r => ({...r})), [{id: 1, enabled: 1}]);
    await restoreCheck(source, key, {verify: seedSurvives});
    await cp(source, copy, {recursive: true});
    for (const file of ['snapshot.enc', 'manifest.json']) assert.deepEqual(await readFile(join(source, file)), await readFile(join(copy, file)));
    await restoreCheck(copy, key, {verify: seedSurvives});
    const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
    assert.equal(manifest.migrationCount, 13);
    assert.equal(manifest.tableRowCounts.ai_control, 1);
    const runAge = async patch => {
      const logs = [];
      const reader = (path, encoding) => path === join(source, 'manifest.json') ? JSON.stringify({...manifest, ...patch}) : readFile(path, encoding);
      await checkAge(reader, join, {argv: ['node', '-', source, sha]}, {log: (...args) => logs.push(args)});
      assert.equal(logs[0][0], 'BACKUP_AGE_VALID');
    };
    await runAge({});
    for (const patch of [
      {dbIdentifier: 'wrong'}, {keyId: 'wrong'}, {releaseSha: 'b'.repeat(40)},
      {migrationCount: 12}, {schemaChecksum: 'wrong'}, {backupTimestamp: 'invalid'},
      {backupTimestamp: new Date(Date.now() - 86401000).toISOString()},
      {backupTimestamp: new Date(Date.now() + 3600000).toISOString()},
    ]) await assert.rejects(runAge(patch), /BACKUP_EVIDENCE_INVALID_OR_STALE/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
