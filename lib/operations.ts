// Closed vocabulary only: no identifiers, payloads, credentials or raw errors.
const operations = new Set(['infrastructure', 'migration', 'backup', 'restore_check', 'database_check', 'deletion_worker', 'operations_check']);
const outcomes = new Set(['ok', 'failed', 'retry', 'idle', 'completed']);
export function operationEvent(operation: string, outcome: string, sink: (line: string) => void = console.info) {
  const record = { event: 'operation', operation: operations.has(operation) ? operation : 'infrastructure', outcome: outcomes.has(outcome) ? outcome : 'failed' };
  try { sink(JSON.stringify(record)); } catch { /* Logging must never affect the operation. */ }
}
export function requireWorkerSecret(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{32,256}$/.test(value) || /dummy|example|changeme|placeholder/i.test(value) || new Set(value).size < 8)
    throw new Error('ACCOUNT_DELETION_WORKER_SECRET');
  return value;
}
