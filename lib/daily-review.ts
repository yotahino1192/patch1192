const DAY_MS = 86_400_000;
const TOKYO_OFFSET = 9 * 3_600_000;

export function studyDay(now: Date): string {
  return new Date(now.getTime() + TOKYO_OFFSET).toISOString().slice(0, 10);
}
export function studyDayBounds(now: Date) {
  const day = studyDay(now);
  const start = new Date(`${day}T00:00:00+09:00`);
  return { day, start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}
export function streakLength(achievedDays: string[], now: Date): number {
  const achieved = new Set(achievedDays);
  let cursor = new Date(`${studyDay(now)}T00:00:00+09:00`);
  if (!achieved.has(studyDay(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let count = 0;
  while (achieved.has(studyDay(cursor))) { count++; cursor = new Date(cursor.getTime() - DAY_MS); }
  return count;
}
