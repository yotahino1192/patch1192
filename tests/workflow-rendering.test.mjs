import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_SESSION } from "../lib/workspace.ts";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith(".module.css")) return {url:"data:text/javascript,export default new Proxy({}, {get:(_,key)=>String(key)})",shortCircuit:true};
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      for (const suffix of [".tsx", ".ts"]) {
        const url = new URL(specifier + suffix, context.parentURL);
        if (existsSync(url)) return next(url.href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith(".tsx")) return next(url, context);
    let source = readFileSync(new URL(url), "utf8");
    // Expose the actual screen components only inside this test process.
    if (url.endsWith("/app/page.tsx")) source += "\nexport { Home, Shell, SetDetail, ImportScreen, Study };";
    return { format: "module", shortCircuit: true, source: ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
  },
});
const { Home, Shell, SetDetail, ImportScreen, Study } = await import("../app/page.tsx");
const { LanguageProvider } = await import("../app/language.tsx");
const noop = () => {};
const now = new Date("2026-09-09T09:00:00+09:00");
const card = { id: "c1", setId: "s1", question: "テスト用の質問", answer: "B", format: "multiple_choice", choices: ["A", "B", "C", "D"], status: "未学習", dueAt: now.toISOString(), intervalDays: 0, reviewCount: 0 };
const set = { id: "s1", title: "テスト教材", folderId: null, category: "テスト", summary: "教材の概要", cards: [card], sourceContent: "元の資料", lastStudiedAt: null, nextReviewAt: now.toISOString() };
const data = { sets: [set], folders: [], reviews: [], chatMessages: [], dailyReview: { day: "2026-09-09", cardIds: ["c1"], completedCardIds: [], completed: false, achievedDays: [], streak: 0 } };
const render = (component, props, language = "ja") => renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: language }, React.createElement(component, props)));

test("home keeps Streak and paused learning without review-management UI", () => {
  const html = render(Home, { data, now, startStudy: noop, setScreen: noop, selectSet: noop, onSample: noop, onResume: noop, resumableSessions: [{ ...EMPTY_SESSION, id: "lesson", setId: "s1", queue: ["c1"] }] });
  assert.ok(!html.includes("今日のToDo"));
  assert.ok(html.indexOf('class="daily-review-rail"') < html.indexOf('class="home-resume-list"'));
  assert.ok(!html.includes('class="home-study-start"'));
  assert.ok(html.includes("続きから学習 · 残り1枚"));
  assert.ok(!html.includes('class="daily-todo-content"'));
  assert.equal((html.match(/新しい教材を追加|自分の文章から作る|＋ 教材を追加する/g) || []).length, 1);
});

test("navigation has four destinations and study is a dedicated screen", () => {
  const home = render(Shell, { screen: "home", setScreen: noop, children: "Content" });
  assert.equal((home.match(/class="nav-icon nav-image"/g) || []).length, 4);
  const header = home.match(/<header[\s\S]*?<\/header>/)?.[0];
  assert.ok(header.includes('aria-label="設定"'));
  assert.ok(!header.includes("日本語"));
  assert.match(home, /<dialog[^>]*class="settings-dialog"/);
  assert.doesNotMatch(home, /<dialog[^>]*\bopen(?:[\s=>])/);
  const study = render(Shell, { screen: "study", setScreen: noop, children: "Study content" });
  assert.ok(!study.includes('class="bottom-nav"'));
  assert.ok(!study.includes('class="language-selector'));
  assert.ok(study.includes("Study content"));
});

test("set viewing has one card list and offers study before the list", () => {
  const html = render(SetDetail, { data, selectedSetId: "s1", selectSet: noop, startStudy: noop, now, onData: noop });
  assert.equal((html.match(/テスト用の質問/g) || []).length, 1);
  assert.ok(!html.includes("material-manager"));
  assert.ok(html.includes("編集"));
  assert.ok(html.indexOf("このセットを学習") < html.indexOf("カード一覧"));
});

test("saved import content and attachment text render after returning", () => {
  const html = render(ImportScreen, { data, destination: "root", setDestination: noop, onGenerate: noop, setImportDraft: noop, importDraft: { build: { step: 2 }, text: "書きかけの文章", detail: "標準", style: "一問一答", attachments: [{ id: "f1", name: "講義.txt", text: "添付の本文" }] } });
  for (const text of ["書きかけの文章", "講義.txt", "Accepted for processing"]) assert.ok(html.includes(text));
});

