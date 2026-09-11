import { database } from "./client";

// Only verified provider identities reach this function. Email is never an owner key.
export async function resolveInternalUser(issuer: string, subject: string): Promise<string> {
  return database().transaction(async (tx) => {
    const existing = (await tx.execute({
      sql: "SELECT u.id FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.issuer = ? AND i.subject = ?",
      args: [issuer, subject],
    })).rows[0];
    if (existing) return String(existing.id);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    await tx.execute({ sql: "INSERT INTO users (id, created_at) VALUES (?, ?)", args: [userId, now] });
    await tx.execute({ sql: "INSERT INTO auth_identities (issuer, subject, user_id, created_at) VALUES (?, ?, ?, ?)", args: [issuer, subject, userId, now] });
    return userId;
  });
}
