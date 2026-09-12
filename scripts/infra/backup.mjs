import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@libsql/client';
import { loadMigrations, validateDatabase, hash } from './migrations.mjs';
const quote = name => '"' + name.replaceAll('"', '""') + '"';
export function backupKey(value) { if (!/^[a-fA-F0-9]{64}$/.test(value || ''))
    throw new Error('BACKUP_KEY_REQUIRED'); return Buffer.from(value, 'hex'); }
const encode = v => typeof v === 'bigint' ? { bigint: String(v) } : v instanceof Uint8Array || v instanceof ArrayBuffer ? { blob: Buffer.from(v).toString('base64') } : v;
const decode = v => v && typeof v === 'object' ? 'bigint' in v ? BigInt(v.bigint) : 'blob' in v ? Buffer.from(v.blob, 'base64') : v : v;
export async function backup(c, { directory, key, dbIdentifier, releaseSha, keyId = 'v1' }) {
    // A read transaction pins one consistent snapshot; remote timeout means fail, never partial backup.
    const tx = await c.transaction('read');
    let payload, info;
    try {
        const migrations = await loadMigrations();
        const applied = (await tx.execute('SELECT name FROM _patch_migrations ORDER BY name')).rows;
        if (!applied.length || applied.length > migrations.length)
            throw new Error('BACKUP_SCHEMA_UNSUPPORTED');
        info = await validateDatabase(tx, migrations.slice(0, applied.length));
        const objects = (await tx.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows;
        const tables = [];
        for (const object of objects.filter(r => r.type === 'table')) {
            const name = String(object.name);
            if (['_patch_migration_lock', '_patch_migration_runs'].includes(name))
                continue;
            if (/WITHOUT\s+ROWID/i.test(String(object.sql)))
                throw new Error('BACKUP_TABLE_FORMAT_UNSUPPORTED');
            const result = await tx.execute(`SELECT rowid AS __patch_rowid__, * FROM ${quote(name)} ORDER BY rowid`);
            tables.push({ name, sql: object.sql, columns: result.columns, rows: result.rows.map(r => result.columns.map(col => encode(r[col]))) });
        }
        payload = { tables, objects: objects.filter(r => r.type !== 'table') };
        await tx.commit();
    }
    catch (e) {
        try {
            await tx.rollback();
        }
        catch { }
        throw e;
    }
    finally {
        tx.close();
    }
    const meta = { version: 1, migrationCount: info.migrations.length, schemaChecksum: info.schemaChecksum, releaseSha, backupTimestamp: new Date().toISOString(), dbIdentifier, keyId, tableRowCounts: Object.fromEntries(payload.tables.map(t => [t.name, t.rows.length])), contentHash: hash(JSON.stringify(payload)) };
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(meta)));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const bytes = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, 'snapshot.enc'), bytes, { mode: 0o600, flag: 'wx' });
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({ ...meta, artifactHash: hash(bytes) }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    return meta;
}
export async function restoreCheck(directory, key, { verify } = {}) {
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    const bytes = await readFile(join(directory, 'snapshot.enc'));
    const { artifactHash, ...meta } = manifest;
    if (hash(bytes) !== artifactHash)
        throw new Error('BACKUP_HASH_MISMATCH');
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    decipher.setAAD(Buffer.from(JSON.stringify(meta)));
    let payload;
    try {
        payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    }
    catch {
        throw new Error('BACKUP_AUTHENTICATION_FAILED');
    }
    if (hash(JSON.stringify(payload)) !== meta.contentHash)
        throw new Error('BACKUP_CONTENT_MISMATCH');
    const scratch = await mkdtemp(join(tmpdir(), 'patch-restore-'));
    const url = 'file:' + resolve(scratch, 'restore.db'), c = createClient({ url });
    try {
        const tx = await c.transaction('write');
        try {
            // Preserve every original rowid explicitly (review/undo depend on this order).
            for (const t of payload.tables)
                await tx.execute(t.sql);
            for (const t of payload.tables) {
                const columns = t.columns.map(name => name === '__patch_rowid__' ? 'rowid' : quote(name));
                for (const row of t.rows)
                    await tx.execute({ sql: `INSERT INTO ${quote(t.name)} (${columns.join(',')}) VALUES (${row.map(() => '?').join(',')})`, args: row.map(decode) });
            }
            for (const o of payload.objects)
                await tx.execute(o.sql);
            await tx.commit();
        }
        catch (e) {
            await tx.rollback();
            throw e;
        }
        finally {
            tx.close();
        }
        const migrations = await loadMigrations();
        if (!Number.isSafeInteger(meta.migrationCount) || meta.migrationCount < 1 || meta.migrationCount > migrations.length)
            throw new Error('RESTORE_SCHEMA_UNSUPPORTED');
        const result = await validateDatabase(c, migrations.slice(0, meta.migrationCount));
        if (result.schemaChecksum !== meta.schemaChecksum)
            throw new Error('RESTORE_SCHEMA_MISMATCH');
        for (const t of payload.tables) {
            const rows = (await c.execute(`SELECT rowid AS __patch_rowid__, * FROM ${quote(t.name)} ORDER BY rowid`)).rows.map(r => t.columns.map(col => encode(r[col])));
            if (rows.length !== meta.tableRowCounts[t.name] || hash(JSON.stringify(rows)) !== hash(JSON.stringify(t.rows)))
                throw new Error('RESTORE_ROWS_MISMATCH');
        }
        if ((await c.execute('PRAGMA integrity_check')).rows.some(r => r.integrity_check !== 'ok'))
            throw new Error('RESTORE_INTEGRITY_INVALID');
        // Optional isolated behavioral verification is executed only AFTER exact data checks.
        await verify?.(c, url);
        return { schemaChecksum: result.schemaChecksum, tableRowCounts: meta.tableRowCounts };
    }
    finally {
        c.close();
        await rm(scratch, { recursive: true, force: true });
    }
}
