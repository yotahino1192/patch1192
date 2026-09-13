import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: ["./db/schema.ts", "./db/ai-schema.ts", "./db/retention-schema.ts", "./db/domain-schema.ts"],
  dialect: "sqlite",
});
