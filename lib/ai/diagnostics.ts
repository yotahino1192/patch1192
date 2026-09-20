// Dedicated metadata-only records. Never serialize an Error, body or arbitrary code/message.
const categories = new Set(['timeout', 'network', 'provider', 'parse', 'validation', 'persistence', 'pre_dispatch']);
const reasons = new Set(['admitted', 'dispatching', 'replay', 'denied', 'unknown', 'failed_final', 'failed_pre_dispatch', 'succeeded', 'operator_final', 'local_abandoned']);
const codes = new Set(['rate_limit_exceeded', 'insufficient_quota', 'invalid_api_key', 'invalid_request_error', 'server_error', 'model_not_found', 'context_length_exceeded', 'incomplete', 'refusal', 'empty_output', 'invalid_json', 'invalid_cards', 'invalid_choices']);
export function logAiDiagnostic(fields: Record<string, unknown>, sink: (line: string) => void = console.info) {
  const out: Record<string, string | number> = { event: 'ai_diagnostic', timestamp: new Date().toISOString() };
  for (const key of ['requestId', 'attemptId', 'blockerId']) {
    const value = fields[key];
    if (typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) out[key] = value;
  }
  if (typeof fields.keyHash === 'string' && /^[a-f0-9]{64}$/.test(fields.keyHash)) out.keyHash = fields.keyHash;
  if (fields.endpoint === 'cards' || fields.endpoint === 'chat') out.endpoint = fields.endpoint;
  for (const [key, values] of [['category', categories], ['reason', reasons], ['providerCode', codes]] as const) {
    if (typeof fields[key] === 'string' && values.has(fields[key])) out[key] = fields[key];
  }
  if (typeof fields.providerRequestId === 'string' && /^req_[a-zA-Z0-9_-]{1,100}$/.test(fields.providerRequestId)) out.providerRequestId = fields.providerRequestId;
  for (const key of ['status', 'providerStatus', 'costMicros', 'durationMs']) {
    const value = fields[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = Math.round(value);
  }
  try { sink(JSON.stringify(out)); } catch { /* Diagnostics must not change outcomes. */ }
}
