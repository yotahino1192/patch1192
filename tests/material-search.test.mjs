import test from "node:test";
import assert from "node:assert/strict";
import { searchMaterials } from "../lib/material-search.ts";
const data = { sets: [
  { id: "s1", title: "日本史", category: "歴史", folderId: "f1", cards: [{ id: "q1", question: "江戸幕府を開いた人物は？", answer: "徳川家康", status: "未学習" }, { id: "q2", question: "家康の年齢", answer: "test", status: "削除済み" }] },
  { id: "s2", title: "English Notes", category: "Language", folderId: "f2", cards: [{ id: "q3", question: "Meaning of APPLE", answer: "りんご", status: "復習待ち" }, { id: "q4", question: "APPLE archive", answer: "old", status: "アーカイブ" }] },
] };
test("search finds titles and questions or answers across folders", () => {
  assert.equal(searchMaterials(data, "日本史").sets[0].id, "s1");
  assert.equal(searchMaterials(data, "幕府").cards[0].card.id, "q1");
  assert.equal(searchMaterials(data, "家康").cards.length, 1);
  assert.equal(searchMaterials(data, "ＥＮＧＬＩＳＨ apple").cards[0].card.id, "q3");
  assert.equal(searchMaterials(data, "りんご").cards.length, 1);
  assert.deepEqual(searchMaterials(data, "   "), { sets: [], cards: [] });
  assert.equal(searchMaterials(data, "no match").cards.length, 0);
});
