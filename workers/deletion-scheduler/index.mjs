import policy from '../../config/release-policy.json' with { type: 'json' };
import { requireWorkerSecret } from '../../lib/operations.ts';

const API_TIMEOUT_MS = 55_000;
const PING_TIMEOUT_MS = 5_000;

async function deadline(action, milliseconds) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => action(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('TIMEOUT'));
        }, milliseconds);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

async function boundedText(response, limit, signal) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const chunks = [];
    let length = 0;
    while (true) {
      if (signal.aborted) throw new Error('TIMEOUT');
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { abort(); throw new Error('RESPONSE_INVALID'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}

function configuration(env) {
  if (env.PATCH_ENV !== 'production' ||
      !policy.production.apiOrigins.includes(env.PATCH_API_ORIGIN)) throw new Error('CONFIG_INVALID');
  // This runner has no DB/provider responsibilities. Reject accidental credential sharing.
  if (Object.keys(env).some(key => /^(TURSO_|CLERK_|OPENAI_|PATCH_BACKUP_)/.test(key))) throw new Error('CONFIG_INVALID');
  const secret = requireWorkerSecret(env.ACCOUNT_DELETION_WORKER_SECRET);
  const ping = env.HEALTHCHECKS_PING_URL;
  if (typeof ping !== 'string' || !/^https:\/\/hc-ping\.com\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(ping) || ping.includes(secret)) throw new Error('CONFIG_INVALID');
  if (!['true', 'false'].includes(env.VERCEL_PROTECTION_REQUIRED)) throw new Error('CONFIG_INVALID');
  const headers = { Authorization: `Bearer ${secret}` };
  if (env.VERCEL_PROTECTION_REQUIRED === 'true') {
    const bypass = requireWorkerSecret(env.VERCEL_AUTOMATION_BYPASS_SECRET);
    if (bypass === secret || ping.includes(bypass)) throw new Error('CONFIG_INVALID');
    headers['x-vercel-protection-bypass'] = bypass;
  } else if (env.VERCEL_AUTOMATION_BYPASS_SECRET) throw new Error('CONFIG_INVALID');
  return { url: env.PATCH_API_ORIGIN + '/api/internal/account-deletions', headers, ping };
}

async function invoke(config, fetcher) {
  try {
    return await deadline(async signal => {
      const response = await fetcher(config.url, { method: 'POST', headers: config.headers, redirect: 'error', signal });
      if (response.status !== 200) { await response.body?.cancel(); return 'http_error'; }
      if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel(); return 'response_invalid';
      }
      let result;
      try { result = JSON.parse(await boundedText(response, 4096, signal)); }
      catch (error) { if (signal.aborted || error.message === 'TIMEOUT') throw new Error('TIMEOUT'); return 'response_invalid'; }
      if (result?.processed === false && result.state === undefined) return 'idle';
      if (result?.processed === true && ['completed', 'retry'].includes(result.state)) return result.state;
      return 'response_invalid';
    }, API_TIMEOUT_MS);
  } catch (error) { return error.message === 'TIMEOUT' ? 'timeout' : 'network_error'; }
}

async function ping(config, outcome, fetcher) {
  const suffix = ['idle', 'completed'].includes(outcome) ? '' : '/fail';
  try {
    return await deadline(async signal => {
      // Separate capability; never send the worker/bypass credential or API response to Healthchecks.
      const response = await fetcher(config.ping + suffix, { method: 'POST', redirect: 'error', signal });
      if (response.status !== 200) { await response.body?.cancel(); return 'failed'; }
      return (await boundedText(response, 64, signal)).trim() === 'OK' ? 'ok' : 'failed';
    }, PING_TIMEOUT_MS);
  } catch { return 'failed'; }
}

export async function runScheduled(env, { fetcher = fetch, sink = console.info } = {}) {
  let outcome, heartbeat = 'not_sent';
  if (env.SCHEDULER_ENABLED === 'false') outcome = 'disabled';
  else {
    let config;
    try {
      if (env.SCHEDULER_ENABLED !== 'true') throw new Error('CONFIG_INVALID');
      config = configuration(env);
    } catch { outcome = 'config_invalid'; }
    if (config) { outcome = await invoke(config, fetcher); heartbeat = await ping(config, outcome, fetcher); }
  }
  const result = { event: 'deletion_scheduler', outcome, heartbeat };
  try { sink(JSON.stringify(result)); } catch { /* Never expose a raw sink error. */ }
  return result;
}

const worker = {
  // No publicly callable/manual deletion endpoint on the Worker.
  fetch() { return new Response(null, { status: 404 }); },
  scheduled(controller, env, ctx) {
    void controller;
    ctx.waitUntil(runScheduled(env).then(result => {
      if (result.outcome !== 'disabled' &&
          (!['idle', 'completed'].includes(result.outcome) || result.heartbeat !== 'ok')) {
        throw new Error('DELETION_SCHEDULER_ATTENTION_REQUIRED');
      }
    }));
  },
};

export default worker;
