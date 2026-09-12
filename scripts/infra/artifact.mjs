import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { hash } from './schema.mjs';
import { filesUnder, scanFiles } from './scan.mjs';
import { safeOrigin, validatePublic } from '../../lib/env/public.ts';
export function checkArtifactEndpoints(text) {
    // Actual URL literals only; words in validator regexes are not environment configuration.
    for (const match of text.replaceAll('\\/', '/').matchAll(/https?:\/\/[^\s\x22\x27\x60<>\\]+/g)) {
        let url;
        try { url = new URL(match[0]); } catch { continue; }
        const host = url.hostname;
        if (host.endsWith('.clerk.accounts.dev')) throw new Error('DEVELOPMENT_CLERK_IN_ARTIFACT');
        if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(local|internal|test|invalid)$/.test(host) || /(^|\.)example\.(com|org|net)$/.test(host) || /(^|[.-])(dummy|fixture)([.-]|$)/.test(host)) {
            safeOrigin(url.origin, 'ARTIFACT_ENDPOINT', true);
        }
    }
}
export const GUARD_VERSION = 1;
export function releaseSha() {
    let sha;
    try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA; }
    if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('RELEASE_SHA_REQUIRED');
    return sha;
}
export async function inventory(root) { const out = {}; for (const file of (await filesUnder(root)).sort()) {
    if (file === join(root, 'patch-build.json'))
        continue;
    out[relative(root, file)] = hash(await readFile(file));
} return out; }
export async function sealArtifact(root, config, { kind, mode }) {
    const meta = { guardVersion: GUARD_VERSION, patchEnv: config.env, apiOrigin: config.apiOrigin, clerkHost: config.clerkHost, clerkIssuer: config.clerkIssuer, publishableKey: config.publishableKey, commitSha: releaseSha(), buildTimestamp: new Date().toISOString(), kind, mode, files: await inventory(root) };
    await writeFile(join(root, 'patch-build.json'), JSON.stringify(meta, null, 2) + '\n');
    return meta;
}
export async function validateArtifact(root, policy, expectedEnv, { kind, sha = releaseSha(), secrets = [] } = {}) {
    const m = JSON.parse(await readFile(join(root, 'patch-build.json'), 'utf8'));
    if (m.guardVersion !== GUARD_VERSION || m.patchEnv !== expectedEnv || m.commitSha !== sha || !/^\d{4}-\d\d-\d\dT/.test(m.buildTimestamp) || !Number.isFinite(Date.parse(m.buildTimestamp)) || m.kind !== kind || expectedEnv !== 'development' && m.mode !== 'production')
        throw new Error('ARTIFACT_METADATA_INVALID');
    const cfg = validatePublic({ PATCH_ENV: expectedEnv, PATCH_API_URL: m.apiOrigin, PATCH_CLERK_ISSUER: m.clerkIssuer, PATCH_CLERK_PUBLISHABLE_KEY: m.publishableKey }, policy, true);
    if (cfg.clerkHost !== m.clerkHost)
        throw new Error('ARTIFACT_CLERK_MISMATCH');
    if (JSON.stringify(await inventory(root)) !== JSON.stringify(m.files))
        throw new Error('ARTIFACT_HASH_MISMATCH');
    const payloadFiles = (await filesUnder(root)).filter(p => p !== join(root, 'patch-build.json'));
    const text = (await Promise.all(payloadFiles.filter(p => /\.(js|html|json)$/.test(p)).map(p => readFile(p, 'utf8')))).join('\n');
    if (expectedEnv === 'production') checkArtifactEndpoints(text);
    if (expectedEnv === 'production' && /pk_test_[A-Za-z0-9_-]{12,}/.test(text))
        throw new Error('DEVELOPMENT_CLERK_IN_ARTIFACT');
    if (expectedEnv !== 'development' && !text.includes(m.publishableKey))
        throw new Error('ARTIFACT_PUBLIC_CONFIG_MISSING');
    if (kind === 'mobile' && expectedEnv !== 'development' && !text.includes(m.apiOrigin))
        throw new Error('ARTIFACT_API_CONFIG_MISSING');
    await scanFiles(await filesUnder(root), { artifact: true, secrets });
    return m;
}
