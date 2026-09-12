import { database } from "./client";
import { activeUser, hash, identityHash } from "./privacy-store";
import { PrivacyError } from "../lib/privacy-error";
type Verified={issuer:string;subject:string;sessionId:string;claims:Record<string,unknown>};
export async function createDeletionChallenge(userId:string,auth:Verified) {
  const id=crypto.randomUUID(),expiresAt=Date.now()+300000;
  await database().transaction(async tx=>{
    await activeUser(tx,userId);
    await tx.execute({sql:"DELETE FROM deletion_challenges WHERE user_id=?",args:[userId]});
    await tx.execute({sql:"INSERT INTO deletion_challenges VALUES (?,?,?,?,?,0)",args:[id,userId,auth.sessionId,String(auth.claims.reverification_id||""),expiresAt]});
  });
  return {challengeId:id,expiresAt};
}
export async function requestDeletion(auth:Verified,input:{challengeId:string;operationId:string;receipt:string}) {
  if(!/^[a-zA-Z0-9_-]{8,120}$/.test(input.operationId)||!/^[a-f0-9]{64}$/.test(input.receipt)) throw new PrivacyError("INVALID_DELETION",400);
  return database().transaction(async tx=>{
    const old=(await tx.execute({sql:"SELECT * FROM account_deletion_jobs WHERE issuer=? AND subject=?",args:[auth.issuer,auth.subject]})).rows[0];
    if(old) { if(old.receipt_hash!==hash(input.receipt)||old.operation_id!==input.operationId) throw new PrivacyError("ACCOUNT_DELETING",403); return {jobId:String(old.id),state:String(old.state)}; }
    const challenge=(await tx.execute({sql:"SELECT * FROM deletion_challenges WHERE id=?",args:[input.challengeId]})).rows[0];
    const owner=(await tx.execute({sql:"SELECT user_id FROM auth_identities WHERE issuer=? AND subject=?",args:[auth.issuer,auth.subject]})).rows[0];
    const fva=auth.claims.fva, verification=auth.claims.reverification_id;
    if(!challenge || challenge.used || Number(challenge.expires_at)<Date.now() || challenge.user_id!==owner?.user_id || challenge.session_id!==auth.sessionId || typeof verification!=="string" || !verification || verification===challenge.previous_verification_id || !Array.isArray(fva) || typeof fva[0]!=="number" || fva[0]<0 || fva[0]>=5) throw new PrivacyError("REAUTH_REQUIRED",403);
    const userId=String(owner!.user_id);
    await activeUser(tx,userId);
    if(userId==="loop-owner") throw new PrivacyError("INVALID_ACCOUNT",403);
    const jobId=crypto.randomUUID(),now=new Date().toISOString();
    await tx.execute({sql:"INSERT INTO account_deletion_jobs (id,user_id,issuer,subject,operation_id,receipt_hash,created_at) VALUES (?,?,?,?,?,?,?)",args:[jobId,userId,auth.issuer,auth.subject,input.operationId,hash(input.receipt),now]});
    // Durable tombstone is created before identities can disappear. Never expires while a provider deletion is pending.
    await tx.execute({sql:"INSERT INTO deleted_identity_tombstones VALUES (?,?,?)",args:[identityHash(auth.issuer,auth.subject),userId,now]});
    await tx.execute({sql:"UPDATE users SET lifecycle_state='deleting',generation=generation+1 WHERE id=?",args:[userId]});
    await tx.execute({sql:"UPDATE deletion_challenges SET used=1 WHERE id=?",args:[input.challengeId]});
    return {jobId,state:"pending"};
  });
}
export async function deletionStatus(receipt:string) {
  if(!/^[a-f0-9]{64}$/.test(receipt)) throw new PrivacyError("NOT_FOUND",404);
  const row=await database().prepare("SELECT state FROM account_deletion_jobs WHERE receipt_hash=?").bind(hash(receipt)).first();
  if(!row) throw new PrivacyError("NOT_FOUND",404);
  return {state:String(row.state)};
}
