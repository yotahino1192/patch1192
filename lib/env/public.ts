/** Pure public configuration: never read process.env or import server modules here. */
export type PatchEnv = 'development' | 'staging' | 'production';
export type EnvInput = Record<string, string | undefined>;
export type TargetPolicy = {
    apiOrigins: string[];
    webOrigins: string[];
    clerkIssuers: string[];
    databaseUrls: string[];
    databaseId: string;
    models: string[];
};
export type ReleasePolicy = {
    version: number;
    staging: TargetPolicy;
    production: TargetPolicy;
};
export class ConfigError extends Error {
    readonly code = 'CONFIG_INVALID';
    constructor(field: string) { super(`CONFIG_INVALID:${field}`); }
}
export function environment(input: EnvInput): PatchEnv {
    const value = input.PATCH_ENV;
    if (value === 'development' || value === 'staging' || value === 'production')
        return value;
    throw new ConfigError('PATCH_ENV');
}
export function safeOrigin(value: string, field: string, remote: boolean): string {
    let url: URL;
    try {
        url = new URL(value);
    }
    catch {
        throw new ConfigError(field);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
        throw new ConfigError(field);
    const host = url.hostname.toLowerCase();
    // Remote endpoints must be DNS names; reject *all* literal IPs, not only known private ranges.
    if (remote && (url.protocol !== 'https:' || !host.includes('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || /(^|\.)example\.(com|org|net|invalid)$/.test(host) || /(^|[.-])(dummy|fixture)([.-]|$)/.test(host)))
        throw new ConfigError(field);
    return url.origin;
}
export function clerkHost(key: string): string {
    if (!/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(key))
        throw new ConfigError('CLERK_PUBLISHABLE_KEY');
    try {
        const decoded = atob(key.replace(/^pk_(test|live)_/, '').replace(/-/g, '+').replace(/_/g, '/'));
        if (!decoded.endsWith('$') || !/^[a-z0-9.-]+\$$/.test(decoded))
            throw new Error();
        return decoded.slice(0, -1);
    }
    catch {
        throw new ConfigError('CLERK_PUBLISHABLE_KEY');
    }
}
export function rejectUnsafeFlags(input: EnvInput, env: PatchEnv) {
    if (env === 'development')
        return;
    for (const [name, value] of Object.entries(input)) {
        if (/^(PATCH_|NEXT_PUBLIC_|VITE_|APP_|AUTH_|CLERK_|TEST_|MOCK_|USE_MOCK_|FIXTURE_|DEBUG|AUTO_MIGRAT)/.test(name) && /(BYPASS|FIXTURE_AUTH|MOCK.*AUTH|AUTH.*MOCK|TEST.*AUTH|AUTH.*TEST|TEST_ACCOUNT|DEV_ONLY|DEVELOPMENT_ONLY|DEBUG|AUTO_MIGRAT)/i.test(name) && value && !['false', '0', 'off'].includes(value.toLowerCase()))
            throw new ConfigError(name);
        if (/^(PATCH_FEATURE_|NEXT_PUBLIC_FEATURE_|VITE_FEATURE_)/.test(name) && value && !['false', '0', 'off'].includes(value.toLowerCase()))
            throw new ConfigError(name);
        if (/^(NEXT_PUBLIC_|PATCH_|VITE_).*(SECRET|TOKEN|PRIVATE_KEY|OPENAI_API_KEY|APNS_KEY)/.test(name) && value)
            throw new ConfigError(name);
    }
}
export function validatePublic(input: EnvInput, policy: ReleasePolicy, mobile = false) {
    const env = environment(input);
    rejectUnsafeFlags(input, env);
    const remote = env !== 'development';
    const key = input[mobile ? 'PATCH_CLERK_PUBLISHABLE_KEY' : 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] || '';
    const issuer = input[mobile ? 'PATCH_CLERK_ISSUER' : 'CLERK_ISSUER'] || '';
    const api = input[mobile ? 'PATCH_API_URL' : 'PATCH_API_ORIGIN'] || (remote ? '' : 'http://localhost:3001');
    const apiOrigin = safeOrigin(api, 'API_ORIGIN', remote);
    if (!remote && !key)
        return { env, apiOrigin, clerkHost: '', clerkIssuer: issuer ? safeOrigin(issuer, 'CLERK_ISSUER', false) : '', publishableKey: '' };
    const host = clerkHost(key);
    const clerkIssuer = safeOrigin(issuer, 'CLERK_ISSUER', remote);
    if (issuer !== clerkIssuer || new URL(clerkIssuer).hostname !== host)
        throw new ConfigError('CLERK_HOST_MISMATCH');
    if (env === 'production' && (!key.startsWith('pk_live_') || host.endsWith('.clerk.accounts.dev')))
        throw new ConfigError('CLERK_PRODUCTION');
    if (remote) {
        const target = policy[env];
        if (!target?.apiOrigins.includes(apiOrigin) || !target.clerkIssuers.includes(clerkIssuer))
            throw new ConfigError('RELEASE_ALLOWLIST');
    }
    return { env, apiOrigin, clerkHost: host, clerkIssuer, publishableKey: key };
}
