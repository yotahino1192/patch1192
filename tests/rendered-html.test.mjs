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
  assert.match(page, /左で「もう一度」、右で「できた」/);
  assert.match(page, /レッスンが終了しました/);
  assert.match(page, /エビングハウスの忘却曲線/);
  assert.match(page, /AIに解説してもらう/);
  assert.match(page, /className="inline-ai-panel"/);
  assert.match(page, /このレッスンでAIと深掘りしたこと/);
  assert.match(page, /AI解説の学習履歴/);
  assert.doesNotMatch(page, /swipe-stamp/);
  assert.doesNotMatch(page, /rate\("hard"\)|rate\("easy"\)/);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps OpenAI secrets server-side and enables durable product data", async () => {
  const [page, openai, review, hosting, envExample] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/openai.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/review.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\/api\/ai\/cards/);
  assert.match(page, /\/api\/ai\/chat/);
  const nav = page.slice(page.indexOf("const navItems"), page.indexOf("class ApiError"));
  assert.match(nav, /\{ id: "import", label: "教材追加"/);
  assert.doesNotMatch(nav, /id: "ai"|label: "AI"/);
  assert.doesNotMatch(page, /setScreen\("ai"\)|screen === "ai"/);
  assert.doesNotMatch(page, /id="card-count"|type="range"|生成する枚数/);
  for (const format of ["一問一答", "4択問題", "自分で解説"]) assert.match(page, new RegExp(format));
  assert.match(page, /card\.format === "multiple_choice"/);
  assert.match(page, /card\.choices\.map/);
  assert.match(page, /const selectedCards = draft\.cards\.filter\(\(card\) => card\.selected\)/);
  assert.match(page, /aria-pressed=\{card\.selected\}/);
  const saveDraft = page.slice(page.indexOf("const saveDraft"), page.indexOf("let content"));
  assert.match(saveDraft, /filter\(\(card\) => card\.selected\)/);
  assert.doesNotMatch(page, /OPENAI_API_KEY|Bearer\s+sk-/);
  assert.match(openai, /OPENAI_API_KEY/);
  assert.match(openai, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(openai, /minItems: minCards/);
  assert.match(openai, /maxItems: maxCards/);
  assert.match(review, /\[1, 3, 7, 14, 30, 60, 120, 180, 365\]/);
  assert.match(review, /verdict === "correct" \? remaining : \[\.\.\.remaining, current\]/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(envExample, /^OPENAI_API_KEY=$/m);
});
