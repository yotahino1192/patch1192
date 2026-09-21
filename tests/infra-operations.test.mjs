import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client';
import { callDeletionWorker, operationsStatus } from '../scripts/infra/operations.mjs';
import { operationEvent, requireWorkerSecret } from '../lib/operations.ts';
import { migrate } from '../scripts/infra/migrations.mjs';
import { command } from '../scripts/infra/cli.mjs';

test('worker contract rejects missing/placeholder secrets and requires explicit allowlisted target before network', async () => {
  for (const secret of [undefined, '', 'a'.repeat(64), 'changeme'.repeat(8), ' ' + randomBytes(32).toString('hex')]) assert.throws(() => requireWorkerSecret(secret));
  const input = { PATCH_ENV: 'production', PATCH_API_ORIGIN: 'https://api.patch-release.dev', ACCOUNT_DELETION_WORKER_SECRET: randomBytes(32).toString('base64url') };
  const policy = { production: { apiOrigins: [input.PATCH_API_ORIGIN] } };
  let calls = 0;
  const fetcher = async (url, options) => { calls++; assert.equal(url, input.PATCH_API_ORIGIN + '/api/internal/account-deletions'); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, `Bearer ${input.ACCOUNT_DELETION_WORKER_SECRET}`); assert.ok(options.signal); return Response.json({ processed: false }); };
  await assert.rejects(callDeletionWorker(input, policy, undefined, fetcher));
  await assert.rejects(callDeletionWorker({ ...input, PATCH_API_ORIGIN: 'https://other.patch-release.dev' }, policy, 'production', fetcher));
  await assert.rejects(callDeletionWorker({ ...input, ACCOUNT_DELETION_WORKER_SECRET: '' }, policy, 'production', fetcher));
  for (const origin of [input.PATCH_API_ORIGIN + '/', input.PATCH_API_ORIGIN + ':443'])
    await assert.rejects(callDeletionWorker({ ...input, PATCH_API_ORIGIN: origin }, policy, 'production', fetcher), /API_ALLOWLIST/);
  assert.equal(calls, 0);
  assert.equal(await callDeletionWorker(input, policy, 'production', fetcher), 'idle');
  for (const state of ['completed', 'retry']) assert.equal(await callDeletionWorker(input, policy, 'production', async () => Response.json({ processed: true, state })), state);
  let failures = 0;
  await assert.rejects(callDeletionWorker(input, policy, 'production', async () => { failures++; return new Response('private provider response', { status: 503 }); }), /WORKER_HTTP_FAILED/);
  assert.equal(failures, 1);
  await assert.rejects(callDeletionWorker(input, policy, 'production', async () => Response.json({ email: 'private' })), /WORKER_RESPONSE_INVALID/);
});

test('operational records reject arbitrary fields and errors; logging failures cannot affect work', async () => {
  const lines = [];
  operationEvent('email@example.com', 'private material', line => lines.push(JSON.parse(line)));
  assert.deepEqual(lines, [{ event: 'operation', operation: 'infrastructure', outcome: 'failed' }]);
  assert.doesNotThrow(() => operationEvent('backup', 'ok', () => { throw Error('sink down'); }));
  const info = console.info, error = console.error, code = process.exitCode;
  const output = [];
  try {
    console.info = console.error = line => output.push(line);
    await command(async () => { throw Error('private prompt and token'); }, 'backup');
    assert.equal(process.exitCode, 1);
    assert.ok(output.includes('{"event":"operation","operation":"backup","outcome":"failed"}'));
    assert.ok(!output.join('').includes('private prompt'));
  } finally { console.info = info; console.error = error; process.exitCode = code; }
});

test('read-only operations snapshot surfaces unknown/stale AI and deletion backlog without identifiers or changes', async () => {
  const c = createClient({ url: ':memory:' });
  try {
    await migrate(c);
    const now = Date.now();
    assert.equal((await operationsStatus(c, now)).ai.unresolved, 0);
    await c.execute("INSERT INTO users(id,created_at) VALUES('private-owner','now')");
    for (const state of ['unknown', 'dispatching', 'reserved']) await c.execute({ sql: 'INSERT INTO ai_requests(id,user_id,key_hash,payload_hash,endpoint,state,created_at,lease_until,result_until,cost_micros) VALUES(?,?,?,?,?,?,?,?,?,?)', args: [state, 'private-owner', state, 'private-payload', 'cards', state, now - 7200000, now - 1, now, 3600] });
    await c.execute({ sql: 'INSERT INTO account_deletion_jobs(id,user_id,issuer,subject,operation_id,receipt_hash,state,last_error,created_at) VALUES(?,?,?,?,?,?,?,?,?)', args: ['job', 'private-owner', 'private-issuer', 'private-subject', 'private-op', 'private-receipt', 'retry', 'APPLE_REVOCATION_REQUIRED', new Date(now - 7200000).toISOString()] });
    const before = (await c.execute('SELECT * FROM ai_requests')).rows;
    const result = await operationsStatus(c, now);
    assert.deepEqual(result.ai, { unresolved: 3, unknown_count: 1, expired_dispatches: 1, expired_reservations: 1, oldest_ms: 7200000 });
    assert.equal(result.deletion.pending, 1); assert.equal(result.deletion.due, 1); assert.equal(result.deletion.apple_blocked, 1);
    assert.ok(!JSON.stringify(result).includes('private'));
    assert.deepEqual((await c.execute('SELECT * FROM ai_requests')).rows, before);
  } finally { c.close(); }
});
