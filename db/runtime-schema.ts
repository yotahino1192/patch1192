import type { Client } from '@libsql/client';
import manifest from '../config/schema-manifest.json' with { type: 'json' };
import { hash, schema, SchemaNotReady } from '../scripts/infra/schema.mjs';
import type { ReadinessMeasure } from '../lib/reliability/readiness-diagnostics.ts';
export { SchemaNotReady };
/** All SQL on this path is read-only. No runner, scratch database, or DDL. */
export async function checkSchema(client: Client, measure: ReadinessMeasure = async (_stage, action) => action()): Promise<void> {
  try {
    // The first read-only batch proves connectivity and fetches the ledger.
    const results = await measure('database', () => client.batch([
      'SELECT 1 AS connected',
      'SELECT name,checksum,status FROM _patch_migrations ORDER BY name',
    ], 'read'));
    await measure('migration', () => {
      if (results.length !== 2 || results[0].rows.length !== 1 || Number(results[0].rows[0].connected) !== 1) throw new SchemaNotReady();
      const rows = results[1].rows;
      if (rows.length !== manifest.migrations.length || rows.some((r,i) => r.name !== manifest.migrations[i].name || r.checksum !== manifest.migrations[i].checksum || r.status !== 'applied')) throw new SchemaNotReady();
    });
    await measure('schema', async () => {
      if (hash(JSON.stringify(await schema(client))) !== manifest.schemaChecksum) throw new SchemaNotReady();
    });
  } catch { throw new SchemaNotReady(); }
}
