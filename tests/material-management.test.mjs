import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter((f) => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
const db = {
  prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async run() { return { meta: sqlite.prepare(sql).run(...values) }; },
    };
  },
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; },
};
globalThis.__testD1 = db;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: 'data:text/javascript,export const env = { DB: globalThis.__testD1 };', shortCircuit: true };
    if (specifier === "../lib/daily-review") return next(new URL("../lib/daily-review.ts", context.parentURL).href, context);
    if (specifier === "../lib/review") return next(new URL("../lib/review.ts", context.parentURL).href, context);
    return next(specifier, context);
  },
});
const { loadAppData, seedIfEmpty, manageMaterial, saveGeneratedSet, reviewCard, organizeSets, loadDailyReview } = await import("../db/store.ts");

test("first use is empty; sample is explicit and is not duplicated", async () => {
  assert.equal((await loadAppData("new-user")).sets.length, 0);
  await seedIfEmpty("new-user");
  await seedIfEmpty("new-user");
  const data = await loadAppData("new-user");
  assert.equal(data.sets.length, 1);
  assert.equal(data.sets[0].cards.length, 3);
});

test("editing, archiving and reversible deletion preserve user data and ownership", async () => {
  const setId = await saveGeneratedSet("owner", { title: "元の名前", category: "テスト", summary: "", keyPoints: [], sourceContent: "元資料", cards: [{ question: "Q", answer: "A", format: "multiple_choice", choices: ["A", "B", "C", "D"], difficulty: 1 }] });
  const card = (await loadAppData("owner")).sets[0].cards[0];
  await assert.rejects(manageMaterial("other", { action: "deleteCard", cardId: card.id }), /CARD_NOT_FOUND/);
  await assert.rejects(manageMaterial("other", { action: "renameSet", setId, title: "侵入" }), /SET_NOT_FOUND/);
  await assert.rejects(manageMaterial("owner", { action: "editCard", cardId: card.id, question: "Q2", answer: "X", choices: ["A", "B", "C", "D"] }), /INVALID_CHOICES/);
  await manageMaterial("owner", { action: "editCard", cardId: card.id, question: "Q2", answer: "B", choices: ["A", "B", "C", "D"] });
  await manageMaterial("owner", { action: "renameSet", setId, title: "新しい名前" });
  await reviewCard("owner", card.id, "good", 500, "session");
  for (const [action, status] of [["archiveCard", "アーカイブ"], ["deleteCard", "削除済み"]]) {
    await manageMaterial("owner", { action, cardId: card.id });
    const hidden = (await loadAppData("owner")).sets[0];
    assert.equal(hidden.cards[0].status, status);
    assert.equal(hidden.nextReviewAt, null);
    await assert.rejects(reviewCard("owner", card.id, "good", 500, "session"), /CARD_NOT_FOUND/);
    await manageMaterial("owner", { action: "restoreCard", cardId: card.id });
  }
  const restored = await loadAppData("owner");
  assert.equal(restored.sets[0].title, "新しい名前");
  assert.equal(restored.sets[0].sourceContent, "元資料");
  assert.equal(restored.sets[0].cards[0].question, "Q2");
  assert.equal(restored.sets[0].cards[0].answer, "B");
  assert.equal(restored.sets[0].cards[0].status, "復習待ち");
  assert.equal(restored.sets[0].cards[0].reviewCount, 1);
  assert.equal(restored.reviews.length, 1);
  assert.ok(restored.sets[0].nextReviewAt);
});


test("nested folders persist, accept sets, and enforce ownership", async () => {
  const root = await organizeSets("folders-owner", { action: "createFolder", folderId: null, name: "資格の勉強" });
  const child = await organizeSets("folders-owner", { action: "createFolder", folderId: root, name: "法律" });
  const setId = await saveGeneratedSet("folders-owner", { folderId: child, title: "行政", category: "法律", summary: "", keyPoints: [], sourceContent: "保存元", cards: [{ question: "Q", answer: "A", format: "qa", choices: [], difficulty: 1 }] });
  let data = await loadAppData("folders-owner");
  assert.equal(data.folders.find((f) => f.id === child).parentId, root);
  assert.equal(data.sets[0].folderId, child);
  await organizeSets("folders-owner", { action: "renameFolder", folderId: child, name: "行政法" });
  await organizeSets("folders-owner", { action: "moveSet", setId, folderId: root });
  data = await loadAppData("folders-owner");
  assert.equal(data.folders.find((f) => f.id === child).name, "行政法");
  assert.equal(data.sets[0].folderId, root);
  assert.equal(data.sets[0].cards.length, 1);
  await assert.rejects(organizeSets("other", { action: "createFolder", folderId: root, name: "侵入" }), /FOLDER_NOT_FOUND/);
  await assert.rejects(organizeSets("other", { action: "renameFolder", folderId: root, name: "侵入" }), /FOLDER_NOT_FOUND/);
  await assert.rejects(organizeSets("other", { action: "moveSet", setId, folderId: null }), /SET_NOT_FOUND/);
  const otherFolder = await organizeSets("other", { action: "createFolder", folderId: null, name: "他人のフォルダ" });
  await assert.rejects(organizeSets("folders-owner", { action: "moveSet", setId, folderId: otherFolder }), /FOLDER_NOT_FOUND/);
  await organizeSets("folders-owner", { action: "moveSet", setId, folderId: null });
  assert.equal((await loadAppData("folders-owner")).sets[0].folderId, null);
  assert.equal((await loadAppData("other")).folders.length, 1);
});


