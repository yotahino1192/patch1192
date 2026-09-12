import { identityHash } from "./privacy-store";
import { PrivacyError } from "../lib/privacy-error";
import { database } from "./client";

// Only verified provider identities reach this function. Email is never an owner key.
export async function resolveInternalUser(issuer: string, subject: string): Promise<string> {
  return database().transaction(async (tx) => {
    if ((await tx.execute({sql:"SELECT 1 FROM deleted_identity_tombstones WHERE identity_hash=?",args:[identityHash(issuer,subject)]})).rows.length) throw new PrivacyError("ACCOUNT_DELETED",403);
    const existing = (await tx.execute({
      sql: "SELECT u.id,u.lifecycle_state FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.issuer = ? AND i.subject = ?",
      args: [issuer, subject],
    })).rows[0];
    if (existing) { if(existing.lifecycle_state !== "active") throw new PrivacyError("ACCOUNT_DELETING",403); return String(existing.id); }
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    await tx.execute({ sql: "INSERT INTO users (id, created_at) VALUES (?, ?)", args: [userId, now] });
    await tx.execute({ sql: "INSERT INTO auth_identities (issuer, subject, user_id, created_at) VALUES (?, ?, ?, ?)", args: [issuer, subject, userId, now] });
    return userId;
  });
}
