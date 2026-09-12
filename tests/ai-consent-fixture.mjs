import { CONSENT_SCOPE, CONSENT_VERSION, POLICY_VERSION, AI_DISCLOSURE } from '../lib/privacy-policy.ts';
import { createHash, randomUUID } from 'node:crypto';
export async function grantAi(c, userId) {
 await c.execute({sql:'INSERT INTO user_consents VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,scope) DO UPDATE SET state=excluded.state,consent_version=excluded.consent_version,policy_version=excluded.policy_version,revision=user_consents.revision+1',args:[userId,CONSENT_SCOPE,'granted',CONSENT_VERSION,POLICY_VERSION,1,randomUUID(),createHash('sha256').update(AI_DISCLOSURE.ja).digest('hex'),'ja',new Date().toISOString()]});
}
