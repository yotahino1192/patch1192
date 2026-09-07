import assert from "node:assert/strict";
import test from "node:test";
import { studyDay, studyDayBounds, streakLength } from "../lib/daily-review.ts";

test("daily review rolls over at Tokyo midnight", () => {
  assert.equal(studyDay(new Date("2026-09-05T14:59:59Z")), "2026-09-05");
  assert.equal(studyDay(new Date("2026-09-05T15:00:00Z")), "2026-09-06");
  assert.deepEqual(studyDayBounds(new Date("2026-09-05T15:00:00Z")), { day: "2026-09-06", start: "2026-09-05T15:00:00.000Z", end: "2026-09-06T15:00:00.000Z" });
});
test("unfinished today keeps yesterday's streak, but a missed day breaks it", () => {
  const now = new Date("2026-09-06T10:00:00+09:00");
  assert.equal(streakLength(["2026-09-04", "2026-09-05"], now), 2);
  assert.equal(streakLength(["2026-09-04", "2026-09-05", "2026-09-06"], now), 3);
  assert.equal(streakLength(["2026-09-04"], now), 0);
});
