import { command, target } from './infra/cli.mjs';
import { createDatabase } from '../db/client.ts';
await command(async () => {
  const action = process.argv[2];
  if (!['status', 'stop', 'resume', 'resolve-final'].includes(action)) throw Error('AI_ACTION_REQUIRED');
  const { client, options } = target({ write: action !== 'status' });
  try {
    const db = createDatabase(client);
    await db.initialize();
    if (action === 'status') {
      const rows = (await client.execute("SELECT state,count(*) AS requests,sum(cost_micros) AS cost_micros FROM ai_requests WHERE created_at>CAST(strftime('%s','now') AS INTEGER)*1000-2678400000 OR state IN ('reserved','dispatching','unknown') GROUP BY state")).rows;
      console.info(JSON.stringify({ enabled: (await client.execute('SELECT enabled FROM ai_control WHERE id=1')).rows[0]?.enabled, windows: 'rolling_31_days_plus_unresolved', states: rows }));
      return;
    }
    await db.transaction(async tx => {
      if (action === 'stop') await tx.execute('UPDATE ai_control SET enabled=0 WHERE id=1');
      if (action === 'resume') {
        if (!options.has('--confirm-reviewed')) throw Error('AI_REVIEW_REQUIRED');
        if ((await tx.execute("SELECT 1 FROM ai_requests WHERE state IN ('unknown','dispatching','reserved') LIMIT 1")).rows.length) throw Error('AI_UNRESOLVED_REQUESTS');
        await tx.execute('UPDATE ai_control SET enabled=1 WHERE id=1');
      }
      if (action === 'resolve-final') {
        if (!options.has('--confirm-provider-final') || !options.has('--retain-maximum-cost')) throw Error('AI_PROVIDER_RECONCILIATION_REQUIRED');
        const id = options.get('--request');
        if (!/^[a-f0-9-]{36}$/.test(id || '')) throw Error('AI_REQUEST_ID_REQUIRED');
        const changed = await tx.execute({ sql: "UPDATE ai_requests SET state='failed_final' WHERE id=? AND state IN ('unknown','dispatching') AND lease_until<CAST(strftime('%s','now') AS INTEGER)*1000", args: [id] });
        if (changed.rowsAffected !== 1) throw Error('AI_REQUEST_NOT_RESOLVABLE');
      }
    });
    console.info('AI_CONTROL_UPDATED');
  } finally { client.close(); }
});
