import type { Transaction } from '@libsql/client';
import { PrivacyError } from '../privacy-error.ts';
import { CONSENT_SCOPE, CONSENT_VERSION, POLICY_VERSION } from '../privacy-policy.ts';
export type AiPrivacyPermit = { userId: string; generation: number; revision: number };
export async function privacyPermit(tx: Transaction, userId: string): Promise<AiPrivacyPermit> {
  const user = (await tx.execute({ sql: 'SELECT lifecycle_state,generation FROM users WHERE id=?', args: [userId] })).rows[0];
  if (user?.lifecycle_state !== 'active') throw new PrivacyError('ACCOUNT_INACTIVE', 403);
  const consent = (await tx.execute({ sql: 'SELECT state,revision,consent_version,policy_version FROM user_consents WHERE user_id=? AND scope=?', args: [userId, CONSENT_SCOPE] })).rows[0];
  if (consent?.state !== 'granted') throw new PrivacyError('AI_CONSENT_REQUIRED', 403);
  if (consent.consent_version !== CONSENT_VERSION || consent.policy_version !== POLICY_VERSION) throw new PrivacyError('AI_CONSENT_OUTDATED', 403);
  return { userId, generation: Number(user.generation), revision: Number(consent.revision) };
}
export async function checkAiPrivacy(tx: Transaction, permit: AiPrivacyPermit) {
  const current = await privacyPermit(tx, permit.userId);
  if (current.generation !== permit.generation) throw new PrivacyError('ACCOUNT_CHANGED', 409);
  if (current.revision !== permit.revision) throw new PrivacyError('AI_CONSENT_CHANGED', 403);
}
