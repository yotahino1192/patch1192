import type { BinaryReviewRating, CardStatus } from "./types";

export type LessonVerdict = "correct" | "incorrect";

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120, 180, 365] as const;

export function advanceLessonQueue(queue: string[], verdict: LessonVerdict): string[] {
  const [current, ...remaining] = queue;
  if (!current) return [];
  return verdict === "correct" ? remaining : [...remaining, current];
}

export function scheduleBinaryReview(
  rating: BinaryReviewRating,
  currentIntervalDays: number,
  reviewedAtMs: number,
): {
  intervalDays: number;
  dueAtMs: number;
  status: CardStatus;
  correctDelta: number;
} {
  const safeNow = Number.isFinite(reviewedAtMs) ? reviewedAtMs : 0;
  if (rating === "again") {
    return { intervalDays: 0, dueAtMs: safeNow, status: "苦手", correctDelta: 0 };
  }

  const current = Number.isFinite(currentIntervalDays) ? Math.max(0, currentIntervalDays) : 0;
  const intervalDays = REVIEW_INTERVAL_DAYS.find((days) => days > current)
    ?? REVIEW_INTERVAL_DAYS[REVIEW_INTERVAL_DAYS.length - 1];
  return {
    intervalDays,
    dueAtMs: safeNow + intervalDays * 86_400_000,
    status: intervalDays >= 14 ? "定着中" : "復習待ち",
    correctDelta: 1,
  };
}
