import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server-renders the Loop application shell", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /title:\s*"Loop/);
  assert.match(page, /学習データを準備しています/);
  assert.match(page, /メインナビゲーション/);
  assert.match(page, /回答を表示すると理解度を選べます/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps OpenAI secrets server-side and enables durable product data", async () => {
  const [page, openai, hosting, envExample] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/openai.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\/api\/ai\/cards/);
  assert.match(page, /\/api\/ai\/chat/);
  assert.doesNotMatch(page, /OPENAI_API_KEY|Bearer\s+sk-/);
  assert.match(openai, /OPENAI_API_KEY/);
  assert.match(openai, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(envExample, /^OPENAI_API_KEY=$/m);
});
