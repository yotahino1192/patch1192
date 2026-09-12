import { checkSchema, SchemaNotReady } from './runtime-schema.ts';
import { validateServer } from '../lib/env/server.ts';
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export function createDatabase(client: Client) {
  let initialization: Promise<void> | undefined;
  // Local SQLite connections cannot interleave commands with an open transaction.
  // Remote libSQL retains concurrency and serializes writes at the database.
  let localTail: Promise<unknown> = Promise.resolve();
  function access<T>(action: () => Promise<T>): Promise<T> {
    if (client.protocol !== "file") return action();
    const result = localTail.then(action);
    localTail = result.catch(() => undefined);
    return result;
  }
  function initialize() {
    initialization ??= checkSchema(client).catch(() => { initialization = undefined; throw new SchemaNotReady(); });
    return initialization;
  }
  function prepare(sql: string, args: InValue[] = []) {
    return {
      sql, args,
      bind(...values: unknown[]) {
        return prepare(sql, values.map((value): InValue => {
          if (value == null) return null;
          if (["string", "number", "bigint", "boolean"].includes(typeof value) || value instanceof Uint8Array || value instanceof ArrayBuffer) return value as InValue;
          throw new Error("INVALID_SQL_VALUE");
        }));
      },
      async all<T = Record<string, unknown>>() { await initialize(); return { results: (await access(() => client.execute({ sql, args }))).rows as unknown as T[] }; },
      async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; },
      async run() { await initialize(); const result = await access(() => client.execute({ sql, args })); return { meta: { changes: result.rowsAffected } }; },
    };
  }
  return {
    initialize, prepare,
    async transaction<T>(action: (tx: Transaction) => Promise<T>): Promise<T> {
      await initialize();
      return access(async () => {
      const tx = await client.transaction("write");
      try { const result = await action(tx); await tx.commit(); return result; }
      catch (error) { await tx.rollback(); throw error; }
      finally { tx.close(); }
      });
    },
    async batch(statements: Array<{ sql: string; args: InValue[] }>) {
      await initialize();
      return access(() => client.batch(statements.map(({ sql, args }) => ({ sql, args })), "write"));
    },
  };
}
let client: Client | undefined;
let db: ReturnType<typeof createDatabase> | undefined;
export function getClient() {
  if (!client) {
    const config = validateServer(process.env);
    const url = config.databaseUrl;
    if (process.env.VERCEL && (!url || url.startsWith("file:"))) throw new Error("DATABASE_NOT_CONFIGURED");
    if (url === "file:.data/loop.db") mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });
    client = createClient({ url: url || "file:.data/loop.db", authToken: config.databaseToken });
  }
  return client;
}
export function database() { return db ??= createDatabase(getClient()); }
export async function initializeDatabase() {
  await database().initialize();
}