test("English sample is generated once and existing material is not translated", async () => {
  await seedIfEmpty("english-sample", "en");
  const data = await loadAppData("english-sample");
  assert.equal(data.sets[0].title, "Spinoza");
  assert.match(data.sets[0].cards[0].question, /Spinoza/);
  await seedIfEmpty("english-sample", "ja");
  assert.equal((await loadAppData("english-sample")).sets[0].title, "Spinoza");
});

test("daily ToDos persist, require every card, and freeze completed assignments", async () => {
  const user = "daily-owner";
  const material = (title) => ({ title, category: "test", summary: "", keyPoints: [], sourceContent: "source", cards: [{ question: "Q", answer: "A", format: "qa", choices: [], difficulty: 1 }] });
  await saveGeneratedSet(user, material("one"));
  await saveGeneratedSet(user, material("two"));
  const before = await loadAppData(user);
  const ids = before.dailyReview.cardIds;
  assert.equal(ids.length, 2);
  assert.equal(before.dailyReview.completed, false);
  await reviewCard(user, ids[0], "good", 500, "session");
  const partial = await loadAppData(user);
  assert.deepEqual(partial.dailyReview.cardIds, ids);
  assert.equal(partial.dailyReview.completedCardIds.length, 1);
  assert.equal(partial.dailyReview.completed, false);
  await reviewCard(user, ids[1], "again", 500, "session");
  assert.equal((await loadDailyReview(user)).completed, false);
  await reviewCard(user, ids[1], "good", 500, "session");
  const complete = await loadDailyReview(user);
  assert.equal(complete.completed, true);
  assert.equal(complete.streak, 1);
  await saveGeneratedSet(user, material("later"));
  assert.deepEqual((await loadDailyReview(user)).cardIds, ids);
  assert.equal((await loadDailyReview("other-daily-user")).completed, false);
  const next = await loadDailyReview(user, new Date(Date.now() + 86400000));
  assert.equal(next.completed, false);
  assert.equal(next.streak, 1);
});

test("adding generated cards to an existing set preserves folder and both source texts", async () => {
  const { addCardsToSet } = await import('../db/store.ts');
  const user = 'append-import';
  const folderId = await organizeSets(user,{action:'createFolder',folderId:null,name:'保存先'});
  const cards = [{question:'First',answer:'Answer',format:'qa',choices:[],difficulty:1}];
  const setId = await saveGeneratedSet(user,{folderId,title:'既存セット',category:'test',summary:'',keyPoints:[],sourceContent:'元の文章',cards});
  await assert.rejects(addCardsToSet('intruder',setId,cards,{title:'bad',content:'bad'}), /SET_NOT_FOUND/);
  await addCardsToSet(user,setId,[{...cards[0],question:'追加質問'}],{title:'添付資料',content:'追加の文章'});
  const set = (await loadAppData(user)).sets[0];
  assert.equal(set.title,'既存セット');
  assert.equal(set.folderId,folderId);
  assert.equal(set.cards.length,2);
  assert.match(set.sourceContent,/元の文章/);
  assert.match(set.sourceContent,/添付資料[\s\S]*追加の文章/);
  assert.ok(!set.sourceContent.includes('bad'));
});

test('long-term cards are separate from newly assigned daily tasks', async () => {
  const user = 'long-memory';
  const now = new Date();
  const setId = await saveGeneratedSet(user,{title:'Memory',category:'test',summary:'',keyPoints:[],sourceContent:'Source',cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}]});
  sqlite.prepare("UPDATE cards SET interval_days=60,status='定着中',due_at=? WHERE set_id=?").run(new Date(now.getTime()-1000).toISOString(),setId);
  assert.deepEqual((await loadDailyReview(user,now)).cardIds,[]);
  const card = (await loadAppData(user)).sets[0].cards[0];
  await reviewCard(user,card.id,'again',100,'memory-retry');
  assert.ok((await loadDailyReview(user,now)).cardIds.includes(card.id));
});
