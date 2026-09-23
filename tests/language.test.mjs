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
  assert.ok(!html.includes("日本語の元資料"), "Source stays out of the initial document until expanded");
  assert.ok(!html.includes("教材を管理"));
  const ja = render("ja", React.createElement(MaterialManager, { set, onData() {} }));
  assert.ok(ja.includes("教材を管理"));
  assert.ok(ja.includes("未学習") === false);
});

test("folder library renders both languages without translating folder names", () => {
  const props = { data: { sets: [set], folders: [{ id: "f1", parentId: null, name: "資格の勉強" }], reviews: [], chatMessages: [], dailyReview: { cardIds: [], completedCardIds: [], completed: false } }, now: new Date("2026-09-06T12:00:00+09:00"), folderId: null, openSetId: null, onFolder() {}, onSet() {}, onStudy() {}, onData() {}, onAdd() {} };
  const en = render("en", React.createElement(SetLibrary, props));
  for (const text of ["Today&#x27;s patch", "Folders", "All Patches", "資格の勉強", "私の教材"]) assert.ok(en.includes(text), text);
  const ja = render("ja", React.createElement(SetLibrary, props));
  assert.ok(ja.includes("フォルダ"));
  assert.ok(!ja.includes('class="folder-create"'));
  assert.ok(!en.includes('class="folder-create"'));
});


test("daily review has an accessible incomplete day and closed task panel in both languages", () => {
  const data = { sets: [set], dailyReview: { cardIds: ["c1"], completedCardIds: [], completed: false, achievedDays: [], streak: 0, day: "2026-09-06" } };
  for (const language of ["ja", "en"]) {
    const html = render(language, React.createElement(DailyReviewRail, { data, now: new Date("2026-09-06T12:00:00+09:00"), onStudy() {} }));
    assert.ok(html.includes('aria-expanded="false"'));
    assert.ok(html.includes(language === "en" ? "Not achieved" : "未達成"));
    assert.ok(html.includes('data-streak="normal"'));
    assert.ok(!html.includes('class="daily-todo-content"'));
  }
});

const { ImportScreen } = await import('../app/build-patch.tsx');
const { BuildReview, PatchReady } = await import('../app/build-review.tsx');
const { localizeBuildError } = await import('../app/build-copy.ts');
const { buildGenerationError } = await import('../lib/build-generation-error.ts');

test('Free v1 Add Material, Review and Ready follow locale while preserving exact user content', () => {
  const noop = () => {};
  const draft = { title: 'New Patch / 私の教材', keyPoints: ['Source material / 元資料'], cards: [{ ...set.cards[0], draftId: 'd1', selected: true }] };
  for (const language of ['ja', 'en']) {
    const importDraft = { text: 'Topic / 私が入力した文章', attachments: [{ id: 'a1', name: 'New Patch.txt', text: '添付の本文', status: 'accepted' }], detail: '標準', style: '一問一答', build: { step: 2 } };
    const add = render(language, React.createElement(ImportScreen, { data: { sets: [set] }, destination: 'root', setDestination: noop, importDraft, setImportDraft: noop, onGenerate: noop }));
    assert.ok(add.includes(language === 'ja' ? '何を学びたいですか？' : 'What do you want to learn?'));
    assert.ok(add.includes(language === 'ja' ? '処理の準備ができました' : 'Accepted for processing'));
    assert.ok(add.includes('Topic / 私が入力した文章'));
    assert.ok(add.includes('New Patch.txt'));
    const review = render(language, React.createElement(BuildReview, { draft, importDraft, data: { sets: [set] }, destination: 'root', setDestination: noop, setDraft: noop, onSave: noop, saving: false, pendingSave: false, error: 'Enter a Patch name of 1–120 characters.' }));
    assert.ok(review.includes(language === 'ja' ? 'パッチ名を1〜120文字で入力してください。' : 'Enter a Patch name of 1–120 characters.'));
    for (const text of [draft.title, draft.keyPoints[0], set.cards[0].question]) assert.ok(review.includes(text));
    const ready = render(language, React.createElement(PatchReady, { saved: { title: draft.title, appended: false }, onStart: noop, onHome: noop }));
    assert.ok(ready.includes(language === 'ja' ? 'パッチができました。' : 'Your Patch is ready.'));
    assert.ok(ready.includes(draft.title));
  }
});

test('legacy generation errors translate at presentation without changing error contracts', () => {
  for (const code of ['AI_CONSENT_REQUIRED','AI_UNKNOWN','AI_IN_PROGRESS','AI_INPUT_TOO_LARGE','AI_RATE_LIMIT','AI_REQUEST_FINAL','AI_INVALID_GENERATED_CONTENT','AI_PROVIDER_FAILED','AI_NOT_CONFIGURED','UNAUTHORIZED','OTHER']) {
    const message = buildGenerationError(code);
    assert.equal(localizeBuildError(message, key => translate('en', key)), message);
    assert.match(localizeBuildError(message, key => translate('ja', key)), /[ぁ-龯]/);
  }
});

const { SettingsDialog } = await import('../app/settings-dialog.tsx');
const { AccountContext } = await import('../app/account-context.tsx');
test('Settings uses the chosen system language and preserves account identity', () => {
  const account = { email: 'learner@example.test', logout() {}, scope: { request() {} } };
  for (const language of ['ja', 'en']) {
    const html = render(language, React.createElement(AccountContext.Provider, { value: account }, React.createElement(SettingsDialog, { dialogRef: React.createRef() })));
    for (const text of language === 'ja' ? ['環境設定', 'アカウントを削除', 'このアプリについて'] : ['Preferences', 'Delete Account', 'About']) assert.ok(html.includes(text));
    assert.ok(html.includes(account.email));
    assert.ok(!html.includes(language === 'ja' ? '>Preferences<' : 'ログアウトすると、この端末'));
  }
});