test("Free v1 resumes multiple-choice feedback while keeping deferred AI UI hidden", () => {
  const session = { ...EMPTY_SESSION, id: "lesson", setId: "s1", queue: ["c1"], flipped: true, selectedChoice: "B", aiOpen: true, aiCompose: true, aiInput: "どうして？" };
  const html = render(Study, { session, updateSession: noop, data, queue: session.queue, flipped: true, setFlipped: noop, setQueue: noop, sessionDone: false, setSessionDone: noop, sessionSetId: "s1", sessionId: "lesson", sessionTotal: 1, sessionMistakes: 0, setSessionMistakes: noop, startStudy: noop, setData: noop, backToSets: noop, goHome: noop, now });
  assert.ok(html.includes("選択結果を記録して次へ"));
  assert.ok(!html.includes('value="どうして？"'));
  assert.equal(session.aiInput, 'どうして？', 'Stored draft is preserved, not rendered or sent');
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('choice-correct'));
  assert.ok(!html.includes('card-ai-button'));
  assert.ok(html.includes("中断する"));
  assert.equal((html.match(/class="flashcard /g) || []).length, 1);
});


test("five-card break offers continuing or stopping without marking the full lesson complete", () => {
  const session = { ...EMPTY_SESSION, id: "batch", setId: "s1", total: 8, queue: [], batchSize: 5, batchTotal: 5, batchDone: true, remaining: ["c6", "c7", "c8"] };
  const html = render(Study, { session, updateSession: noop, data, queue: [], flipped: false, setFlipped: noop, setQueue: noop, sessionDone: false, setSessionDone: noop, sessionSetId: "s1", sessionId: "batch", sessionTotal: 8, sessionMistakes: 0, setSessionMistakes: noop, startStudy: noop, setData: noop, backToSets: noop, goHome: noop, now });
  assert.ok(html.includes("5枚、おつかれさま！"));
  assert.ok(html.includes("次の3枚へ"));
  assert.ok(html.includes("今日はここまで"));
  assert.ok(!html.includes("レッスンが終了しました"));
});

test("a saved correction opens inside study with the original multiple-choice options", () => {
  const session = { ...EMPTY_SESSION, id: "edit", setId: "s1", queue: ["c1"], editDraft: { cardId: "c1", question: "編集中の質問", answer: "B", choices: ["A", "B", "C", "D"] } };
  const html = render(Study, { session, updateSession: noop, data, queue: session.queue, flipped: false, setFlipped: noop, setQueue: noop, sessionDone: false, setSessionDone: noop, sessionSetId: "s1", sessionId: "edit", sessionTotal: 1, sessionMistakes: 0, setSessionMistakes: noop, startStudy: noop, setData: noop, backToSets: noop, goHome: noop, now });
  assert.ok(html.includes("編集中の質問"));
  assert.ok(html.includes("保存して学習に戻る"));
  assert.ok(html.includes('value="D"'));
  assert.ok(!html.includes('class="flashcard '));
});

const homeProps = { now, startStudy: noop, setScreen: noop, selectSet: noop, onSample: noop, onResume: noop, onContinue: noop, resumableSessions: [] };
const retention = { version: 1, generatedAt: now.getTime(), expiresAt: now.getTime() + 3600000, day: 20, dayEnd: now.getTime() + 4000000, timezone: "Asia/Tokyo", achievedDays: [17, 19], streak: 2, hot: false, completed: false, broken: false, dueCount: 1, dueCardIds: ["c1"], reminderTime: "18:00", reviewReminder: false, streakWarning: false };
test("Home uses authoritative completion and hot/broken flags instead of legacy counters", () => {
  const legacyCompleted = { ...data, dailyReview: { ...data.dailyReview, completed: true, streak: 90 }, retention: { ...retention, streak: 12, hot: false } };
  const normal = render(Home, { ...homeProps, data: legacyCompleted }, "en");
  assert.ok(normal.includes('data-streak="normal"'));
  assert.ok(!normal.includes("Done for today!"));
  assert.ok(!normal.includes("Hot streak")); // A count alone cannot enable Hot UI.
  const hot = render(Home, { ...homeProps, data: { ...data, retention: { ...retention, hot: true, completed: true } } }, "en");
  assert.ok(hot.includes('data-streak="hot"'));
  assert.ok(hot.includes("Done for today!"));
  assert.equal((hot.match(/patch-streak-day is-achieved/g) || []).length, 2); // No inferred contiguous history.
  const broken = render(Home, { ...homeProps, data: { ...data, retention: { ...retention, broken: true, streak: 0 } } }, "en");
  assert.ok(broken.includes('data-streak="broken"'));
});
test("Home hides expired completion and uses a generic greeting when no profile name exists", () => {
  const html = render(Home, { ...homeProps, data: { ...data, retention: { ...retention, completed: true, expiresAt: now.getTime() - 1 } } }, "en");
  assert.ok(html.includes('data-streak="stale"'));
  assert.ok(!html.includes("Done for today!"));
  assert.ok(!html.includes("Yota"));
});
test("Home distinguishes empty material from learnable sample cards without inventing a lesson path", () => {
  const early = render(Home, { ...homeProps, data: { ...data, sets: [] } }, "en");
  assert.ok(early.includes("patch-home-early"));
  assert.ok(early.includes("3 cards"));
  const active = render(Home, { ...homeProps, data }, "en");
  assert.ok(!active.includes("patch-home-early"));
  assert.ok(active.includes("Start lesson"));
  assert.ok(!active.includes("Chapter"));
  assert.ok(!active.includes("Milestone"));
  assert.ok(!active.includes("7 minutes"));
});
test("Lesson completion renders supported results without promising a daily achievement for short practice", async () => {
  const { LessonCompletion } = await import("../app/lesson-completion.tsx");
  const html = render(LessonCompletion, { data: { ...data, retention }, now, cards: 3, mistakes: 2 }, "en");
  assert.ok(html.includes("Your practice has been saved."));
  assert.ok(!html.includes("completed today"));
  assert.ok(!html.includes("weak spot"));
  assert.ok(!html.includes("new concept"));
  assert.ok(html.includes("Recall retries"));
});

test("A mixed-set resumed review does not claim the first set describes the whole lesson", () => {
  const second = { ...set, id: "s2", title: "別の教材", cards: [{ ...card, id: "c2", setId: "s2" }] };
  const session = { ...EMPTY_SESSION, id: "mixed", setId: "s1", queue: ["c1", "c2"] };
  const html = render(Home, { ...homeProps, data: { ...data, sets: [set, second] }, resumableSessions: [session] }, "en");
  assert.ok(html.includes("Continue learning"));
  assert.match(html, /id="lesson-preview-title">Today&#x27;s review<\/h2>/);
  assert.ok(!html.includes('class="patch-preview-description"'));
});
