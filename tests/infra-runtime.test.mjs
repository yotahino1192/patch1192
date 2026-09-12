import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { headers } from './auth-fixture.mjs';
registerHooks({ resolve(specifier, context, next) { if (specifier === './client')
        return { url: 'data:text/javascript,export function database(){return globalThis.__infraEmptyDb} export async function initializeDatabase(){await globalThis.__infraEmptyDb.initialize()}', shortCircuit: true }; if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier))
        return next(new URL(specifier + '.ts', context.parentURL).href, context); return next(specifier, context); } });
const { GET } = await import('../app/api/data/route.ts');
test('authenticated request returns sanitized no-store 503 on unmigrated DB without creating tables', async () => { const c = createClient({ url: ':memory:' }); try {
    globalThis.__infraEmptyDb = createDatabase(c);
    const response = await GET(new Request('http://localhost/api/data', { headers: headers('user_A') }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'SCHEMA_NOT_READY');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await c.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.length, 0);
}
finally {
    c.close();
} });
