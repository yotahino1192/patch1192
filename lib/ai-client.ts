import type { ApiTransport } from './api-client';
// Store only a digest and UUID, scoped by internal account UUID. Never store the request body.
// Retain the key across reload/network failure/unknown. No automatic network retries.
export async function sendAi(transport: ApiTransport, url: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  if (typeof options.body !== 'string') throw new Error('AI_JSON_REQUIRED');
  const account = headers.get('X-Patch-Account');
  if (!account) throw new Error('AI_ACCOUNT_REQUIRED');
  const bytes = new TextEncoder().encode(JSON.stringify([account, url, options.body]));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
  const storageKey = 'patch.ai.' + digest;
  // If durable session storage is unavailable, fail before dispatch rather than lose retry identity.
  const storage = globalThis.sessionStorage;
  const key = headers.get('Idempotency-Key') || storage.getItem(storageKey) || crypto.randomUUID();
  storage.setItem(storageKey, key);
  headers.set('Idempotency-Key', key);
  const response = await transport(url, { ...options, headers });
  // Definitive completion allows a subsequent user action with identical input to be a new operation.
  // Ambiguous responses, non-terminal conflicts and transport exceptions preserve this key.
  let terminal = false;
  if (!response.ok) {
    try {
      const body = await response.clone().json();
      terminal = ['AI_REQUEST_FINAL', 'AI_RESULT_EXPIRED', 'AI_PROVIDER_FAILED', 'AI_NOT_CONFIGURED', 'AI_PRE_DISPATCH_FAILED'].includes(body && typeof body === 'object' && 'code' in body ? String(body.code) : '');
    } catch { /* An unreadable response is uncertain. */ }
  }
  if (terminal || response.ok || [400, 404, 413, 415, 422, 429].includes(response.status)) storage.removeItem(storageKey);
  return response;
}
