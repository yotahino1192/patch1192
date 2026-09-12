import type { Client } from '@libsql/client';
import manifest from '../config/schema-manifest.json' with { type: 'json' };
import { hash, schema, SchemaNotReady } from '../scripts/infra/schema.mjs';
export { SchemaNotReady };
/** All SQL on this path is read-only. No runner, scratch database, or DDL. */
export async function checkSchema(client: Client): Promise<void> {
  try {
    const rows = (await client.execute('SELECT name,checksum,status FROM _patch_migrations ORDER BY name')).rows;
    if (rows.length !== manifest.migrations.length || rows.some((r,i) => r.name !== manifest.migrations[i].name || r.checksum !== manifest.migrations[i].checksum || r.status !== 'applied')) throw new SchemaNotReady();
    if (hash(JSON.stringify(await schema(client))) !== manifest.schemaChecksum) throw new SchemaNotReady();
  } catch { throw new SchemaNotReady(); }
}
