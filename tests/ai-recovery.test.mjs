import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import { migrate } from '../scripts/infra/migrations.mjs';
import { createDatabase } from '../db/client.ts';
import { grantAi } from './ai-consent-fixture.mjs';
import { runAi } from '../lib/ai/control.ts';
import { execution, ProviderError } from '../lib/ai/execution.ts';
import { logAiDiagnostic } from '../lib/ai/diagnostics.ts';
import { buildGenerationError } from '../lib/build-generation-error.ts';

test('unknown retries, scoped local recovery, maximum reservations and account isolation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patch-ai-recovery-')), url = 'file:' + join(dir, 'db');
  const c = createClient({ url }), db = createDatabase(c);
  const key = randomUUID(); let calls = 0;
  const work = async () => { await execution.getStore().dispatch(); calls++; return {}; };
  const run = (...args) => execFileSync(process.execPath, ['scripts/ai-control.mjs', ...args, '--url', url], { env: { ...process.env, PATCH_ENV: 'development' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await migrate(c); await c.execute("INSERT INTO users(id,created_at) VALUES('a','now'),('b','now')");
    await grantAi(c, 'a'); await grantAi(c, 'b');
    await assert.rejects(runAi(db, 'a', 'cards', key, {}, async () => { await work(); throw new ProviderError(true, { category: 'timeout' }); }), { code: 'AI_UNKNOWN' });
    for (let i = 0; i < 3; i++) {
      await assert.rejects(runAi(db, 'a', 'cards', key, {}, work), { code: 'AI_UNKNOWN' });
      await assert.rejects(runAi(db, 'a', 'cards', randomUUID(), {}, work), { code: 'AI_PREVIOUS_UNRESOLVED' });
    }
    assert.equal(calls, 1);
    const row = (await c.execute('SELECT * FROM ai_requests')).rows[0];
    assert.equal(row.cost_micros, 3600);
    assert.equal((await c.execute('SELECT count(*) n FROM ai_operations')).rows[0].n, 1);
    await runAi(db, 'b', 'cards', key, {}, work);
    const other = (await c.execute("SELECT * FROM ai_requests WHERE user_id='b'")).rows;
    const flags = ['--request', row.id, '--confirm-local-worker-stopped', '--acknowledge-unknown-provider-outcome', '--retain-maximum-cost'];
    assert.throws(() => run('resolve-local-unknown', ...flags, '--user', 'a'), 'lease must expire');
    await c.execute({ sql: 'UPDATE ai_requests SET lease_until=0 WHERE id=?', args: [row.id] });
    assert.throws(() => run('resolve-local-unknown', '--request', row.id));
    assert.throws(() => run('resolve-local-unknown', ...flags, '--user', 'b'));
    assert.match(run('resolve-local-unknown', ...flags, '--user', 'a'), /local_abandoned/);
    assert.deepEqual((await c.execute("SELECT * FROM ai_requests WHERE user_id='b'")).rows, other);
    assert.deepEqual((await c.execute({ sql: 'SELECT state,cost_micros FROM ai_requests WHERE id=?', args: [row.id] })).rows[0], { state: 'failed_final', cost_micros: 3600 });
    await assert.rejects(runAi(db, 'a', 'cards', key, {}, work), { code: 'AI_REQUEST_FINAL' });
    await runAi(db, 'a', 'cards', randomUUID(), {}, work);
    assert.equal(calls, 3); // one uncertain call, other account, then explicit new operation
    assert.equal((await c.execute("SELECT count(*) n FROM ai_requests WHERE state IN ('reserved','dispatching','unknown')")).rows[0].n, 0);
    assert.equal((await c.execute('SELECT sum(cost_micros) n FROM ai_requests')).rows[0].n, 10800);
  } finally { c.close(); await rm(dir, { recursive: true, force: true }); }
});

test('generation distinguishes consent, unresolved, provider and generic failures', () => {
  assert.match(buildGenerationError('AI_CONSENT_REQUIRED'), /consent is required/);
  assert.match(buildGenerationError('AI_PREVIOUS_UNRESOLVED'), /administrator must resolve/);
  assert.equal(buildGenerationError('AI_UNKNOWN'), buildGenerationError('AI_PREVIOUS_UNRESOLVED'));
  assert.match(buildGenerationError('AI_PROVIDER_FAILED'), /AI service could not/);
  assert.match(buildGenerationError(''), /check the request safely/);
  assert.match(buildGenerationError('', 'timeout'), /connection was interrupted/);
  assert.match(buildGenerationError('', 'offline'), /Reconnect/);
  for (const code of ['AI_UNKNOWN', 'AI_PREVIOUS_UNRESOLVED', 'AI_PROVIDER_FAILED', '']) assert.doesNotMatch(buildGenerationError(code), /consent/);
});

test('diagnostics retain bounded metadata and exclude private or unrecognized values', () => {
  const lines = [], id = randomUUID();
  logAiDiagnostic({ requestId: id, attemptId: id, endpoint: 'cards', category: 'timeout', reason: 'unknown', providerStatus: 503, providerRequestId: 'req_test123', providerCode: 'server_error', body: 'private', source: 'private', prompt: 'private', email: 'private', secret: 'private', error: new Error('private') }, line => lines.push(JSON.parse(line)));
  assert.equal(lines[0].requestId, id); assert.equal(lines[0].providerCode, 'server_error');
  assert.ok(Date.parse(lines[0].timestamp)); assert.doesNotMatch(JSON.stringify(lines), /private/);
  logAiDiagnostic({ category: 'private', providerCode: 'private', providerRequestId: 'private', requestId: 'private' }, line => lines.push(JSON.parse(line)));
  assert.deepEqual(Object.keys(lines[1]).sort(), ['event', 'timestamp']);
});
