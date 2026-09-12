import { grantAi } from './ai-consent-fixture.mjs';
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
registerHooks({ resolve(specifier, context, next) { if ((specifier === './client' || specifier === '../db/client'))
        return { url: 'data:text/javascript,export function database(){return globalThis.__infraRestoreDb} export async function initializeDatabase(){await globalThis.__infraRestoreDb.initialize()}', shortCircuit: true }; if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier))
        return next(new URL(specifier + '.ts', context.parentURL).href, context); return next(specifier, context); } });
const store = await import('../db/store.ts');
test('encrypted backup restores exact rowids, owners, operation dedup, undo and session recovery', async () => { const dir = await mkdtemp(join(tmpdir(), 'patch-backup-')), c = createClient({ url: ':memory:' }), key = randomBytes(32); try {
    await migrate(c);
    globalThis.__infraRestoreDb = createDatabase(c);
    await c.execute("INSERT INTO users (id,created_at) VALUES ('owner','now')");
    const set = await store.saveGeneratedSet('owner', { title: 'Private', category: 'Test', summary: '', keyPoints: [], sourceContent: 'Private content', cards: [{ question: 'Q', answer: 'A', format: 'qa', choices: [], difficulty: 1 }] });
    const card = (await store.loadAppData('owner')).sets[0].cards[0];
    const op = { operationId: 'op-test', expectedReviewCount: 0 };
    const review = await store.reviewCard('owner', card.id, 'good', 100, 'session-test', op);
    await c.execute('UPDATE review_logs SET rowid=1234');
    await grantAi(c,'owner');
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

test('backup restores Privacy evidence and resumes a pending deletion without touching another user',async()=>{
    const c=createClient({url:':memory:'}),dir=await mkdtemp(join(tmpdir(),'patch-privacy-backup-')),key=randomBytes(32);
    try{
        await migrate(c);globalThis.__infraRestoreDb=createDatabase(c);
        const {resolveInternalUser}=await import('../db/auth-store.ts');
        const {getConsent,setConsent}=await import('../db/privacy-store.ts');
        const {CONSENT_VERSION,POLICY_VERSION}=await import('../lib/privacy-policy.ts');
        const {createDeletionChallenge,requestDeletion}=await import('../db/account-deletion.ts');
        const {runDeletionJob}=await import('../lib/deletion-worker.ts');
        const issuer='https://restore-fixture.example',a=await resolveInternalUser(issuer,'user_restore_A'),b=await resolveInternalUser(issuer,'user_restore_B');
        const auth={issuer,subject:'user_restore_A',sessionId:'sess_restore_A',claims:{reverification_id:'before'}};
        const consent=await getConsent(a);
        await setConsent(a,{state:'granted',revision:0,operationId:crypto.randomUUID(),consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,textHash:consent.textHash,language:'ja'});
        await runAi(globalThis.__infraRestoreDb,a,'cards','pending-delete-backup-key',{},async()=>{await execution.getStore().dispatch();return {text:'private AI result'};});
        const challenge=await createDeletionChallenge(a,auth);
        await requestDeletion({...auth,claims:{reverification_id:'after',fva:[0,-1]}},{challengeId:challenge.challengeId,operationId:crypto.randomUUID(),receipt:'ab'.repeat(32)});
        await backup(c,{directory:join(dir,'backup'),key,dbIdentifier:'isolated',releaseSha:'test'});
        await restoreCheck(join(dir,'backup'),key,{verify:async restored=>{
            globalThis.__infraRestoreDb=createDatabase(restored);
            assert.equal((await getConsent(a)).state,'granted');
            await assert.rejects(resolveInternalUser(issuer,auth.subject),/ACCOUNT_DELETED/);
            const result=await runDeletionJob({inspectApple:async()=>false,deleteUser:async()=>{}});
            assert.equal(result.state,'completed');
            const ledger=(await restored.execute({sql:'SELECT result_json,cost_micros,state,key_hash,payload_hash,id FROM ai_requests WHERE user_id=?',args:[a]})).rows[0];
            assert.equal(ledger.result_json,null);assert.equal(ledger.cost_micros,3600);assert.equal(ledger.state,'expired');assert.equal(ledger.key_hash,ledger.id);assert.equal(ledger.payload_hash,ledger.id);
            assert.equal((await restored.execute({sql:'SELECT count(*) n FROM consent_events WHERE user_id=?',args:[a]})).rows[0].n,0);
            assert.equal((await restored.execute({sql:'SELECT lifecycle_state FROM users WHERE id=?',args:[b]})).rows[0].lifecycle_state,'active');
            await assert.rejects(restored.execute({sql:'INSERT INTO folders VALUES (?,?,?,?,?,?)',args:['late',a,null,'Late','now','now']}),/ACCOUNT_INACTIVE/);
        }});
    }finally{c.close();await rm(dir,{recursive:true,force:true});}
});
