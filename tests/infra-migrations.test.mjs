import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm, cp, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate, loadMigrations, validateDatabase } from '../scripts/infra/migrations.mjs';
import { createDatabase } from '../db/client.ts';
// auth-server's transitive TS imports require the same resolution as existing route tests.
test('request initialization rejects empty schema without executing any DDL', async () => { const c = createClient({ url: ':memory:' }); try {
    await assert.rejects(createDatabase(c).initialize(), /SCHEMA_NOT_READY/);
    assert.equal((await c.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.length, 0);
}
finally {
    c.close();
} });
test('explicit migration is repeatable, runtime read-only and history records checksums', async () => { const c = createClient({ url: ':memory:' }); try {
    await migrate(c);
    await migrate(c);
    const rows = (await c.execute('SELECT * FROM _patch_migrations')).rows;
    assert.equal(rows.length, 9);
    assert.ok(rows.every(r => /^[a-f0-9]{64}$/.test(r.checksum) && r.status === 'applied' && r.applied_at && r.runner_version));
    await createDatabase(c).initialize();
    await validateDatabase(c, await loadMigrations());
}
finally {
    c.close();
} });
test('modified applied SQL fails checksum validation', async () => { const dir = await mkdtemp(join(tmpdir(), 'patch-migration-')); const c = createClient({ url: ':memory:' }); try {
    await cp('drizzle', join(dir, 'sql'), { recursive: true });
    await migrate(c, { directory: join(dir, 'sql') });
    await appendFile(join(dir, 'sql', '0000_special_shaman.sql'), '\n-- changed');
    await assert.rejects(migrate(c, { directory: join(dir, 'sql') }), /CHECKSUM/);
}
finally {
    c.close();
    await rm(dir, { recursive: true, force: true });
} });
test('schema drift is not automatically repaired by runner or request', async () => { const c = createClient({ url: ':memory:' }); try {
    await migrate(c);
    await c.execute('ALTER TABLE cards ADD sneaky TEXT');
    await assert.rejects(migrate(c), /SCHEMA_DRIFT/);
    await assert.rejects(createDatabase(c).initialize(), /SCHEMA_NOT_READY/);
}
finally {
    c.close();
} });
test('a second runner cannot acquire a live lease across separate connections', async () => { const dir = await mkdtemp(join(tmpdir(), 'patch-lock-')); const a = createClient({ url: 'file:' + join(dir, 'db') }), b = createClient({ url: 'file:' + join(dir, 'db') }); try {
    let release;
    const pause = new Promise(r => release = r);
    let ready;
    const acquired = new Promise(r => ready = r);
    const first = migrate(a, { afterAcquire: async () => { ready(); await pause; } });
    await acquired;
    await assert.rejects(migrate(b), /MIGRATION_LOCKED/);
    release();
    await first;
}
finally {
    a.close();
    b.close();
    await rm(dir, { recursive: true, force: true });
} });
test('expired runner cannot commit its migration', async () => { const c = createClient({ url: ':memory:' }); try {
    await assert.rejects(migrate(c, { leaseMs: 1, beforeCommit: async () => { await new Promise(r => setTimeout(r, 1100)); } }), /LEASE_LOST/);
    assert.equal((await c.execute('SELECT * FROM _patch_migrations')).rows.length, 0);
}
finally {
    c.close();
} });
test('lost COMMIT response is reconciled with committed checksum without replay', async () => { const c = createClient({ url: ':memory:' }); const original = c.transaction.bind(c); let once = true; c.transaction = async (mode) => { const tx = await original(mode); const commit = tx.commit.bind(tx); tx.commit = async () => { await commit(); if (once) {
    once = false;
    throw new Error('lost response');
} }; return tx; }; try {
    await migrate(c);
    assert.equal((await c.execute('SELECT * FROM _patch_migrations')).rows.length, 9);
}
finally {
    c.close();
} });
test('failed statement rolls back migration and preserves successful prefix for explicit restart', async () => { const dir = await mkdtemp(join(tmpdir(), 'patch-fail-')); const c = createClient({ url: ':memory:' }); try {
    await cp('drizzle', join(dir, 'sql'), { recursive: true });
    await appendFile(join(dir, 'sql', '0007_tired_king_cobra.sql'), '\n--> statement-breakpoint\nBROKEN SQL;');
    await assert.rejects(migrate(c, { directory: join(dir, 'sql') }));
    assert.equal((await c.execute('SELECT * FROM _patch_migrations')).rows.length, 7);
    assert.equal((await c.execute("SELECT name FROM sqlite_master WHERE name='users'")).rows.length, 0);
}
finally {
    c.close();
    await rm(dir, { recursive: true, force: true });
} });
