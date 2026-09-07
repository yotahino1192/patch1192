import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      for (const suffix of [".tsx", ".ts"]) {
        const url = new URL(specifier + suffix, context.parentURL);
        if (existsSync(url)) return next(url.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
const { translate, LanguageProvider } = await import("../app/language.tsx");
const { MaterialManager } = await import("../app/material-manager.tsx");
const { SetLibrary } = await import("../app/set-library.tsx");
const { DailyReviewRail } = await import("../app/daily-review.tsx");
const set = { id: "s1", folderId: null, title: "私の教材", sourceContent: "日本語の元資料", cards: [{ id: "c1", question: "日本語の質問", answer: "日本語の答え", status: "未学習", choices: [], format: "qa" }] };
const render = (language, child) => renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: language }, child));

test("language translations interpolate values without changing user content", () => {
  assert.equal(translate("en", "今日の復習を始める · {0}枚", 12), "Start today's review · 12 cards");
  assert.equal(translate("ja", "今日の復習を始める · {0}枚", 12), "今日の復習を始める · 12枚");
  assert.equal(translate("en", "私の教材"), "私の教材");
});

test("material manager has English controls while retaining the original cards", () => {
  const html = render("en", React.createElement(MaterialManager, { set, onData() {} }));
  for (const label of ["Manage material", "Save name", "Active", "Archived", "Deleted", "Edit", "Delete"]) assert.ok(html.includes(label), label);
  assert.ok(html.includes("日本語の質問"));
  assert.ok(html.includes("日本語の元資料"));
  assert.ok(!html.includes("教材を管理"));
  const ja = render("ja", React.createElement(MaterialManager, { set, onData() {} }));
  assert.ok(ja.includes("教材を管理"));
  assert.ok(ja.includes("未学習") === false);
});

test("folder library renders both languages without translating folder names", () => {
  const props = { data: { sets: [set], folders: [{ id: "f1", parentId: null, name: "資格の勉強" }], reviews: [], chatMessages: [] }, folderId: null, openSetId: null, onFolder() {}, onSet() {}, onData() {}, onAdd() {} };
  const en = render("en", React.createElement(SetLibrary, props));
  for (const text of ["All materials", "Create folder", "Add a card set", "Move", "資格の勉強", "私の教材"]) assert.ok(en.includes(text), text);
  const ja = render("ja", React.createElement(SetLibrary, props));
  assert.ok(ja.includes("フォルダを作成"));
});


test("daily review starts with a locked button and a closed task panel in both languages", () => {
  const data = { sets: [set], dailyReview: { cardIds: ["c1"], completedCardIds: [], completed: false, achievedDays: [], streak: 0, day: "2026-09-06" } };
  for (const language of ["ja", "en"]) {
    const html = render(language, React.createElement(DailyReviewRail, { data, now: new Date("2026-09-06T12:00:00+09:00"), onStudy() {} }));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(html.includes('<svg'));
    assert.ok(!html.includes('class="daily-review-popover"'));
  }
});
