import type { Card } from "./types";

// A successful 30-day review graduates to the first 60-day memory check.
export function isLongTermDue(card: Card, now: Date): boolean {
  return card.status === "定着中" && card.intervalDays >= 60 && new Date(card.dueAt).getTime() <= now.getTime();
}
