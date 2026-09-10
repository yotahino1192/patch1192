import assert from "node:assert/strict";
import test from "node:test";
import { activateSession, EMPTY_WORKSPACE, EMPTY_SESSION, parseWorkspace, reconcileSession, reconcileWorkspace, startStudyBatch, nextStudyBatch, pendingStudyCount, studyUndoCheckpoint, studyReturnTarget, resolveStudyReturn } from "../lib/workspace.ts";

const session = { ...EMPTY_SESSION, id: "lesson-1", scope: "set-1", setId: "set-1", queue: ["c1", "c2"], total: 2, flipped: true, selectedChoice: "B", aiInput: "この理由は？", aiOpen: true, aiCompose: true };
const data = {
  sets: [{ id: "set-1", cards: [
    { id: "c1", setId: "set-1", format: "multiple_choice", choices: ["A", "B", "C", "D"], status: "未学習" },
    { id: "c2", setId: "set-1", format: "qa", choices: [], status: "復習待ち" },
  ] }], folders: [], reviews: [],
};

test("reload retains imported text, attachments, edited candidates and selected answer", () => {
  const workspace = {
    ...EMPTY_WORKSPACE,
    importDraft: { text: "未完成の教材", detail: "詳しく", style: "4択問題", attachments: [{ id: "file-1", name: "ノート.txt", text: "読み取った内容" }] },
    destination: "set:set-1", lastGeneration: { text: "生成した元文章", detail: "標準", style: "一問一答" },
    draft: { title: "編集中のセット", category: "学習", summary: "概要", sourceContent: "元文章", keyPoints: ["要点"], cards: [{ draftId: "draft-1", question: "編集中の問い", answer: "書きかけの答え", choices: [], format: "qa", difficulty: 2, selected: false }] },
    session,
  };
  const restored = reconcileWorkspace(parseWorkspace(JSON.stringify(workspace)), data);
  assert.deepEqual(restored, workspace);
});

test("starting a different lesson preserves the paused lesson and resuming swaps them", () => {
  const next = { ...EMPTY_SESSION, id: "lesson-2", scope: "set-2", setId: "set-2", queue: ["c3"], total: 1 };
  const switched = activateSession({ ...EMPTY_WORKSPACE, session }, next);
  assert.deepEqual(switched.pausedSessions, [session]);
  const resumed = activateSession(switched, session);
  assert.deepEqual(resumed.session, session);
  assert.deepEqual(resumed.pausedSessions, [next]);
  assert.equal(activateSession(resumed, session).pausedSessions.length, 1);
});

test("a reload during the success animation skips the answer already saved on the server", () => {
  const restored = reconcileSession(session, { ...data, reviews: [{ sessionId: session.id, cardId: "c1", rating: "good" }] });
  assert.deepEqual(restored.queue, ["c2"]);
  assert.equal(restored.total, 2);
  assert.equal(restored.flipped, false);
  assert.equal(restored.selectedChoice, null);
  assert.equal(restored.aiInput, "");
  assert.equal(restored.aiOpen, false);
});

test("incorrect cards stay pending and reviews from other sessions do not skip a card", () => {
  const restored = reconcileSession(session, { ...data, reviews: [{ sessionId: session.id, cardId: "c1", rating: "again" }, { sessionId: "different-session", cardId: "c2", rating: "good" }] });
  assert.deepEqual(restored.queue, ["c1", "c2"]);
  assert.equal(restored.mistakes, 1);
});

test("archiving or editing a pending card does not leave an unusable session", () => {
  const archived = { ...data, sets: [{ ...data.sets[0], cards: data.sets[0].cards.map((card) => ({ ...card, status: "アーカイブ" })) }] };
  assert.equal(reconcileSession(session, archived).done, true);
  assert.equal(reconcileSession(session, archived).total, 0);
  const edited = { ...data, sets: [{ ...data.sets[0], cards: data.sets[0].cards.map((card) => ({ ...card, choices: ["W", "X", "Y", "Z"] })) }] };
  assert.equal(reconcileSession(session, edited).selectedChoice, null);
  assert.equal(reconcileSession(session, edited).flipped, false);
});

