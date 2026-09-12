import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { validateServer } from '../lib/env/server.ts';
import { validatePublic } from '../lib/env/public.ts';
import { detectSecrets, scanFiles } from '../scripts/infra/scan.mjs';
import { sealArtifact, validateArtifact } from '../scripts/infra/artifact.mjs';
const host = 'clerk.patch-release.dev', origin = 'https://app.patch-release.dev';
const pk = 'pk_' + 'live_' + Buffer.from(host + '$').toString('base64').replace(/=+$/, '');
const target = { apiOrigins: [origin], webOrigins: [origin], clerkIssuers: ['https://' + host], databaseUrls: ['libsql://patch-release.turso.io'], databaseId: 'patch-release', models: ['gpt-5-nano'] };
const policy = { version: 1, production: target, staging: target };
function valid() { return { PATCH_ENV: 'production', PATCH_API_ORIGIN: origin, VERCEL_PROJECT_PRODUCTION_URL: new URL(origin).host, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk, CLERK_ISSUER: 'https://' + host, CLERK_SECRET_KEY: 'sk_' + 'live_' + randomBytes(20).toString('hex'), TURSO_DATABASE_URL: target.databaseUrls[0], TURSO_AUTH_TOKEN: 'eyJ' + randomBytes(16).toString('base64url') + '.' + randomBytes(24).toString('base64url') + '.' + randomBytes(32).toString('base64url'), OPENAI_API_KEY: 'sk-' + randomBytes(24).toString('hex'), OPENAI_CARD_MODEL: 'gpt-5-nano', OPENAI_CHAT_MODEL: 'gpt-5-nano', AUTH_ALLOWED_ORIGINS: origin }; }
test('development explicit configuration passes without secrets; missing environment fails', () => { assert.equal(validateServer({ PATCH_ENV: 'development' }, policy).env, 'development'); assert.throws(() => validateServer({}, policy), /PATCH_ENV/); });
test('production and staging validate with matched allowlisted endpoints', () => { assert.equal(validateServer(valid(), policy).env, 'production'); assert.equal(validateServer({ ...valid(), PATCH_ENV: 'staging' }, policy).env, 'staging'); });
test('production rejects test Clerk, mismatched issuer, dummy AI and unauthorized model', () => { const e = valid(); for (const change of [{ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk.replace('live', 'test') }, { CLERK_ISSUER: 'https://another.patch-release.dev' }, { OPENAI_API_KEY: 'dummy' }, { OPENAI_CHAT_MODEL: 'expensive-model' }, { CLERK_JWT_KEY: 'public-key' }, { AUTH_ALLOWED_ORIGINS: 'https://evil.tld' }])
    assert.throws(() => validateServer({ ...e, ...change }, policy)); });
test('production rejects local, private, reserved and unallowlisted API origins', () => { for (const url of ['http://app.patch-release.dev', 'https://localhost', 'https://127.0.0.1', 'https://2130706433', 'https://10.0.0.1', 'https://172.16.0.1', 'https://192.168.1.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://example.invalid', 'https://example.com', 'https://api.example.com', 'https://host.test', 'https://unapproved.tld'])
    assert.throws(() => validateServer({ ...valid(), PATCH_API_ORIGIN: url }, policy)); });
test('production rejects local/test/unknown DB, bypass and public secret flags', () => { for (const change of [{ TURSO_DATABASE_URL: 'file:local.db' }, { TURSO_DATABASE_URL: 'libsql://patch-test.turso.io' }, { TURSO_DATABASE_URL: 'libsql://other.turso.io' }, { AUTH_BYPASS: 'true' }, { USE_MOCK_AUTH: '1' }, { CLERK_ISSUER: 'https://' + host + '/' }, { TEST_ACCOUNT_BYPASS: '1' }, { PATCH_DEVELOPMENT_ONLY: 'true' }, { NEXT_PUBLIC_OPENAI_API_KEY: 'secret' }])
    assert.throws(() => validateServer({ ...valid(), ...change }, policy)); });
