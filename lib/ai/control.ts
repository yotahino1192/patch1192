import { privacyPermit, checkAiPrivacy } from './privacy.ts';
import { PrivacyError } from '../privacy-error.ts';
import { InputError } from '../api-input.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { Transaction } from '@libsql/client';
import type { createDatabase } from '../../db/client.ts';
import { AiError, ProviderError, execution, limits, costMicros, type Endpoint, type Execution } from './execution.ts';
import { logEvent } from '../safe-log.ts';
type Db = ReturnType<typeof createDatabase>;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map(k => JSON.stringify(k) + ':' + canonical(record[k])).join(',') + '}';
}
const clock = async (tx: Transaction) => Number((await tx.execute("SELECT CAST(strftime('%s','now') AS INTEGER)*1000 AS now")).rows[0].now);
const active = "state IN ('reserved','dispatching','unknown')";
const countCaps = { cards: [2, 5, 10, 100], chat: [6, 30, 60, 1000] };
const windows = [60000, 3600000, 86400000, 31 * 86400000]; // month = conservative rolling 31 days
export async function runAi<T>(db: Db, userId: string, endpoint: Endpoint, key: string | null, payload: unknown, work: () => Promise<T>, finalize?: (tx: Transaction, result: T) => Promise<void>, validate?: () => Promise<void>): Promise<T> {
  // Gate even cached results before validation/key lookup; repeat under the admission lock.
  const permit = await db.transaction(tx => privacyPermit(tx, userId)).catch(e => { throw e instanceof PrivacyError ? e : new AiError('AI_DATABASE_UNAVAILABLE'); });
  await validate?.();
  if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw new AiError('IDEMPOTENCY_KEY_REQUIRED', 400);
  const keyHash = sha(key), fingerprint = sha(canonical({ endpoint, payload })), id = randomUUID();
  const reserveCost = costMicros(limits[endpoint].input, limits[endpoint].output);
  let prior;
  try {
    prior = await db.transaction(async tx => {
      await checkAiPrivacy(tx, permit);
      const now = await clock(tx);
      // No network call can start after its reservation expires. Dispatching never returns to reserved.
      await tx.execute({ sql: "UPDATE ai_requests SET state='failed_pre_dispatch',cost_micros=0 WHERE state='reserved' AND lease_until<=?", args: [now] });
      await tx.execute({ sql: "UPDATE ai_requests SET state='unknown' WHERE state='dispatching' AND lease_until<=?", args: [now] });
      await tx.execute({ sql: "UPDATE ai_requests SET state='expired',result_json=NULL WHERE state='succeeded' AND result_until<=?", args: [now] });
      const existing = (await tx.execute({ sql: 'SELECT * FROM ai_requests WHERE user_id=? AND key_hash=?', args: [userId, keyHash] })).rows[0];
      if (existing) {
        await checkAiPrivacy(tx, { userId, generation: Number(existing.generation), revision: Number(existing.consent_revision) });
        return existing;
      }
      const operation = payload && typeof payload === 'object' && 'operationId' in payload ? String(payload.operationId) : key;
      const legacy = (await tx.execute({ sql: 'SELECT 1 FROM ai_operations WHERE user_id=? AND operation_id=?', args: [userId, operation] })).rows.length;
      if (legacy) throw new AiError('AI_OPERATION_ALREADY_STARTED', 409);
      if (process.env.AI_ENABLED === 'false' || (await tx.execute('SELECT enabled FROM ai_control WHERE id=1')).rows[0]?.enabled !== 1) throw new AiError('AI_STOPPED');
      const running = (await tx.execute({ sql: `SELECT count(*) total,coalesce(sum(user_id=?),0) own FROM ai_requests WHERE ${active}`, args: [userId] })).rows[0];
      if (Number(running.own) >= 1 || Number(running.total) >= 10) throw new AiError('AI_CONCURRENCY_LIMIT', 429);
      // One database write transaction serializes admission across every process/user/endpoint.
      for (let i = 0; i < windows.length; i++) {
        const r = (await tx.execute({ sql: `SELECT count(*) total,coalesce(sum(endpoint=?),0) kind,coalesce(sum(user_id=? AND endpoint=?),0) own,coalesce(sum(cost_micros),0) cost,coalesce(sum(CASE WHEN user_id=? THEN cost_micros ELSE 0 END),0) own_cost FROM ai_requests WHERE created_at>? OR ${active}`, args: [endpoint, userId, endpoint, userId, now - windows[i]] })).rows[0];
        if (Number(r.own) >= countCaps[endpoint][i] || (i === 0 && (Number(r.kind) >= (endpoint === 'cards' ? 10 : 20) || Number(r.total) >= 30)) || (i === 1 && Number(r.total) >= 1000) || (i === 2 && Number(r.total) >= 5000)) throw new AiError('AI_RATE_LIMIT', 429);
        const globalCost = [Infinity, 1e6, 5e6, 30e6][i], userCost = [Infinity, Infinity, 150000, 1e6][i];
        if (Number(r.cost) + reserveCost > globalCost || Number(r.own_cost) + reserveCost > userCost) throw new AiError('AI_COST_LIMIT', 429);
      }
      await tx.execute({ sql: "INSERT INTO ai_requests(id,user_id,key_hash,payload_hash,endpoint,state,created_at,lease_until,result_until,cost_micros,generation,consent_revision) VALUES(?,?,?,?,?,'reserved',?,?,?,?,?,?)", args: [id, userId, keyHash, fingerprint, endpoint, now, now + 30000, now + 86400000, reserveCost, permit.generation, permit.revision] });
      await tx.execute({ sql: 'INSERT INTO ai_operations VALUES(?,?,?,?,?,?,?,?)', args: [userId, operation, endpoint, fingerprint, permit.generation, permit.revision, 'started', new Date(now).toISOString()] });
      return undefined;
    });
  } catch (e) { logEvent('ai_denied', { endpoint, status: e instanceof AiError ? e.status : 503 }); throw e instanceof AiError || e instanceof PrivacyError ? e : new AiError('AI_DATABASE_UNAVAILABLE'); }
  if (prior) {
    if (prior.payload_hash !== fingerprint) throw new AiError('IDEMPOTENCY_CONFLICT', 409);
    if (prior.state === 'succeeded') return JSON.parse(String(prior.result_json)) as T;
    throw new AiError(prior.state === 'expired' ? 'AI_RESULT_EXPIRED' : prior.state === 'unknown' ? 'AI_UNKNOWN' : ['reserved', 'dispatching'].includes(String(prior.state)) ? 'AI_IN_PROGRESS' : 'AI_REQUEST_FINAL', prior.state === 'expired' ? 410 : 409);
  }
  let dispatched = false;
  const start = Date.now();
  const context: Execution = { endpoint, dispatch: async () => {
    if (dispatched) throw new AiError('AI_DUPLICATE_DISPATCH');
    await db.transaction(async tx => {
      await checkAiPrivacy(tx, permit);
      const now = await clock(tx);
      if (process.env.AI_ENABLED === 'false' || (await tx.execute('SELECT enabled FROM ai_control WHERE id=1')).rows[0]?.enabled !== 1) throw new AiError('AI_STOPPED');
      const changed = await tx.execute({ sql: "UPDATE ai_requests SET state='dispatching',lease_until=? WHERE id=? AND state='reserved' AND lease_until>?", args: [now + 120000, id, now] });
      if (changed.rowsAffected !== 1) throw new AiError('AI_RESERVATION_LOST');
    });
    dispatched = true;
  } };
  try {
    const result = await execution.run(context, work);
    if (!dispatched) throw new AiError('AI_NOT_DISPATCHED');
    const usage = context.usage;
    const charged = usage ? costMicros(usage.input, usage.output) : reserveCost;
    await db.transaction(async tx => {
      await checkAiPrivacy(tx, permit);
      const row = (await tx.execute({ sql: 'SELECT state FROM ai_requests WHERE id=?', args: [id] })).rows[0];
      if (row?.state !== 'dispatching') throw new AiError('AI_UNKNOWN');
      await finalize?.(tx, result);
      await tx.execute({ sql: "UPDATE ai_requests SET state='succeeded',result_json=?,cost_micros=?,input_tokens=?,output_tokens=? WHERE id=?", args: [JSON.stringify(result), charged, usage?.input ?? null, usage?.output ?? null, id] });
      if (charged > reserveCost) await tx.execute('UPDATE ai_control SET enabled=0 WHERE id=1');
    });
    logEvent('ai_complete', { endpoint, durationMs: Date.now() - start, costMicros: charged, inputTokens: usage?.input, outputTokens: usage?.output });
    return result;
  } catch (e) {
    const state = !dispatched ? 'failed_pre_dispatch' : e instanceof PrivacyError || e instanceof ProviderError && !e.uncertain ? 'failed_final' : 'unknown';
    try { await db.transaction(async tx => {
      // A lost COMMIT acknowledgement must never overwrite a committed success.
      await tx.execute({ sql: "UPDATE ai_requests SET state=?,cost_micros=CASE WHEN ?='failed_pre_dispatch' THEN 0 ELSE cost_micros END WHERE id=? AND state IN ('reserved','dispatching','unknown')", args: [state, state, id] });
    }); } catch { /* Durable dispatch marker retains the maximum reservation; never resend. */ }
    logEvent(state === 'unknown' ? 'ai_unknown' : 'ai_denied', { endpoint, status: 503 });
    if (e instanceof PrivacyError) throw e;
    if (state === 'unknown') throw new AiError('AI_UNKNOWN');
    if (!dispatched && e instanceof InputError) throw e;
    if (!dispatched && e instanceof Error && e.message === 'CARD_NOT_FOUND') throw new AiError('CARD_NOT_FOUND', 404);
    throw e instanceof AiError ? e : new AiError(state === 'failed_pre_dispatch' ? 'AI_PRE_DISPATCH_FAILED' : 'AI_PROVIDER_FAILED');
  }
}
export function aiErrorResponse(error: unknown): Response | undefined {
  if (!(error instanceof AiError)) return;
  return Response.json({ error: 'AI処理を完了できませんでした。状態不明の処理は自動再送されません。', code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store', ...(error.status === 429 ? { 'Retry-After': '60' } : {}) } });
}
