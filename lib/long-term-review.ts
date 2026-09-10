import type { Card, CardSet } from "./types";

export function hasLongTermMemory(card: Card): boolean {
  return card.status === "定着中" && card.intervalDays >= 60;
}

export function isNearLongTermMemory(card: Card): boolean {
  return card.status === "定着中" && card.intervalDays >= 30 && card.intervalDays < 60;
}

export function memoryMilestones(sets: CardSet[]) {
  const activeSets = sets.map((set) => set.cards.filter((card) => !["アーカイブ", "削除済み"].includes(card.status)));
  const cards = activeSets.flat();
  return {
    longTerm: cards.filter(hasLongTermMemory).length,
    nearLongTerm: cards.filter(isNearLongTermMemory).length,
    completedSets: activeSets.filter((cards) => cards.length > 0 && cards.every(hasLongTermMemory)).length,
  };
}

// A successful 30-day review graduates to the first 60-day memory check.
export function isLongTermDue(card: Card, now: Date): boolean {
  return hasLongTermMemory(card) && new Date(card.dueAt).getTime() <= now.getTime();
}
