// node:fs is deliberately server-only; this module must never enter a client graph.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigError, environment, rejectUnsafeFlags, safeOrigin, validatePublic, type EnvInput, type ReleasePolicy } from './public.ts';
export function readPolicy(): ReleasePolicy { return JSON.parse(readFileSync(resolve(process.cwd(), 'config/release-policy.json'), 'utf8')) as ReleasePolicy; }
export function validateServer(input: EnvInput, policy: ReleasePolicy = readPolicy()) {
    const env = environment(input);
    rejectUnsafeFlags(input, env);
    const publicConfig = validatePublic(input, policy);
    const databaseUrl = input.TURSO_DATABASE_URL || (env === 'development' ? 'file:.data/loop.db' : '');
    if (env !== 'development') {
        const target = policy[env];
        let url: URL;
        try {
            url = new URL(databaseUrl);
        }
        catch {
            throw new ConfigError('TURSO_DATABASE_URL');
        }
        if (!['libsql:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '' && url.pathname !== '/')
            throw new ConfigError('TURSO_DATABASE_URL');
        safeOrigin(`https://${url.host}`, 'TURSO_DATABASE_URL', true);
        if (!target.databaseUrls.includes(databaseUrl) || !target.databaseId || (env === 'production' && /(^|[.-])(test|dev|staging|local|fixture)([.-]|$)/i.test(url.hostname)))
            throw new ConfigError('DATABASE_ALLOWLIST');
        const token = input.TURSO_AUTH_TOKEN || '';
        if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
            throw new ConfigError('TURSO_AUTH_TOKEN');
        if (!new RegExp(`^sk_${env === 'production' ? 'live' : '(test|live)'}_[A-Za-z0-9]{20,}$`).test(input.CLERK_SECRET_KEY || ''))
            throw new ConfigError('CLERK_SECRET_KEY');
        if (!/^sk-[A-Za-z0-9_-]{30,}$/.test(input.OPENAI_API_KEY || '') || /dummy|fixture|example|changeme|^sk-test/i.test(input.OPENAI_API_KEY || ''))
            throw new ConfigError('OPENAI_API_KEY');
        if (input.CLERK_JWT_KEY)
            throw new ConfigError('CLERK_JWT_KEY'); // Release uses provider rotation, never a test signing key.
        for (const name of ['OPENAI_CARD_MODEL', 'OPENAI_CHAT_MODEL'])
            if (!target.models.includes(input[name] || ''))
                throw new ConfigError(name);
        if (!target.webOrigins.includes(safeOrigin('https://' + (input.VERCEL_PROJECT_PRODUCTION_URL || ''), 'WEB_ORIGIN', true)))
            throw new ConfigError('WEB_ORIGIN');
        const origins = (input.AUTH_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
        if (!origins.length || origins.some(value => value !== safeOrigin(value, 'AUTH_ALLOWED_ORIGINS', true) || !target.webOrigins.includes(value)))
            throw new ConfigError('AUTH_ALLOWED_ORIGINS');
    }
    return { ...publicConfig, databaseUrl, databaseId: env === 'development' ? 'local-development' : policy[env].databaseId, databaseToken: input.TURSO_AUTH_TOKEN, clerkSecretKey: input.CLERK_SECRET_KEY, openaiApiKey: input.OPENAI_API_KEY };
}
