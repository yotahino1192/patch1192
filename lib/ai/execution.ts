import { AsyncLocalStorage } from 'node:async_hooks';
export type Endpoint = 'cards' | 'chat';
export const limits = { cards: { input: 24000, output: 6000 }, chat: { input: 12000, output: 1800 } } as const;
export class AiError extends Error {
  code: string; status: number;
  constructor(code: string, status = 503) { super(code); this.code = code; this.status = status; }
}
export class ProviderError extends Error {
  uncertain: boolean;
  constructor(uncertain: boolean) { super('AI_PROVIDER_FAILED'); this.uncertain = uncertain; }
}
export type Execution = { endpoint: Endpoint; dispatch: () => Promise<void>; usage?: { input: number; output: number } };
export const execution = new AsyncLocalStorage<Execution>();
// UTF-8 bytes plus protocol allowance is deliberately conservative: no token-count network request.
// Includes instructions, schema and all history, not only user input.
export function inputUpperBound(body: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(body), 'utf8') + 512;
}
export function costMicros(input: number, output: number) { return Math.ceil((input + 8 * output) / 20); }
