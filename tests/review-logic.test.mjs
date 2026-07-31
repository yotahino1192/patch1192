import assert from "node:assert/strict";
import test from "node:test";
import { advanceLessonQueue, scheduleBinaryReview } from "../lib/review.ts";

test("incorrect cards move to the back and correct cards leave the lesson", () => {
  assert.deepEqual(advanceLessonQueue(["a", "b", "c"], "incorrect"), ["b", "c", "a"]);
  assert.deepEqual(advanceLessonQueue(["a", "b", "c"], "correct"), ["b", "c"]);
  assert.deepEqual(advanceLessonQueue(["a"], "incorrect"), ["a"]);
  assert.deepEqual(advanceLessonQueue(["a"], "correct"), []);
});

test("binary reviews follow a widening forgetting-curve-inspired schedule", () => {
  const now = Date.parse("2026-07-31T12:00:00.000Z");
  const incorrect = scheduleBinaryReview("again", 30, now);
  assert.deepEqual(incorrect, { intervalDays: 0, dueAtMs: now, status: "苦手", correctDelta: 0 });

  const cases = [
    [0, 1, "復習待ち"],
    [1, 3, "復習待ち"],
    [3, 7, "復習待ち"],
    [7, 14, "定着中"],
    [14, 30, "定着中"],
    [30, 60, "定着中"],
    [60, 120, "定着中"],
    [120, 180, "定着中"],
    [180, 365, "定着中"],
  ];
  for (const [current, expected, status] of cases) {
    const result = scheduleBinaryReview("good", current, now);
    assert.equal(result.intervalDays, expected);
    assert.equal(result.dueAtMs, now + expected * 86_400_000);
    assert.equal(result.status, status);
    assert.equal(result.correctDelta, 1);
  }
});
