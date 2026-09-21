import { readFile } from 'node:fs/promises';
import { validateOperationsConfig } from './infra/operations-config.mjs';
// No environment loading, network, credentials or arbitrary values in output.
try {
  if (process.argv.length !== 2) throw Error('OPERATIONS_CONFIG_ARGUMENTS_INVALID');
  validateOperationsConfig(JSON.parse(await readFile('config/production-operations.json', 'utf8')));
  console.log('OPERATIONS_CONFIG_COMPLETE: verify referenced evidence and live services separately');
} catch (error) {
  console.error(/^OPERATIONS_CONFIG_[A-Za-z0-9_:.,]+$/.test(error?.message || '') ? error.message : 'OPERATIONS_CONFIG_UNREADABLE');
  process.exitCode = 1;
}
