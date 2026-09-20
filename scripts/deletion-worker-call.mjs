import { env, options } from './infra/cli.mjs';
import { readPolicy } from '../lib/env/server.ts';
import { operationEvent } from '../lib/operations.ts';
import { callDeletionWorker } from './infra/operations.mjs';
try {
  const o = options();
  if (!o.has('--execute')) throw Error('EXECUTION_REQUIRED');
  const outcome = await callDeletionWorker(env(), readPolicy(), o.get('--confirm-env'));
  operationEvent('deletion_worker', outcome);
  if (outcome === 'retry') process.exitCode = 1;
} catch { operationEvent('deletion_worker', 'failed'); process.exitCode = 1; }
