import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const shaPattern = /^[a-f0-9]{40}$/;
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

export function releaseSha({ cwd = process.cwd(), env = process.env } = {}) {
    const explicit = env.PATCH_RELEASE_SHA;
    if (explicit !== undefined && !shaPattern.test(explicit)) throw Error('RELEASE_SHA_REQUIRED');
    let sha;
    try { sha = git(['rev-parse', 'HEAD'], cwd).trim(); }
    catch {
        if (existsSync(join(cwd, '.git'))) throw Error('RELEASE_GIT_UNAVAILABLE');
        sha = explicit || env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA;
    }
    if (!shaPattern.test(sha || '')) throw Error('RELEASE_SHA_REQUIRED');
    if (explicit && (sha !== explicit || [env.VERCEL_GIT_COMMIT_SHA, env.GITHUB_SHA].some(value => value && value !== explicit)))
        throw Error('RELEASE_SHA_MISMATCH');
    return sha;
}

export async function repositoryFiles({ cwd = process.cwd(), env = process.env } = {}) {
    try { return git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd).split('\0').filter(Boolean); }
    catch {
        // A broken Git checkout must not silently switch enumeration methods.
        if (existsSync(join(cwd, '.git'))) throw Error('SOURCE_SCAN_GIT_UNAVAILABLE');
        if (env.VERCEL !== '1' || !['production', 'preview'].includes(env.VERCEL_ENV) || !shaPattern.test(env.PATCH_RELEASE_SHA || ''))
            throw Error('SOURCE_SCAN_GIT_REQUIRED');
        releaseSha({ cwd, env });
    }
    // CLI uploads omit .git. Scan every uploaded source file, including hidden
    // and otherwise gitignored files. Never use .gitignore as a scan bypass.
    // Only root dependency/platform/build output trees are outside source scope;
    // generated artifacts retain their separate inventory + secret checks.
    const generated = new Set(['node_modules', '.next', 'dist', '.vercel']);
    const names = [];
    async function walk(directory = '') {
        for (const entry of await readdir(join(cwd, directory), { withFileTypes: true })) {
            if (!directory && generated.has(entry.name)) continue;
            const name = join(directory, entry.name);
            if (entry.isSymbolicLink()) throw Error('SCAN_SYMLINK_FORBIDDEN');
            if (entry.isDirectory()) await walk(name);
            else if (entry.isFile()) names.push(name);
            else throw Error('SOURCE_SCAN_FILE_TYPE_INVALID');
        }
    }
    await walk();
    if (!names.length) throw Error('SOURCE_SCAN_EMPTY');
    return names.sort();
}