test('production rejects missing allowlists even for plausible production credentials', () => { assert.throws(() => validateServer(valid(), { ...policy, production: { ...target, apiOrigins: [] } })); });
test('mobile public configuration is independently typed and issuer-bound', () => { const e = valid(); assert.equal(validatePublic({ PATCH_ENV: 'production', PATCH_API_URL: origin, PATCH_CLERK_ISSUER: e.CLERK_ISSUER, PATCH_CLERK_PUBLISHABLE_KEY: pk }, policy, true).clerkHost, host); assert.throws(() => validatePublic({ PATCH_ENV: 'production', PATCH_API_URL: origin, PATCH_CLERK_ISSUER: e.CLERK_ISSUER, PATCH_CLERK_PUBLISHABLE_KEY: pk.replace('live', 'test') }, policy, true)); });
test('secret patterns detect keys and private material but do not treat publishable keys as secrets', () => { assert.equal(detectSecrets(pk), false); for (const s of [valid().CLERK_SECRET_KEY, valid().OPENAI_API_KEY, valid().TURSO_AUTH_TOKEN, '-----BEGIN ' + 'PRIVATE KEY-----', 'Authorization: "Bearer ' + randomBytes(32).toString('hex') + '"'])
    assert.equal(detectSecrets(s), true); });
test('mobile/web artifact checks bind metadata, exact files and secrets', async () => { const dir = await mkdtemp(join(tmpdir(), 'patch-artifact-')); try {
    const config = validateServer(valid(), policy);
    await writeFile(join(dir, 'index.html'), '<div>Patch</div>' + pk + origin);
    await sealArtifact(dir, config, { kind: 'mobile', mode: 'production' });
    await validateArtifact(dir, policy, 'production', { kind: 'mobile' });
    await assert.rejects(validateArtifact(dir, policy, 'staging', { kind: 'mobile' }));
    await writeFile(join(dir, 'index.html'), 'tampered');
    await assert.rejects(validateArtifact(dir, policy, 'production', { kind: 'mobile' }), /HASH/);
    await writeFile(join(dir, 'index.html'), pk + origin + valid().OPENAI_API_KEY);
    await sealArtifact(dir, config, { kind: 'mobile', mode: 'production' });
    await assert.rejects(validateArtifact(dir, policy, 'production', { kind: 'mobile' }), /SECRET/);
    await writeFile(join(dir, '.env.local'), 'X=1');
    await assert.rejects(scanFiles([join(dir, '.env.local')]), /ENV_FILE/);
}
finally {
    await rm(dir, { recursive: true, force: true });
} });
test('complete offline release gate passes synthetic bound artifacts and rejects leaked server credentials', async () => { const { checkRelease } = await import('../scripts/infra/release.mjs'); const dir = await mkdtemp(join(tmpdir(), 'patch-release-')); const e = valid(), config = validateServer(e, policy); const roots = { webRoot: join(dir, 'web'), mobileRoot: join(dir, 'mobile'), serverRoot: join(dir, 'server') }; try {
    for (const root of Object.values(roots))
        await mkdir(root);
    for (const [root, kind] of [[roots.webRoot, 'web'], [roots.mobileRoot, 'mobile']]) {
        await writeFile(join(root, 'index.js'), JSON.stringify({ key: pk, api: origin }));
        await sealArtifact(root, config, { kind, mode: 'production' });
    }
    await writeFile(join(roots.serverRoot, 'server.js'), '// no secrets');
    await checkRelease(e, policy, roots);
    await writeFile(join(roots.serverRoot, 'server.js'), e.TURSO_AUTH_TOKEN);
    await assert.rejects(checkRelease(e, policy, roots), /SECRET/);
}
finally {
    await rm(dir, { recursive: true, force: true });
} });

test('production artifact rejects literal local/dummy/dev issuer endpoints', async () => {
 const { checkArtifactEndpoints } = await import('../scripts/infra/artifact.mjs');
 for (const url of ['http://localhost:3001/api/data','https://example.invalid','https://dummy.patch.tld','https://instance.clerk.accounts.dev','http://127.0.0.1/api']) assert.throws(() => checkArtifactEndpoints(JSON.stringify({ url })));
 assert.doesNotThrow(() => checkArtifactEndpoints('https://api.patch-app.tld/api/data'));
});
