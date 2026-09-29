import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import operations from '../config/production-operations.json' with { type: 'json' };
import plan from '../config/production-monitoring.plan.json' with { type: 'json' };
import worker, { runScheduled } from '../workers/deletion-scheduler/index.mjs';

const environment = () => ({
  SCHEDULER_ENABLED: 'true', PATCH_ENV: 'production', PATCH_API_ORIGIN: 'https://mepamo.com',
  ACCOUNT_DELETION_WORKER_SECRET: randomBytes(32).toString('hex'),
  HEALTHCHECKS_PING_URL: 'https://hc-ping.com/' + randomUUID(),
  VERCEL_PROTECTION_REQUIRED: 'true', VERCEL_AUTOMATION_BYPASS_SECRET: randomBytes(32).toString('hex'),
});
const quiet = () => {};

test('inert Worker and monitoring plan preserve approved timings without fabricating operational evidence', async () => {
  const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', await readFile(new URL('../workers/deletion-scheduler/wrangler.jsonc.example', import.meta.url), 'utf8'));
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.config.triggers.crons, []);
  assert.equal(parsed.config.vars.SCHEDULER_ENABLED, 'false');
  assert.equal(parsed.config.workers_dev, false); assert.equal(parsed.config.preview_urls, false);
  assert.equal(plan.status, 'planned-not-installed');
  assert.deepEqual(plan.uptimeRobot.monitors.map(m => [m.url, m.keyword]), [
    ['https://mepamo.com/api/health', '"status":"ok"'], ['https://mepamo.com/api/ready', '"status":"ready"'],
  ]);
  assert.equal(plan.uptimeRobot.intervalSeconds, 300);
  const [scheduler, status, backup] = plan.healthchecks.checks;
  assert.equal(scheduler.periodSeconds, operations.deletion.intervalSeconds);
  assert.equal(scheduler.periodSeconds + scheduler.graceSeconds, operations.deletion.heartbeatMinutes * 60);
  assert.equal(status.periodSeconds, operations.monitoring.statusIntervalMinutes * 60);
  assert.equal(status.periodSeconds + status.graceSeconds, operations.monitoring.statusHeartbeatMinutes * 60);
  assert.equal(backup.periodSeconds, operations.backup.intervalHours * 3600);
  assert.equal(backup.periodSeconds + backup.graceSeconds, operations.backup.maxSuccessAgeHours * 3600);
  assert.equal(plan.recurring.backupRetentionDays, operations.backup.retentionDays);
  assert.equal(plan.recurring.keyId, operations.backup.keyId);
  assert.equal(plan.recurring.backupMaxAgeHours, operations.backup.maxSuccessAgeHours);
});

test('disabled or invalid scheduler configuration cannot send any request', async () => {
  const good = environment();
  const cases = [
    { SCHEDULER_ENABLED: 'false' }, {}, { ...good, SCHEDULER_ENABLED: 'yes' },
    { ...good, PATCH_ENV: 'development' }, { ...good, PATCH_API_ORIGIN: 'https://unreviewed.vercel.app' },
    { ...good, PATCH_API_ORIGIN: good.PATCH_API_ORIGIN + '/' },
    { ...good, ACCOUNT_DELETION_WORKER_SECRET: '' },
    { ...good, TURSO_AUTH_TOKEN: 'must-never-be-used' }, { ...good, OPENAI_API_KEY: 'must-never-be-used' },
    { ...good, VERCEL_PROTECTION_REQUIRED: undefined }, { ...good, VERCEL_AUTOMATION_BYPASS_SECRET: '' },
    { ...good, VERCEL_AUTOMATION_BYPASS_SECRET: good.ACCOUNT_DELETION_WORKER_SECRET },
    { ...good, VERCEL_PROTECTION_REQUIRED: 'false' },
    ...['http://hc-ping.com/', 'https://other.example/', good.HEALTHCHECKS_PING_URL + '?secret=x',
      good.HEALTHCHECKS_PING_URL + '/fail', good.HEALTHCHECKS_PING_URL + '#fragment']
      .map(HEALTHCHECKS_PING_URL => ({ ...good, HEALTHCHECKS_PING_URL })),
  ];
  for (const env of cases) {
    let called = false;
    const result = await runScheduled(env, { sink: quiet, fetcher: async () => { called = true; throw Error('unexpected network'); } });
    assert.equal(called, false);
    assert.equal(result.outcome, env.SCHEDULER_ENABLED === 'false' ? 'disabled' : 'config_invalid');
  }
});

