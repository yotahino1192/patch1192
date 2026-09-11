export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

// Check bytes while reading, before allocating/parsing an unbounded JSON body.
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new InputError('JSON形式で送信してください。', 415);
  const limit = 2 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit) throw new InputError('送信内容が大きすぎます。', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('送信内容を確認してください。');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new InputError('送信内容が大きすぎます。', 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new InputError('JSONの内容を確認してください。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('送信内容を確認してください。');
  return value as Record<string, unknown>;
}
export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
}
export function boundedText(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || Boolean(value.trim()));
}
