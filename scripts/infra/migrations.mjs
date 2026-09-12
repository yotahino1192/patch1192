import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export const RUNNER_VERSION = '1';
export { hash, schema, SchemaNotReady, validateOwnership } from './schema.mjs';
import { hash, schema, SchemaNotReady, validateOwnership } from './schema.mjs';
export async function loadMigrations(directory = resolve('drizzle')) {
    const files = (await readdir(directory)).filter(n => /^\d+_.*\.sql$/.test(n)).sort();
    if (!files.length)
        throw new Error('MIGRATIONS_MISSING');
    return Promise.all(files.map(async (name) => { const sql = await readFile(resolve(directory, name), 'utf8'); return { name, sql, checksum: hash(sql) }; }));
}
export async function expectedSchema(migrations) {
    const c = createClient({ url: ':memory:' });
    try {
        for (const m of migrations)
            for (const sql of m.sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean))
                await c.execute(sql);
        return await schema(c);
    }
    finally {
        c.close();
    }
}
export async function validateDatabase(client, migrations, { allowLegacy = false } = {}) {
    const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(x => x.name);
    if (!tables.includes('_patch_migrations'))
        throw new SchemaNotReady();
    const applied = (await client.execute('SELECT name,checksum,status FROM _patch_migrations ORDER BY name')).rows;
    if (applied.length !== migrations.length || applied.some((r, i) => r.name !== migrations[i].name || r.checksum !== migrations[i].checksum || r.status !== 'applied'))
        throw new SchemaNotReady();
    const actual = await schema(client), expected = await expectedSchema(migrations);
    if (hash(JSON.stringify(actual)) !== hash(JSON.stringify(expected)))
        throw new SchemaNotReady();
    if ((await client.execute('PRAGMA foreign_key_check')).rows.length)
        throw new Error('FOREIGN_KEY_INVALID');
    if (!allowLegacy)
        await validateOwnership(client);
    return { schemaChecksum: hash(JSON.stringify(actual)), migrations: migrations.map(({ name, checksum }) => ({ name, checksum })) };
}
async function infrastructure(c) {
    // Only the explicit runner calls this. Never imported/executed as request initialization.
    await c.batch([
        'CREATE TABLE IF NOT EXISTS _patch_migrations (name TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL,release_sha TEXT NOT NULL,runner_version TEXT NOT NULL,status TEXT NOT NULL)',
        'CREATE TABLE IF NOT EXISTS _patch_migration_lock (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,lease_until INTEGER NOT NULL,fence INTEGER NOT NULL)',
        'INSERT OR IGNORE INTO _patch_migration_lock VALUES (1,NULL,0,0)',
        'CREATE TABLE IF NOT EXISTS _patch_migration_runs (id TEXT PRIMARY KEY,owner TEXT NOT NULL,fence INTEGER,status TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,error_code TEXT)'
    ], 'write');
}
const clockSql = "CAST(strftime('%s','now') AS INTEGER)*1000";
export async function acquireLock(c, owner, leaseMs) {
    const r = await c.execute({ sql: `UPDATE _patch_migration_lock SET owner=?,lease_until=${clockSql}+?,fence=fence+1 WHERE id=1 AND lease_until<=${clockSql} RETURNING fence`, args: [owner, leaseMs] });
    if (!r.rows.length)
        throw new Error('MIGRATION_LOCKED');
    return Number(r.rows[0].fence);
}
export async function fenceCheck(tx, owner, fence) {
    const r = await tx.execute({ sql: `SELECT 1 FROM _patch_migration_lock WHERE id=1 AND owner=? AND fence=? AND lease_until>${clockSql}`, args: [owner, fence] });
    if (!r.rows.length)
        throw new Error('MIGRATION_LEASE_LOST');
}
export async function migrate(c, { directory = resolve('drizzle'), releaseSha = 'local', baseline = false, leaseMs = 30000, beforeCommit, afterAcquire } = {}) {
    const ms = await loadMigrations(directory);
    await infrastructure(c);
    const owner = randomUUID(), fence = await acquireLock(c, owner, leaseMs), run = randomUUID();
    await c.execute({ sql: 'INSERT INTO _patch_migration_runs VALUES (?,?,?,?,?,NULL,NULL)', args: [run, owner, fence, 'running', new Date().toISOString()] });
    try {
        await afterAcquire?.();
        const applied = (await c.execute('SELECT name,checksum,status FROM _patch_migrations ORDER BY name')).rows;
        if (applied.some((r, i) => !ms[i] || r.name !== ms[i].name || r.checksum !== ms[i].checksum || r.status !== 'applied'))
            throw new Error('MIGRATION_CHECKSUM_MISMATCH');
        const actual = await schema(c);
        if (baseline) {
            if (applied.length)
                throw new Error('BASELINE_ALREADY_MANAGED');
            if (hash(JSON.stringify(actual)) !== hash(JSON.stringify(await expectedSchema(ms))))
                throw new Error('SCHEMA_DRIFT');
        }
        else if (hash(JSON.stringify(actual)) !== hash(JSON.stringify(await expectedSchema(ms.slice(0, applied.length)))))
            throw new Error('SCHEMA_DRIFT');
        for (const group of (baseline ? [ms] : ms.slice(applied.length).map(m => [m]))) {
            const m = group[group.length - 1];
            const tx = await c.transaction('write');
            let commitStarted = false;
            try {
                await fenceCheck(tx, owner, fence);
                await tx.execute({ sql: `UPDATE _patch_migration_lock SET lease_until=${clockSql}+? WHERE owner=? AND fence=?`, args: [leaseMs, owner, fence] });
                for (const item of group) {
                    if (!baseline)
                        for (const sql of item.sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean))
                            await tx.execute(sql);
                    await tx.execute({ sql: 'INSERT INTO _patch_migrations VALUES (?,?,?,?,?,?)', args: [item.name, item.checksum, new Date().toISOString(), releaseSha, RUNNER_VERSION, 'applied'] });
                }
                await beforeCommit?.(m);
                await fenceCheck(tx, owner, fence);
                commitStarted = true;
                await tx.commit();
            }
            catch (e) {
                try {
                    await tx.rollback();
                }
                catch { }
                tx.close();
                if (commitStarted) {
                    // Read committed history on a new operation; no blind replay after uncertain COMMIT.
                    const r = (await c.execute({ sql: 'SELECT checksum,status FROM _patch_migrations WHERE name=?', args: [m.name] })).rows[0];
                    if (r?.checksum === m.checksum && r.status === 'applied')
                        continue;
                    throw new Error('MIGRATION_COMMIT_UNCERTAIN');
                }
                throw e;
            }
            finally {
                tx.close();
            }
        }
        await validateDatabase(c, ms, { allowLegacy: true });
        await c.execute({ sql: "UPDATE _patch_migration_runs SET status='succeeded',finished_at=? WHERE id=?", args: [new Date().toISOString(), run] });
    }
    catch (e) {
        try {
            await c.execute({ sql: "UPDATE _patch_migration_runs SET status='failed',finished_at=?,error_code=? WHERE id=?", args: [new Date().toISOString(), /^[A-Z_]+$/.test(e.message) ? e.message : 'MIGRATION_FAILED', run] });
        }
        catch { }
        throw e;
    }
    finally {
        await c.execute({ sql: 'UPDATE _patch_migration_lock SET owner=NULL,lease_until=0 WHERE owner=? AND fence=?', args: [owner, fence] });
    }
}