for (const [payload, outcome, suffix] of [
  [{ processed: false }, 'idle', ''], [{ processed: true, state: 'completed' }, 'completed', ''],
  [{ processed: true, state: 'retry', code: 'private-error-must-not-leak' }, 'retry', '/fail'],
]) test(`POST/Bearer + separate protection header; ${outcome} has correct heartbeat semantics`, async () => {
  const env = environment(), requests = [], lines = [];
  const result = await runScheduled(env, { sink: line => lines.push(line), fetcher: async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    if (requests.length === 1) {
      assert.equal(url, 'https://mepamo.com/api/internal/account-deletions');
      assert.deepEqual(options.headers, { Authorization: `Bearer ${env.ACCOUNT_DELETION_WORKER_SECRET}`,
        'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET });
      return Response.json(payload);
    }
    assert.equal(url, env.HEALTHCHECKS_PING_URL + suffix);
    assert.equal(options.headers, undefined); assert.equal(options.body, undefined);
    return new Response('OK');
  } });
  assert.equal(requests.length, 2);
  assert.deepEqual(result, { event: 'deletion_scheduler', outcome, heartbeat: 'ok' });
  assert.deepEqual(lines, [JSON.stringify(result)]);
  for (const value of [env.ACCOUNT_DELETION_WORKER_SECRET, env.VERCEL_AUTOMATION_BYPASS_SECRET, env.HEALTHCHECKS_PING_URL, 'private-error'])
    assert.equal(lines.join('').includes(value), false);
});

test('retry followed by idle never emits completed or replays a job; retry evidence remains explicit', async () => {
  const env = environment(), results = [], pings = [];
  for (const payload of [{ processed: true, state: 'retry' }, { processed: false }]) {
    await runScheduled(env, { sink: line => results.push(JSON.parse(line)), fetcher: async url => {
      if (url.startsWith('https://mepamo.com/')) return Response.json(payload);
      pings.push(url); return new Response('OK');
    } });
  }
  assert.deepEqual(results.map(r => r.outcome), ['retry', 'idle']);
  assert.deepEqual(pings, [env.HEALTHCHECKS_PING_URL + '/fail', env.HEALTHCHECKS_PING_URL]);
  // The second ping is scheduler liveness, never evidence that the retry backlog is clear.
});

test('HTTP failures, redirects, malformed/oversized JSON and network failures never become success or retry immediately', async () => {
  for (const [reply, outcome] of [
    [() => new Response('private text', { status: 503 }), 'http_error'],
    [() => new Response(null, { status: 302, headers: { location: 'https://other.example/' } }), 'http_error'],
    [() => new Response('<html>hosting login</html>'), 'response_invalid'],
    [() => new Response('{', { headers: { 'content-type': 'application/json' } }), 'response_invalid'],
    [() => Response.json({ processed: false, state: 'completed' }), 'response_invalid'],
    [() => Response.json({ processed: true, state: 'failed' }), 'response_invalid'],
    [() => Response.json({ processed: true, state: 'completed', extra: 'x'.repeat(5000) }), 'response_invalid'],
    [() => { throw Error('private network diagnostic'); }, 'network_error'],
  ]) {
    const env = environment(); let apiCalls = 0, pings = 0;
    const result = await runScheduled(env, { sink: quiet, fetcher: async url => {
      if (url.startsWith('https://mepamo.com/')) { apiCalls++; return reply(); }
      pings++; assert.equal(url, env.HEALTHCHECKS_PING_URL + '/fail'); return new Response('OK');
    } });
    assert.equal(result.outcome, outcome); assert.equal(apiCalls, 1); assert.equal(pings, 1);
  }
});

for (const bodyStall of [false, true]) test(`55s deadline covers ${bodyStall ? 'body stall' : 'request stall'} and sends failure heartbeat`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = environment(); let signal, started, canceled = false;
  const ready = new Promise(resolve => { started = resolve; });
  const promise = runScheduled(env, { sink: quiet, fetcher: async (url, options) => {
    if (url.startsWith('https://hc-ping.com/')) { assert.equal(url, env.HEALTHCHECKS_PING_URL + '/fail'); return new Response('OK'); }
    signal = options.signal; started();
    if (!bodyStall) return new Promise(() => {});
    return new Response(new ReadableStream({ cancel() { canceled = true; } }), { headers: { 'content-type': 'application/json' } });
  } });
  await ready;
  // Let the response reader attach before advancing the virtual deadline.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  t.mock.timers.tick(54_999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.deepEqual(await promise, { event: 'deletion_scheduler', outcome: 'timeout', heartbeat: 'ok' });
  assert.equal(signal.aborted, true); if (bodyStall) assert.equal(canceled, true);
});

test('missing/rate-limited Healthchecks acknowledgement and ping failures remain observable without rerunning deletion', async () => {
  for (const response of [() => new Response('OK (not found)'), () => new Response('OK (rate limited)'),
    () => new Response(null, { status: 500 }), () => { throw Error('private ping url'); }]) {
    let calls = 0;
    const result = await runScheduled(environment(), { sink: quiet, fetcher: async url => {
      calls++;
      return url.startsWith('https://mepamo.com/') ? Response.json({ processed: false }) : response();
    } });
    assert.equal(calls, 2); assert.equal(result.outcome, 'idle'); assert.equal(result.heartbeat, 'failed');
  }
});

test('heartbeat has its own 5s deadline; unprotected mode requires explicit choice and no bypass secret', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = environment(); env.VERCEL_PROTECTION_REQUIRED = 'false'; delete env.VERCEL_AUTOMATION_BYPASS_SECRET;
  let started; const ready = new Promise(resolve => { started = resolve; });
  const pending = runScheduled(env, { sink: quiet, fetcher: async (url, options) => {
    if (url.startsWith('https://mepamo.com/')) {
      assert.deepEqual(Object.keys(options.headers), ['Authorization']); return Response.json({ processed: false });
    }
    started(); return new Promise(() => {});
  } });
  await ready; t.mock.timers.tick(5000);
  assert.equal((await pending).heartbeat, 'failed');
});

test('Cloudflare entry has no HTTP trigger and waitUntil records retry as a failed invocation', async t => {
  assert.equal(worker.fetch().status, 404);
  t.mock.method(console, 'info', quiet);
  t.mock.method(globalThis, 'fetch', async url => url.startsWith('https://mepamo.com/') ?
    Response.json({ processed: true, state: 'retry' }) : new Response('OK'));
  let pending;
  worker.scheduled({}, environment(), { waitUntil(promise) { pending = promise; } });
  await assert.rejects(pending, /^Error: DELETION_SCHEDULER_ATTENTION_REQUIRED$/);
});
