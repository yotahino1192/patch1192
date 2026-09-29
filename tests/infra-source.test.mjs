import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { repositoryFiles, releaseSha } from '../scripts/infra/source.mjs';

const candidate = 'a'.repeat(40);
const vercel = { VERCEL: '1', VERCEL_ENV: 'production', PATCH_RELEASE_SHA: candidate };
const scanner = new URL('../scripts/infra/scan.mjs', import.meta.url).href;
const artifact = new URL('../scripts/infra/artifact.mjs', import.meta.url).href;
const git = (cwd, args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
async function fixture(action, withGit = false) {
    const cwd = await mkdtemp(join(tmpdir(), 'patch-source-'));
    try {
        await writeFile(join(cwd, 'app.js'), '"use client"; export const value = 1;');
        if (withGit) {
            git(cwd, ['init']);
            git(cwd, ['add', 'app.js']);
            git(cwd, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
        }
        await action(cwd);
    } finally { await rm(cwd, {recursive: true, force: true}); }
}
function runScan(cwd, env = {}) {
    return spawnSync(process.execPath, ['--input-type=module', '-e', `
        import {scanRepository,scanClientGraph} from ${JSON.stringify(scanner)};
        try { await scanRepository(); await scanClientGraph(); console.log('SECRET_SCAN_OK'); }
        catch(e) { console.error(e.message); process.exitCode=1; }
    `], {cwd, env: {PATH: process.env.PATH, ...env}, encoding: 'utf8'});
}

test('Git-present enumeration preserves tracked, untracked and ignore semantics', async () => {
    await fixture(async cwd => {
        await writeFile(join(cwd, '.gitignore'), 'ignored.txt\n');
        await writeFile(join(cwd, 'ignored.txt'), 'ignored');
        await writeFile(join(cwd, 'untracked.txt'), 'safe');
        assert.deepEqual((await repositoryFiles({cwd, env: {}})).sort(), ['.gitignore', 'app.js', 'untracked.txt']);
        const sha = git(cwd, ['rev-parse', 'HEAD']).trim();
        assert.equal(releaseSha({cwd, env: {PATCH_RELEASE_SHA: sha}}), sha);
        assert.throws(() => releaseSha({cwd, env: vercel}), /RELEASE_SHA_MISMATCH/);
        assert.equal(runScan(cwd).status, 0);
    }, true);
});

test('Git-absent Vercel enumeration scans hidden and ignored uploads, excluding only root generated trees', async () => {
    await fixture(async cwd => {
        await writeFile(join(cwd, '.gitignore'), 'private/\n');
        await mkdir(join(cwd, 'private'));
        await writeFile(join(cwd, 'private', '.hidden'), 'safe');
        for (const name of ['node_modules', '.next', 'dist', '.vercel']) {
            await mkdir(join(cwd, name));
            await writeFile(join(cwd, name, 'generated.js'), 'generated');
        }
        assert.deepEqual(await repositoryFiles({cwd, env: vercel}), ['.gitignore', 'app.js', join('private', '.hidden')]);
        assert.equal(runScan(cwd, vercel).status, 0);
    });
});

test('Git-absent scan requires Vercel build identity and explicit valid matching SHA', async () => {
    await fixture(async cwd => {
        for (const env of [{}, {PATCH_RELEASE_SHA: candidate}, {...vercel, VERCEL: '0'}, {...vercel, VERCEL_ENV: 'development'}, {...vercel, PATCH_RELEASE_SHA: ''}, {...vercel, PATCH_RELEASE_SHA: 'not-a-sha'}])
            await assert.rejects(repositoryFiles({cwd, env}), /SOURCE_SCAN_GIT_REQUIRED/);
        await assert.rejects(repositoryFiles({cwd, env: {...vercel, VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40)}}), /RELEASE_SHA_MISMATCH/);
        await assert.rejects(repositoryFiles({cwd, env: {...vercel, GITHUB_SHA: 'b'.repeat(40)}}), /RELEASE_SHA_MISMATCH/);
        assert.equal(releaseSha({cwd, env: vercel}), candidate);
        assert.equal(releaseSha({cwd, env: {GITHUB_SHA: candidate}}), candidate); // existing CI fallback
        assert.equal(releaseSha({cwd, env: {VERCEL_GIT_COMMIT_SHA: candidate}}), candidate);
        assert.throws(() => releaseSha({cwd, env: {}}), /RELEASE_SHA_REQUIRED/);
        assert.throws(() => releaseSha({cwd, env: {...vercel, PATCH_RELEASE_SHA: ''}}), /RELEASE_SHA_REQUIRED/);
    });
});

test('broken Git metadata cannot be bypassed with Vercel variables', async () => {
    await fixture(async cwd => {
        await writeFile(join(cwd, '.git'), 'not a valid gitdir');
        await assert.rejects(repositoryFiles({cwd, env: vercel}), /SOURCE_SCAN_GIT_UNAVAILABLE/);
        assert.throws(() => releaseSha({cwd, env: vercel}), /RELEASE_GIT_UNAVAILABLE/);
    });
});

test('Git-absent scan rejects empty trees and source symlinks', async () => {
    await fixture(async cwd => {
        await rm(join(cwd, 'app.js'));
        await assert.rejects(repositoryFiles({cwd, env: vercel}), /SOURCE_SCAN_EMPTY/);
        await symlink('missing', join(cwd, 'app.js'));
        await assert.rejects(repositoryFiles({cwd, env: vercel}), /SCAN_SYMLINK_FORBIDDEN/);
    });
});

for (const withGit of [true, false]) {
    const context = withGit ? 'Git' : 'Vercel without Git';
    test(context + ': actual secret scan still rejects leaked keys and env files', async () => {
        await fixture(async cwd => {
            const env = withGit ? {} : vercel;
            const secret = 'sk-' + randomBytes(24).toString('hex');
            await writeFile(join(cwd, 'unexpected.txt'), secret);
            const leaked = runScan(cwd, env);
            assert.equal(leaked.status, 1);
            assert.match(leaked.stderr, /SECRET_LEAK_DETECTED/);
            assert.ok(!leaked.stderr.includes(secret));
            await rm(join(cwd, 'unexpected.txt'));
            await writeFile(join(cwd, '.env.production'), 'SAFE=value');
            assert.match(runScan(cwd, env).stderr, /ENV_FILE_IN_ARTIFACT/);
        }, withGit);
    });
    test(context + ': actual client graph retains server/secret/dynamic-import rejection', async () => {
        await fixture(async cwd => {
            const env = withGit ? {} : vercel;
            for (const source of [
                '"use client"; export const value = process.env.CLERK_SECRET_KEY;',
                '"use client"; import fs from "node:fs"; export {fs};',
                '"use client"; export const load = path => import(path);',
            ]) {
                await writeFile(join(cwd, 'app.js'), source);
                const result = runScan(cwd, env);
                assert.equal(result.status, 1);
                assert.match(result.stderr, /SERVER_SECRET_IN_CLIENT_GRAPH|SERVER_MODULE_IN_CLIENT|DYNAMIC_CLIENT_IMPORT_UNCHECKED/);
            }
        }, withGit);
    });
}

test('Git-absent uploads cannot hide secrets in gitignored or nested generated-looking source directories', async () => {
    await fixture(async cwd => {
        await writeFile(join(cwd, '.gitignore'), 'private/\n');
        await mkdir(join(cwd, 'private', 'node_modules'), {recursive: true});
        await writeFile(join(cwd, 'private', 'node_modules', 'hidden.txt'), 'sk-' + randomBytes(24).toString('hex'));
        assert.match(runScan(cwd, vercel).stderr, /SECRET_LEAK_DETECTED/);
    });
});

test('Git-absent Vercel artifact seals the explicit SHA and rejects another candidate', async () => {
    await fixture(async cwd => {
        const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
            import {mkdir,writeFile,readFile} from 'node:fs/promises';
            import {sealArtifact,validateArtifact} from ${JSON.stringify(artifact)};
            const origin='https://app.patch-release.dev', host='clerk.patch-release.dev';
            const key='pk_'+'live_'+Buffer.from(host+'$').toString('base64').replace(/=+$/, '');
            const config={env:'production',apiOrigin:origin,clerkHost:host,clerkIssuer:'https://'+host,publishableKey:key};
            const policy={production:{apiOrigins:[origin],clerkIssuers:['https://'+host]}};
            await mkdir('dist'); await writeFile('dist/app.js', JSON.stringify({key,origin}));
            await sealArtifact('dist',config,{kind:'web',mode:'production'});
            const m=await validateArtifact('dist',policy,'production',{kind:'web'});
            if(m.commitSha!==${JSON.stringify(candidate)})throw Error('BAD_SHA');
            try {await validateArtifact('dist',policy,'production',{kind:'web',sha:'b'.repeat(40)});process.exitCode=1;}
            catch(e) {if(e.message!=='ARTIFACT_METADATA_INVALID')throw e;}
            console.log('GITLESS_ARTIFACT_SHA_OK');
        `], {cwd, env: {PATH: process.env.PATH, ...vercel}, encoding: 'utf8'});
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /GITLESS_ARTIFACT_SHA_OK/);
    });
});
