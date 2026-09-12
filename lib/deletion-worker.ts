import { timingSafeEqual } from "node:crypto";
import { database } from "../db/client";
export type DeletionProvider={ inspectApple(subject:string):Promise<boolean>; deleteUser(subject:string):Promise<void>; revokeApple?:(subject:string)=>Promise<void> };
export function workerAuthorized(header:string|null) {
  const key=process.env.ACCOUNT_DELETION_WORKER_SECRET;
  if(!key || key.length<32 || !header) return false;
  const actual=Buffer.from(header),expected=Buffer.from(`Bearer ${key}`);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
async function clerkRequest(subject:string,method:string) {
  const key=process.env.CLERK_SECRET_KEY;
  if(!key) throw new Error("PROVIDER_NOT_CONFIGURED");
  const result=await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(subject)}`,{method,headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000),redirect:"error"});
  if(result.status===404) return null;
  if(!result.ok) throw new Error("PROVIDER_UNAVAILABLE");
  return result.json() as Promise<{external_accounts?:Array<{provider:string}>}>;
}
const provider:DeletionProvider={
  async inspectApple(subject) { const user=await clerkRequest(subject,"GET"); return Boolean(user?.external_accounts?.some((a:{provider:string})=>a.provider.includes("apple"))); },
  async deleteUser(subject) { await clerkRequest(subject,"DELETE"); },
};
// One bounded job per invocation; a scheduler must call this endpoint. No detached promises.
export async function runDeletionJob(remote:DeletionProvider=provider,now=Date.now()) {
  const db=database(),lease=crypto.randomUUID();
  const job=await db.transaction(async tx=>{
    const row=(await tx.execute({sql:"SELECT * FROM account_deletion_jobs WHERE state <> 'completed' AND next_attempt_at <= ? AND lease_until <= ? ORDER BY created_at LIMIT 1",args:[now,now]})).rows[0];
    if(!row) return null;
    await tx.execute({sql:"UPDATE account_deletion_jobs SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=?",args:[lease,now+120000,row.id]});
    return row;
  });
  if(!job) return {processed:false};
  const owned=async()=> {const row=await db.prepare("SELECT lease_token FROM account_deletion_jobs WHERE id=?").bind(job.id).first();if(row?.lease_token!==lease) throw new Error("LEASE_LOST");};
  try {
    if(job.user_id==="loop-owner") throw new Error("INVALID_OWNER");
    if(job.db_step!=="completed") await db.transaction(async tx=>{
      const locked=(await tx.execute({sql:"SELECT lease_token FROM account_deletion_jobs WHERE id=?",args:[job.id]})).rows[0];
      if(locked?.lease_token!==lease) throw new Error("LEASE_LOST");
      await tx.execute({sql: `UPDATE ai_requests SET result_json=NULL,key_hash=id,payload_hash=id,
        state=CASE WHEN state='succeeded' THEN 'expired' WHEN state='reserved' THEN 'failed_pre_dispatch' WHEN state='dispatching' THEN 'unknown' ELSE state END,
        cost_micros=CASE WHEN state='reserved' THEN 0 ELSE cost_micros END WHERE user_id=?`,args:[job.user_id]});
      for(const table of ["chat_messages","review_logs","daily_review_plans","cards","card_sets","sources","folders","user_profiles","consent_events","user_consents","ai_operations","deletion_challenges"]) {
        await tx.execute({sql:`DELETE FROM ${table} WHERE user_id=?`,args:[job.user_id]});
      }
      await tx.execute({sql:"UPDATE account_deletion_jobs SET db_step='completed' WHERE id=? AND lease_token=?",args:[job.id,lease]});
    });
    await owned();
    if(job.apple_step!=="completed") {
      const needsApple=await remote.inspectApple(String(job.subject));
      if(needsApple || job.apple_step==="pending") {
        await db.prepare("UPDATE account_deletion_jobs SET apple_step='pending' WHERE id=? AND lease_token=?").bind(job.id,lease).run();
        if(!remote.revokeApple) throw new Error("APPLE_REVOCATION_REQUIRED");
        await remote.revokeApple(String(job.subject));
        await db.prepare("UPDATE account_deletion_jobs SET apple_step='completed' WHERE id=? AND lease_token=?").bind(job.id,lease).run();
      }
    }
    await owned();
    await remote.deleteUser(String(job.subject)); // Clerk 404 is already deleted, not a failure.
    await db.transaction(async tx=>{
      const row=(await tx.execute({sql:"SELECT lease_token FROM account_deletion_jobs WHERE id=?",args:[job.id]})).rows[0];
      if(row?.lease_token!==lease) throw new Error("LEASE_LOST");
      await tx.execute({sql:"DELETE FROM auth_identities WHERE user_id=?",args:[job.user_id]});
      // Retain a minimal lifecycle tombstone to reject delayed database writes too.
      await tx.execute({sql:"UPDATE users SET lifecycle_state='deleted' WHERE id=?",args:[job.user_id]});
      await tx.execute({sql:"UPDATE account_deletion_jobs SET state='completed',clerk_step='completed',subject='',issuer='',completed_at=?,lease_token=NULL,lease_until=0,last_error=NULL WHERE id=?",args:[new Date().toISOString(),job.id]});
    });
    return {processed:true,state:"completed"};
  } catch(error) {
    const code=error instanceof Error && ["APPLE_REVOCATION_REQUIRED","INVALID_OWNER","LEASE_LOST","PROVIDER_NOT_CONFIGURED"].includes(error.message) ? error.message : "DELETION_STEP_FAILED";
    const delay=Math.min(21600000,60000*2**Math.min(Number(job.attempts),12));
    await db.prepare("UPDATE account_deletion_jobs SET state='retry',next_attempt_at=?,lease_token=NULL,lease_until=0,last_error=? WHERE id=? AND lease_token=?").bind(now+delay+Math.floor(Math.random()*10000),code,job.id,lease).run();
    return {processed:true,state:"retry",code};
  }
}
