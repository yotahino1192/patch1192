import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { createClient } from '@libsql/client';
import { validateServer } from '../../lib/env/server.ts';
export function env() { loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() { }, error() { } }); return process.env; }
export function options() { const args = process.argv.slice(2); const get = name => args[args.indexOf(name) + 1]; return { has: name => args.includes(name), get: name => args.includes(name) ? get(name) : undefined }; }
export function target({ write = false } = {}) {
    const e = env(), o = options();
    const config = validateServer(e);
    const url = o.get('--url') || config.databaseUrl;
    if (e.PATCH_ENV !== 'development' && o.get('--url') && url !== config.databaseUrl)
        throw new Error('TARGET_MISMATCH');
    const local = url.startsWith('file:') || url === ':memory:';
    if (!local && (!o.has('--allow-remote') || o.get('--confirm-db') !== config.databaseId))
        throw new Error('REMOTE_REQUIRES_EXPLICIT_TARGET');
    if (write && e.PATCH_ENV === 'production' && o.get('--maintenance-confirmation') !== config.databaseId)
        throw new Error('MAINTENANCE_CONFIRMATION_REQUIRED');
    if (e.CI && !local)
        throw new Error('CI_REMOTE_DATABASE_FORBIDDEN');
    if (url.startsWith('file:')) {
        const path = url.slice(5);
        if (write)
            mkdirSync(dirname(path), { recursive: true });
        else if (!existsSync(path))
            throw new Error('DATABASE_FILE_MISSING');
    }
    return { client: createClient({ url, authToken: config.databaseToken }), config, options: o };
}
export async function command(action) { try {
    await action();
}
catch (e) {
    const code = /^[A-Z][A-Z0-9_:]*$/.test(e?.message || '') ? e.message : 'INFRA_CHECK_FAILED';
    console.error(code);
    process.exitCode = 1;
} }
