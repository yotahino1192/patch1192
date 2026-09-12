import { runAi } from '../lib/ai/control.ts';
import { execution } from '../lib/ai/execution.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';
import { migrate } from '../scripts/infra/migrations.mjs';
import { backup, restoreCheck } from '../scripts/infra/backup.mjs';
import { createDatabase } from '../db/client.ts';
registerHooks({ resolve(specifier, context, next) { if (specifier === './client')
        return { url: 'data:text/javascript,export function database(){return globalThis.__infraRestoreDb} export async function initializeDatabase(){await globalThis.__infraRestoreDb.initialize()}', shortCircuit: true }; if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier))
        return next(new URL(specifier + '.ts', context.parentURL).href, context); return next(specifier, context); } });
const store = await import('../db/store.ts');
test('encrypted backup restores exact rowids, owners, operation dedup, undo and session recovery', async () => { const dir = await mkdtemp(join(tmpdir(), 'patch-backup-')), c = createClient({ url: ':memory:' }), key = randomBytes(32); try {
    await migrate(c);
    globalThis.__infraRestoreDb = createDatabase(c);
    await c.execute("INSERT INTO users VALUES ('owner','now')");
    const set = await store.saveGeneratedSet('owner', { title: 'Private', category: 'Test', summary: '', keyPoints: [], sourceContent: 'Private content', cards: [{ question: 'Q', answer: 'A', format: 'qa', choices: [], difficulty: 1 }] });
    const card = (await store.loadAppData('owner')).sets[0].cards[0];
    const op = { operationId: 'op-test', expectedReviewCount: 0 };
    const review = await store.reviewCard('owner', card.id, 'good', 100, 'session-test', op);
    await c.execute('UPDATE review_logs SET rowid=1234');
    await runAi(globalThis.__infraRestoreDb, 'owner', 'cards', 'restore-unique-key', {}, async () => { await execution.getStore().dispatch(); return { restored: true }; });
    await backup(c, { directory: join(dir, 'backup'), key, dbIdentifier: 'isolated', releaseSha: 'test' });
    assert.ok(!(await readFile(join(dir, 'backup', 'snapshot.enc'))).includes(Buffer.from('Private content')));
    await restoreCheck(join(dir, 'backup'), key, { verify: async (restored) => { globalThis.__infraRestoreDb = createDatabase(restored); assert.deepEqual(await runAi(globalThis.__infraRestoreDb, 'owner', 'cards', 'restore-unique-key', {}, async () => assert.fail('duplicate provider call')), { restored: true }); assert.equal((await restored.execute('SELECT rowid FROM review_logs')).rows[0].rowid, 1234); const data = await store.loadAppData('owner', ['session-test']); assert.equal(data.sessionReviews[0].id, review); assert.equal(await store.reviewCard('owner', card.id, 'good', 100, 'session-test', op), review); await store.undoReview('owner', review, 'session-test'); assert.equal((await store.loadAppData('owner')).sets.find(s => s.id === set).cards[0].reviewCount, 0); } });
    await assert.rejects(restoreCheck(join(dir, 'backup'), randomBytes(32)), /AUTHENTICATION/);
    const bytes = await readFile(join(dir, 'backup', 'snapshot.enc'));
    bytes[40] ^= 1;
    await writeFile(join(dir, 'backup', 'snapshot.enc'), bytes);
    await assert.rejects(restoreCheck(join(dir, 'backup'), key), /HASH/);
}
finally {
    c.close();
    await rm(dir, { recursive: true, force: true });
} });
