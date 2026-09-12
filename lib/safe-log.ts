// An allowlist, not regex redaction: untrusted strings, Error objects and nested data never pass.
const events = new Set(['ai_complete', 'ai_denied', 'ai_unknown', 'api_failed']);
export function logEvent(event: string, fields: Record<string, unknown> = {}, sink: (line: string) => void = console.info) {
  const out: Record<string, string | number> = { event: events.has(event) ? event : 'api_failed' };
  if (fields.endpoint === 'cards' || fields.endpoint === 'chat' || fields.endpoint === 'data') out.endpoint = fields.endpoint;
  for (const key of ['status', 'durationMs', 'inputTokens', 'outputTokens', 'costMicros']) {
    const value = fields[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = Math.round(value);
  }
  try { sink(JSON.stringify(out)); } catch { /* Telemetry must not change request outcome. */ }
}
