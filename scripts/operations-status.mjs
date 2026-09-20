import { command, target } from './infra/cli.mjs';
import { createDatabase } from '../db/client.ts';
import { operationsStatus } from './infra/operations.mjs';
await command(async () => {
  const { client } = target();
  try {
    await createDatabase(client).initialize();
    const status = await operationsStatus(client);
    console.info(JSON.stringify(status));
    if (status.ai.unknown_count || status.ai.expired_dispatches || status.ai.expired_reservations || status.deletion.apple_blocked || status.deletion.oldest_ms > 3600000)
      throw Error('OPERATIONS_ATTENTION_REQUIRED');
  } finally { client.close(); }
}, 'operations_check');
