import { generateKeyPairSync, sign } from 'node:crypto';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const issuer = 'https://patch-test.clerk.accounts.dev';
export const origin = 'http://localhost';
process.env.CLERK_ISSUER = issuer;
process.env.CLERK_JWT_KEY = publicKey.export({ type: 'spki', format: 'pem' });
process.env.AUTH_ALLOWED_ORIGINS = origin;
export function token(subject = 'user_A', overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'local-test' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: subject, sid: `sess_${subject}`, iat: now, nbf: now - 1, exp: now + 60, v: 2, ...overrides })).toString('base64url');
  const message = `${header}.${payload}`;
  return `${message}.${sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url')}`;
}
export function headers(subject, userId, extra = {}) {
  return { authorization: `Bearer ${token(subject)}`, 'x-patch-session': `sess_${subject}`, ...(userId ? { 'x-patch-account': userId } : {}), ...extra };
}
