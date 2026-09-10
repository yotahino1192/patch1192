import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";
import { createClient } from "@libsql/client";
import { createDatabase } from "../db/client.ts";

const client = createClient({ url: ":memory:" });
const db = createDatabase(client);
globalThis.__undoDatabase = db;
after(() => client.close());
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "./client") return { url: 'data:text/javascript,export function database(){return globalThis.__undoDatabase;} export async function initializeDatabase(){await globalThis.__undoDatabase.initialize();}', shortCircuit: true };
  if (["../lib/daily-review", "../lib/review"].includes(specifier)) return next(new URL(specifier + ".ts", context.parentURL).href, context);
  return next(specifier, context);
} });
const { saveGeneratedSet, loadAppData, reviewCard, undoReview, manageMaterial } = await import("../db/store.ts");
async function makeCard(owner) {
  await saveGeneratedSet(owner, { title: "Test", category: "Test", summary: "", keyPoints: [], sourceContent: "Source", cards: [{ question: "Q", answer: "A", format: "qa", choices: [], difficulty: 1 }] });
  return (await loadAppData(owner)).sets[0].cards[0];
}
const schedule = ({ status, dueAt, intervalDays, reviewCount, correctCount }) => ({ status, dueAt, intervalDays, reviewCount, correctCount });

test("undo restores schedule, review counts, last studied date and daily achievement", async () => {
  const card = await makeCard("undo-owner");
  const reviewId = await reviewCard("undo-owner", card.id, "good", 2000, "session");
  assert.equal((await loadAppData("undo-owner")).dailyReview.completed, true);
  await undoReview("undo-owner", reviewId, "session");
  const restored = await loadAppData("undo-owner");
  assert.deepEqual(schedule(restored.sets[0].cards[0]), schedule(card));
  assert.equal(restored.reviews.length, 0);
  assert.equal(restored.sets[0].lastStudiedAt, null);
  assert.equal(restored.sets[0].nextReviewAt, card.dueAt);
  assert.equal(restored.dailyReview.completed, false);
  assert.equal(restored.dailyReview.streak, 0);
  assert.deepEqual(restored.undoneReviewIds, [reviewId]);
  await undoReview("undo-owner", reviewId, "session");
  assert.deepEqual(schedule((await loadAppData("undo-owner")).sets[0].cards[0]), schedule(card));
});

test("undoing another attempt preserves an earlier successful daily review", async () => {
  const card = await makeCard("repeat-owner");
  await reviewCard("repeat-owner", card.id, "good", 100, "first");
  const before = await loadAppData("repeat-owner");
  const reviewId = await reviewCard("repeat-owner", card.id, "again", 100, "second");
  await undoReview("repeat-owner", reviewId, "second");
  const restored = await loadAppData("repeat-owner");
  assert.equal(restored.dailyReview.completed, true);
  assert.deepEqual(schedule(restored.sets[0].cards[0]), schedule(before.sets[0].cards[0]));
});

test("undo cannot touch another user or session, or overwrite a newer review", async () => {
  const card = await makeCard("guard-owner");
  const first = await reviewCard("guard-owner", card.id, "good", 100, "first");
  await assert.rejects(undoReview("someone-else", first, "first"), /UNDO_NOT_AVAILABLE/);
  await assert.rejects(undoReview("guard-owner", first, "different"), /UNDO_NOT_AVAILABLE/);
  await reviewCard("guard-owner", card.id, "good", 100, "second");
  await assert.rejects(undoReview("guard-owner", first, "first"), /UNDO_NOT_AVAILABLE/);
  assert.equal((await loadAppData("guard-owner")).reviews.length, 2);
});

test("undo preserves content edits and fails atomically if a database write fails", async () => {
  const card = await makeCard("atomic-owner");
  const reviewId = await reviewCard("atomic-owner", card.id, "good", 100, "lesson");
  await manageMaterial("atomic-owner", { action: "editCard", cardId: card.id, question: "Edited question", answer: "Edited answer", choices: [] });
  await client.execute("CREATE TRIGGER fail_undo BEFORE UPDATE ON cards WHEN NEW.review_count < OLD.review_count BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await assert.rejects(undoReview("atomic-owner", reviewId, "lesson"));
  assert.equal((await loadAppData("atomic-owner")).reviews.length, 1);
  await client.execute("DROP TRIGGER fail_undo");
  await undoReview("atomic-owner", reviewId, "lesson");
  const updated = (await loadAppData("atomic-owner")).sets[0].cards[0];
  assert.equal(updated.question, "Edited question");
  assert.equal(updated.answer, "Edited answer");
  assert.equal(updated.reviewCount, 0);
});
