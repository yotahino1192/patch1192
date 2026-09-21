import { environment, safeOrigin } from '../../lib/env/public.ts';
import { requireWorkerSecret } from '../../lib/operations.ts';

// Explicit invocation only. No retries: persistent worker leases/backoff remain authoritative.
export async function callDeletionWorker(input, policy, confirmedEnvironment, fetcher = fetch) {
  const stage = environment(input);
  if (!['staging', 'production'].includes(stage) || confirmedEnvironment !== stage) throw Error('WORKER_TARGET_CONFIRMATION_REQUIRED');
  const origin = safeOrigin(input.PATCH_API_ORIGIN || '', 'API_ORIGIN', true);
  if (input.PATCH_API_ORIGIN !== origin || !policy[stage].apiOrigins.includes(origin)) throw Error('API_ALLOWLIST');
  const secret = requireWorkerSecret(input.ACCOUNT_DELETION_WORKER_SECRET);
  const response = await fetcher(origin + '/api/internal/account-deletions', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error', signal: AbortSignal.timeout(55000),
  });
  if (!response.ok) { await response.body?.cancel(); throw Error('WORKER_HTTP_FAILED'); }
  const result = await response.json();
  if (result?.processed === false) return 'idle';
  if (result?.processed === true && ['completed', 'retry'].includes(result.state)) return result.state;
  throw Error('WORKER_RESPONSE_INVALID');
}

// Aggregate-only, read-only snapshot. Include expired dispatch leases even without new AI traffic.
export async function operationsStatus(client, now = Date.now()) {
  const ai = (await client.execute({ sql: `SELECT count(*) unresolved,
    coalesce(sum(state='unknown'),0) unknown_count,
    coalesce(sum(state='dispatching' AND lease_until<=?),0) expired_dispatches,
    coalesce(sum(state='reserved' AND lease_until<=?),0) expired_reservations,
    coalesce(max(?-created_at),0) oldest_ms FROM ai_requests WHERE state IN ('reserved','dispatching','unknown')`, args: [now, now, now] })).rows[0];
  const deletion = (await client.execute({ sql: `SELECT count(*) pending,
    coalesce(sum(state='retry'),0) retry_count,
    coalesce(sum(next_attempt_at<=? AND lease_until<=?),0) due,
    coalesce(sum(last_error='APPLE_REVOCATION_REQUIRED'),0) apple_blocked,
    coalesce(max(?-CAST(strftime('%s',created_at) AS INTEGER)*1000),0) oldest_ms
    FROM account_deletion_jobs WHERE state<>'completed'`, args: [now, now, now] })).rows[0];
  const numbers = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Math.max(0, Number(value))]));
  return { event: 'operations_status', ai: numbers(ai), deletion: numbers(deletion) };
}
