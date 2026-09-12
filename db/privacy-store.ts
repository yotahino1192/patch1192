import { createHash } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { database } from "./client";
import { PrivacyError } from "../lib/privacy-error";
import { AI_DISCLOSURE, CONSENT_SCOPE, CONSENT_VERSION, POLICY_VERSION, type Consent, type ConsentState } from "../lib/privacy-policy";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const identityHash = (issuer: string, subject: string) => hash(JSON.stringify([issuer,subject]));
export async function activeUser(tx: Transaction, userId: string) {
  const row = (await tx.execute({sql:"SELECT generation,lifecycle_state FROM users WHERE id=?",args:[userId]})).rows[0];
  if (!row || row.lifecycle_state !== "active") throw new PrivacyError("ACCOUNT_INACTIVE",403);
  return Number(row.generation);
}
export async function getConsent(userId: string, language: "ja" | "en" = "ja"): Promise<Consent> {
  const row = await database().prepare("SELECT * FROM user_consents WHERE user_id=? AND scope=?").bind(userId,CONSENT_SCOPE).first();
  return { state: (row?.state || "unset") as ConsentState, revision:Number(row?.revision || 0), consentVersion:String(row?.consent_version || ""), policyVersion:String(row?.policy_version || ""), textHash:hash(AI_DISCLOSURE[language]), language };
}
export async function setConsent(userId: string, input: { state: string; revision: number; operationId: string; consentVersion: string; policyVersion: string; textHash: string; language: "ja" | "en" }) {
  if (!["granted","denied","revoked"].includes(input.state) || !Number.isSafeInteger(input.revision) || input.revision<0 || !/^[a-zA-Z0-9_-]{8,120}$/.test(input.operationId)) throw new PrivacyError("INVALID_CONSENT",400);
  if(input.consentVersion!==CONSENT_VERSION || input.policyVersion!==POLICY_VERSION || input.textHash!==hash(AI_DISCLOSURE[input.language])) throw new PrivacyError("AI_CONSENT_OUTDATED");
  const payloadHash=hash(JSON.stringify(input));
  await database().transaction(async tx=>{
    await activeUser(tx,userId);
    const old=(await tx.execute({sql:"SELECT payload_hash FROM consent_events WHERE user_id=? AND operation_id=?",args:[userId,input.operationId]})).rows[0];
    if(old) { if(old.payload_hash!==payloadHash) throw new PrivacyError("OPERATION_CONFLICT"); return; }
    const current=(await tx.execute({sql:"SELECT revision FROM user_consents WHERE user_id=? AND scope=?",args:[userId,CONSENT_SCOPE]})).rows[0];
    if(Number(current?.revision||0)!==input.revision) throw new PrivacyError("CONSENT_CONFLICT");
    const now=new Date().toISOString(), revision=input.revision+1;
    await tx.execute({sql:"INSERT INTO user_consents VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,scope) DO UPDATE SET state=excluded.state,consent_version=excluded.consent_version,policy_version=excluded.policy_version,revision=excluded.revision,operation_id=excluded.operation_id,text_hash=excluded.text_hash,language=excluded.language,updated_at=excluded.updated_at",args:[userId,CONSENT_SCOPE,input.state,CONSENT_VERSION,POLICY_VERSION,revision,input.operationId,input.textHash,input.language,now]});
    await tx.execute({sql:"INSERT INTO consent_events VALUES (?,?,?,?,?,?,?,?,?,?)",args:[userId,input.operationId,payloadHash,input.state,CONSENT_VERSION,POLICY_VERSION,revision,input.textHash,input.language,now]});
  });
  return getConsent(userId,input.language);
}
export type AiPermit={userId:string; operationId:string; generation:number; revision:number};
export async function startAi(userId:string,operationId:string,kind:string,payload:unknown):Promise<AiPermit> {
  if(!/^[a-zA-Z0-9_-]{8,120}$/.test(operationId)) throw new PrivacyError("INVALID_AI_OPERATION",400);
  return database().transaction(async tx=>{
    const generation=await activeUser(tx,userId);
    const consent=(await tx.execute({sql:"SELECT * FROM user_consents WHERE user_id=? AND scope=?",args:[userId,CONSENT_SCOPE]})).rows[0];
    if(consent?.state!=="granted") throw new PrivacyError("AI_CONSENT_REQUIRED",403);
    if(consent.consent_version!==CONSENT_VERSION) throw new PrivacyError("AI_CONSENT_OUTDATED",403);
    const existing=(await tx.execute({sql:"SELECT * FROM ai_operations WHERE user_id=? AND operation_id=?",args:[userId,operationId]})).rows[0];
    if(existing) throw new PrivacyError(existing.payload_hash===hash(JSON.stringify(payload)) && existing.kind===kind ? "AI_OPERATION_ALREADY_STARTED" : "OPERATION_CONFLICT");
    const revision=Number(consent.revision);
    await tx.execute({sql:"INSERT INTO ai_operations VALUES (?,?,?,?,?,?,?,?)",args:[userId,operationId,kind,hash(JSON.stringify(payload)),generation,revision,"started",new Date().toISOString()]});
    return {userId,operationId,generation,revision};
  });
}
export async function checkPermit(tx:Transaction,p:AiPermit) {
  if(await activeUser(tx,p.userId)!==p.generation) throw new PrivacyError("ACCOUNT_CHANGED");
  const row=(await tx.execute({sql:"SELECT * FROM user_consents WHERE user_id=? AND scope=?",args:[p.userId,CONSENT_SCOPE]})).rows[0];
  if(row?.state!=="granted" || row.consent_version!==CONSENT_VERSION || Number(row.revision)!==p.revision) throw new PrivacyError("AI_CONSENT_CHANGED",403);
}
export async function finishAi<T>(p:AiPermit,result:T,save?:(tx:Transaction)=>Promise<void>):Promise<T> {
  return database().transaction(async tx=>{
    await checkPermit(tx,p);
    if(save) await save(tx);
    await tx.execute({sql:"UPDATE ai_operations SET state='completed' WHERE user_id=? AND operation_id=?",args:[p.userId,p.operationId]});
    return result;
  });
}
