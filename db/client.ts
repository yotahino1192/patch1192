import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export function createDatabase(client: Client, migrationsDirectory = resolve(process.cwd(), "drizzle")) {
  let initialization: Promise<void> | undefined;
  async function migrate() {
    // A write transaction also serializes initialization across serverless instances.
    const tx = await client.transaction("write");
    try {
      await tx.execute("CREATE TABLE IF NOT EXISTS _loop_migrations (name TEXT PRIMARY KEY NOT NULL)");
      const applied = new Set((await tx.execute("SELECT name FROM _loop_migrations")).rows.map((row) => String(row.name)));
      const files = (await readdir(migrationsDirectory)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
      for (const name of files) {
        if (applied.has(name)) continue;
        const sql = await readFile(resolve(migrationsDirectory, name), "utf8");
        for (let statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
          // Existing D1 exports already contain these tables/columns. Adopt them without dropping data.
          statement = statement.replace(/^CREATE TABLE\s+(?!IF NOT EXISTS)/i, "CREATE TABLE IF NOT EXISTS ").replace(/^CREATE INDEX\s+(?!IF NOT EXISTS)/i, "CREATE INDEX IF NOT EXISTS ");
          const add = statement.match(/^ALTER TABLE [`"]?(\w+)[`"]? ADD (?:COLUMN )?[`"]?(\w+)[`"]?/i);
          if (add) {
            const columns = await tx.execute(`PRAGMA table_info("${add[1]}")`);
            if (columns.rows.some((column) => column.name === add[2])) continue;
          }
          await tx.execute(statement);
        }
        await tx.execute({ sql: "INSERT INTO _loop_migrations (name) VALUES (?)", args: [name] });
      }
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
    finally { tx.close(); }
  }
  function initialize() {
    initialization ??= migrate().catch((error) => { initialization = undefined; throw error; });
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
      async all<T = Record<string, unknown>>() { await initialize(); return { results: (await client.execute({ sql, args })).rows as unknown as T[] }; },
      async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; },
      async run() { await initialize(); const result = await client.execute({ sql, args }); return { meta: { changes: result.rowsAffected } }; },
    };
  }
  return {
    initialize, prepare,
    async batch(statements: Array<{ sql: string; args: InValue[] }>) {
      await initialize();
      return client.batch(statements.map(({ sql, args }) => ({ sql, args })), "write");
    },
  };
}
let client: Client | undefined;
let db: ReturnType<typeof createDatabase> | undefined;
export function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    if (process.env.VERCEL && (!url || url.startsWith("file:"))) throw new Error("DATABASE_NOT_CONFIGURED");
    if (!url) mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });
    client = createClient({ url: url || "file:.data/loop.db", authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}
export function database() { return db ??= createDatabase(getClient()); }
export async function initializeDatabase() {
  if (!process.env.TURSO_DATABASE_URL && !process.env.VERCEL) await mkdir(resolve(process.cwd(), ".data"), { recursive: true });
  await database().initialize();
}
