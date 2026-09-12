import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { headers } from './auth-fixture.mjs';
registerHooks({ resolve(specifier, context, next) { if ((specifier === './client' || specifier === '../../../../db/client'))
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

test('Privacy and AI requests fail closed on an unmigrated DB without running migrations', async () => {
    const c=createClient({url:':memory:'});
    try {
        globalThis.__infraEmptyDb=createDatabase(c);
        const routes=[['../app/api/privacy/consents/route.ts','GET'],['../app/api/ai/cards/route.ts','POST'],['../app/api/ai/chat/route.ts','POST'],['../app/api/account/deletion/route.ts','POST']];
        for(const [path,method] of routes){
            const handler=(await import(path))[method];
            const response=await handler(new Request('http://localhost/api/test',{method,headers:headers('user_A',undefined,{'content-type':'application/json'}),...(method==='POST'?{body:JSON.stringify({action:'challenge',text:'x'.repeat(80)})}:{})}));
            assert.equal(response.status,503);assert.equal((await response.json()).code,'SCHEMA_NOT_READY');
        }
        assert.equal((await c.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.length,0);
    } finally {c.close();}
});