test("invalid saved data and removed destinations fall back safely", () => {
  for (const raw of [null, "broken JSON", "null", '{"version":99}', '{"version":1,"session":{"id":3},"importDraft":{"text":5}}']) {
    assert.deepEqual(parseWorkspace(raw), EMPTY_WORKSPACE);
  }
  assert.equal(reconcileWorkspace({ ...EMPTY_WORKSPACE, destination: "set:deleted" }, data).destination, "root");
});


test("five-card batches keep the remaining cards through pause and reload", () => {
  const cards = Array.from({ length: 8 }, (_, i) => ({ ...data.sets[0].cards[1], id: `batch-${i}` }));
  const batchData = { ...data, sets: [{ ...data.sets[0], cards }] };
  const started = startStudyBatch({ ...EMPTY_SESSION, id: "batch-session", scope: "set-1", setId: "set-1", queue: cards.map((c) => c.id), total: 8 });
  assert.equal(started.queue.length, 5);
  assert.equal(pendingStudyCount(started), 8);
  const saved = parseWorkspace(JSON.stringify({ ...EMPTY_WORKSPACE, session: started })).session;
  const progressed = reconcileSession(saved, { ...batchData, reviews: cards.slice(0, 5).map((c) => ({ cardId: c.id, sessionId: started.id, rating: "good" })) });
  assert.equal(progressed.done, false);
  assert.equal(progressed.batchDone, true);
  assert.equal(pendingStudyCount(progressed), 3);
  const next = nextStudyBatch(progressed);
  assert.deepEqual(next.queue, cards.slice(5).map((c) => c.id));
  assert.equal(next.batchTotal, 3);
  assert.equal(next.total, 8);
  assert.equal(next.batchDone, false);
});

test("a reload after server-side undo restores the card and its selected answer", () => {
  const checkpoint = studyUndoCheckpoint(session, "review-undone");
  const afterAnswer = { ...session, queue: ["c2"], flipped: false, selectedChoice: null, aiInput: "", undo: checkpoint };
  const restored = reconcileSession(parseWorkspace(JSON.stringify({ ...EMPTY_WORKSPACE, session: afterAnswer })).session, { ...data, undoneReviewIds: ["review-undone"] });
  assert.deepEqual(restored.queue, session.queue);
  assert.equal(restored.selectedChoice, "B");
  assert.equal(restored.aiInput, session.aiInput);
  assert.equal(restored.undo, null);
});

test("an unsaved card correction survives reload", () => {
  const editing = { ...session, editDraft: { cardId: "c1", question: "修正中", answer: "A", choices: ["A", "B", "C", "D"] } };
  assert.deepEqual(reconcileSession(parseWorkspace(JSON.stringify({ ...EMPTY_WORKSPACE, session: editing })).session, data).editDraft, editing.editDraft);
});

test("pause destination follows the entry point and survives reload and batch transitions", () => {
  const started = { ...session, returnTo: studyReturnTarget('sets', 'set-1') };
  const restored = reconcileWorkspace(parseWorkspace(JSON.stringify({ ...EMPTY_WORKSPACE, session: startStudyBatch(started) })), data).session;
  assert.deepEqual(resolveStudyReturn(restored, data), { screen: 'sets', setId: 'set-1' });
  assert.deepEqual(nextStudyBatch(restored).returnTo, started.returnTo);
  assert.deepEqual(studyReturnTarget('study', 'set-1', started.returnTo), started.returnTo);
  // A lesson resumed from Home now returns to Home, even if originally started in a set.
  const resumed = { ...restored, returnTo: studyReturnTarget('home', 'set-1', restored.returnTo) };
  assert.deepEqual(resolveStudyReturn(resumed, data), { screen: 'home' });
  assert.deepEqual(resolveStudyReturn(restored, { sets: [] }), { screen: 'home' });
  assert.deepEqual(resolveStudyReturn(session, data), { screen: 'home' });
  const invalid = parseWorkspace(JSON.stringify({ ...EMPTY_WORKSPACE, session: { ...session, returnTo: { screen: 'sets', setId: 42 } } })).session;
  assert.equal(invalid.returnTo, undefined);
});
