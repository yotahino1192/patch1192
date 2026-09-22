import type { ApiTransport } from './api-client';
// Store only a digest and UUID, scoped by internal account UUID. Never store the request body.
// Retain the key across reload/network failure/unknown. No automatic network retries.
export async function sendAi(transport: ApiTransport, url: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  if (typeof options.body !== 'string') throw new Error('AI_JSON_REQUIRED');
  const account = headers.get('X-Patch-Account');
  if (!account) throw new Error('AI_ACCOUNT_REQUIRED');
  const payload = JSON.parse(options.body) as Record<string, unknown>;
  const fingerprintPayload = { ...payload };
  delete fingerprintPayload.operationId;
  const bytes = new TextEncoder().encode(JSON.stringify([account, url, fingerprintPayload]));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
  const storageKey = 'patch.ai.' + digest;
  // If durable session storage is unavailable, fail before dispatch rather than lose retry identity.
  const storage = globalThis.sessionStorage;
  const key = headers.get('Idempotency-Key') || storage.getItem(storageKey) || (typeof payload.operationId === 'string' ? payload.operationId : crypto.randomUUID());
  storage.setItem(storageKey, key);
  headers.set('Idempotency-Key', key);
  // Privacy's operationId must remain the same on an uncertain retry, even if the UI minted another UUID.
  const body = headers.has('Idempotency-Key') && options.headers && new Headers(options.headers).has('Idempotency-Key') ? options.body : JSON.stringify({ ...payload, operationId: key });
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  // Native HTTP may ignore abort. Independently fence the operation at the API.
  const cancel = () => { void transport(url.replace(/\/(cards|chat)$/, '/cancel'), {
    method:'POST', headers, body:JSON.stringify({operationKey:key}),
    credentials:options.credentials, cache:'no-store', redirect:'error',
  }).catch(()=>{ /* Offline: local fences still suppress the response; server delivery is best effort. */ }); };
  options.signal?.addEventListener('abort',cancel,{once:true});
  try {
  const response = await transport(url, { ...options, body, headers });
  // Definitive completion allows a subsequent user action with identical input to be a new operation.
  // Ambiguous responses, non-terminal conflicts and transport exceptions preserve this key.
  let terminal = false;
  let complete = false;
  if (response.ok) {
    try { await response.clone().json(); complete = true; }
    catch { /* A 2xx header alone does not prove the result arrived intact. */ }
  }
  if (!response.ok) {
    try {
      const body = await response.clone().json();
      terminal = ['AI_REQUEST_CANCELLED', 'AI_REQUEST_FINAL', 'AI_RESULT_EXPIRED', 'AI_PROVIDER_FAILED', 'AI_INVALID_GENERATED_CONTENT', 'AI_NOT_CONFIGURED', 'AI_PRE_DISPATCH_FAILED'].includes(body && typeof body === 'object' && 'code' in body ? String(body.code) : '');
    } catch { /* An unreadable response is uncertain. */ }
  }
  if (!options.signal?.aborted && (terminal || complete || [400, 404, 413, 415, 422, 429].includes(response.status))) storage.removeItem(storageKey);
  return response;
  } finally { options.signal?.removeEventListener('abort',cancel); }
}
