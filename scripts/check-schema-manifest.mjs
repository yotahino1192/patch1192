import { loadMigrations, expectedSchema, hash } from './infra/migrations.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { command } from './infra/cli.mjs';
await command(async () => {
    const m = await loadMigrations();
    const result = { version: 1, schemaChecksum: hash(JSON.stringify(await expectedSchema(m))), migrations: m.map(({ name, checksum }) => ({ name, checksum })) };
    if (process.argv.includes('--write'))
        await writeFile('config/schema-manifest.json', JSON.stringify(result, null, 2) + '\n');
    else if (JSON.stringify(result) !== JSON.stringify(JSON.parse(await readFile('config/schema-manifest.json', 'utf8'))))
        throw new Error('SCHEMA_MANIFEST_STALE');
    console.log('SCHEMA_MANIFEST_OK');
});
