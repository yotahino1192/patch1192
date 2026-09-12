import { readFile, readdir, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
const rules = [/sk_(?:test|live)_[A-Za-z0-9]{16,}/, /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/, /Authorization["']?\s*[:=]\s*["']Bearer\s+[A-Za-z0-9._-]{16,}/i];
export function detectSecrets(text, secrets = []) { return rules.some(r => r.test(text)) || secrets.some(s => s && s.length >= 12 && [s, encodeURIComponent(s), Buffer.from(s).toString('base64')].some(v => text.includes(v))); }
export async function filesUnder(root) {
    const out = [];
    for (const e of await readdir(root, { withFileTypes: true })) {
        const p = join(root, e.name);
        if (e.isSymbolicLink())
            throw new Error('ARTIFACT_SYMLINK_FORBIDDEN');
        if (e.isDirectory())
            out.push(...await filesUnder(p));
        else
            out.push(p);
    }
    return out;
}
export async function scanFiles(files, { secrets = [], artifact = false } = {}) {
    for (const file of files) {
        if ((await lstat(file)).isSymbolicLink())
            throw new Error('SCAN_SYMLINK_FORBIDDEN');
        if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example'))
            throw new Error('ENV_FILE_IN_ARTIFACT');
        const data = (await readFile(file)).toString('utf8');
        if (detectSecrets(data, secrets))
            throw new Error('SECRET_LEAK_DETECTED');
        if (artifact && /(FIXTURE_AUTH|AUTH_BYPASS|TEST_ACCOUNT_BYPASS)\s*["']?\s*[:=]\s*(?:true|["']1)/.test(data))
            throw new Error('TEST_CONFIG_IN_ARTIFACT');
    }
}
export async function scanRepository() {
    const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    await scanFiles(names);
}
export async function scanClientGraph() {
    // Resolve local imports transitively from every client entry; no server/env or fixture imports permitted.
    const ts = (await import('typescript')).default;
    const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(n => /\.[cm]?[jt]sx?$/.test(n));
    const text = new Map(await Promise.all(names.map(async (n) => [n, await readFile(n, 'utf8')])));
    const config = { moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, resolveJsonModule: true, baseUrl: process.cwd(), paths: { '@/*': ['./*'] } };
    const visited = new Set();
    async function visit(file) {
        if (visited.has(file))
            return;
        visited.add(file);
        if (/(^|\/)(db|tests|scripts)\/|lib\/env\/server/.test(file))
            throw new Error('SERVER_MODULE_IN_CLIENT');
        const source = text.get(file) ?? await readFile(file, 'utf8');
        if (/process\.env\.(?:CLERK_SECRET_KEY|TURSO_AUTH_TOKEN|OPENAI_API_KEY|.*PRIVATE_KEY|.*APNS.*SECRET)/.test(source) || /process\.env\s*\[|\.\.\.process\.env/.test(source))
            throw new Error('SERVER_SECRET_IN_CLIENT_GRAPH');
        const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
        const imports = [];
        function walk(node) { if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'process' && node.name.text === 'env') {
            const parent = node.parent;
            if (!ts.isPropertyAccessExpression(parent) || parent.expression !== node || !['NODE_ENV', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'].includes(parent.name.text))
                throw new Error('SERVER_SECRET_IN_CLIENT_GRAPH');
        } if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly)
            imports.push(node.moduleSpecifier.text); if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            if (!ts.isStringLiteral(node.arguments[0]))
                throw new Error('DYNAMIC_CLIENT_IMPORT_UNCHECKED');
            imports.push(node.arguments[0].text);
        } ts.forEachChild(node, walk); }
        walk(parsed);
        for (const name of imports) {
            if (/\.(css|svg|png|jpg|woff2?)$/.test(name))
                continue;
            if (name.startsWith('node:') || name === 'server-only')
                throw new Error('SERVER_MODULE_IN_CLIENT');
            if (name.startsWith('.') || name.startsWith('@/')) {
                const resolved = ts.resolveModuleName(name, resolve(file), config, ts.sys).resolvedModule?.resolvedFileName;
                if (!resolved)
                    throw new Error('CLIENT_IMPORT_UNRESOLVED');
                if (/(^|\/)(db|tests|scripts)\/|lib\/env\/server/.test(relative(process.cwd(), resolved).replaceAll('\\', '/')))
                    throw new Error('SERVER_MODULE_IN_CLIENT');
                if (/\.[cm]?[jt]sx?$/.test(resolved))
                    await visit(relative(process.cwd(), resolved).replaceAll('\\', '/'));
            }
        }
    }
    for (const [file, source] of text)
        if (/^\s*["']use client["']/.test(source) || file === 'mobile/main.tsx')
            await visit(file);
}
