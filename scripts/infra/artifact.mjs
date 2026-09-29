import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { releaseSha } from './source.mjs';
export { releaseSha } from './source.mjs';
import { hash } from './schema.mjs';
import { filesUnder, scanFiles } from './scan.mjs';
import { safeOrigin, validatePublic } from '../../lib/env/public.ts';
// Reviewed pdfjs-dist 6.3.289: the sole example.com literal in each complete
// file is updateUrlHash's non-network URL parsing base. Pin the entire source /
// webpack / Vite file, not its name or a matchable call-site fragment. Any vendor,
// bundler or payload change fails closed and requires review of these fingerprints.
const pdfParsingBaseFiles = new Set([
    '91e29f812c593904e8d48d022db5ddf93e3443575d4765ac9bfbb42494cfbd8d', // legacy/build/pdf.mjs
    '612315a73afbea09211db2de11e5430607056115f1171f14207a7719dcf37f73', // webpack PDF chunk
    '4a3feb336ede0ebcd00c60dd1d9933e59591aa072b19efd971e2eba956fdaf80', // isolated worktree webpack chunk
    'c3a89651ab8ceffbf00ce860229d0a359e550210408a90ff55f6b59559775663', // Vite PDF chunk
]);
export function checkArtifactEndpoints(text) {
    const reviewedPdfFile = pdfParsingBaseFiles.has(hash(text));
    // Actual URL literals only; words in validator regexes are not environment configuration.
    for (const match of text.replaceAll('\\/', '/').matchAll(/https?:\/\/[^\s\x22\x27\x60<>\\]+/g)) {
        if (reviewedPdfFile && match[0] === 'http://example.com') continue;
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
    const payloadTexts = await Promise.all(payloadFiles.filter(p => /\.(js|html|json)$/.test(p)).map(p => readFile(p, 'utf8')));
    if (expectedEnv === 'production') for (const text of payloadTexts) checkArtifactEndpoints(text);
    const text = payloadTexts.join('\n');
    if (expectedEnv === 'production' && /pk_test_[A-Za-z0-9_-]{12,}/.test(text))
        throw new Error('DEVELOPMENT_CLERK_IN_ARTIFACT');
    if (expectedEnv !== 'development' && !text.includes(m.publishableKey))
        throw new Error('ARTIFACT_PUBLIC_CONFIG_MISSING');
    if (kind === 'mobile' && expectedEnv !== 'development' && !text.includes(m.apiOrigin))
        throw new Error('ARTIFACT_API_CONFIG_MISSING');
    await scanFiles(await filesUnder(root), { artifact: true, secrets });
    return m;
}
