import { createClient } from '@libsql/client';
import { validateServer } from '../../lib/env/server.ts';
import { validateArtifact } from './artifact.mjs';
import { scanRepository, scanClientGraph, scanFiles, filesUnder } from './scan.mjs';
import { loadMigrations, migrate, validateDatabase, hash, expectedSchema } from './migrations.mjs';
import { readFile } from 'node:fs/promises';
export async function checkRelease(e, policy, { webRoot = '.next/static', mobileRoot = 'dist/mobile', serverRoot = '.next/server' } = {}) {
    const config = validateServer(e, policy);
    if (config.env !== 'production')
        throw new Error('PRODUCTION_ENV_REQUIRED');
    const secrets = Object.entries(e).filter(([k]) => /(SECRET|TOKEN|PRIVATE_KEY|OPENAI_API_KEY|BACKUP_KEY)/.test(k)).map(([, v]) => v);
    await scanRepository();
    await scanClientGraph();
    await scanFiles(await filesUnder(serverRoot), { artifact: true, secrets });
    const web = await validateArtifact(webRoot, policy, 'production', { kind: 'web', secrets });
    const mobile = await validateArtifact(mobileRoot, policy, 'production', { kind: 'mobile', secrets });
    if (web.apiOrigin !== config.apiOrigin || mobile.apiOrigin !== config.apiOrigin || web.clerkIssuer !== config.clerkIssuer || mobile.clerkIssuer !== config.clerkIssuer)
        throw new Error('RELEASE_CONFIG_MISMATCH');
    const migrations = await loadMigrations(), manifest = JSON.parse(await readFile('config/schema-manifest.json', 'utf8'));
    if (manifest.schemaChecksum !== hash(JSON.stringify(await expectedSchema(migrations))) || JSON.stringify(manifest.migrations) !== JSON.stringify(migrations.map(({ name, checksum }) => ({ name, checksum }))))
        throw new Error('SCHEMA_MANIFEST_STALE');
    const c = createClient({ url: ':memory:' });
    try {
        await migrate(c);
        await validateDatabase(c, migrations);
    }
    finally {
        c.close();
    }
}
