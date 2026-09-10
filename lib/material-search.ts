import type { AppData } from "./types";

const normalized = (text: string) => text.normalize("NFKC").toLocaleLowerCase().trim();
export function searchMaterials(data: AppData, query: string) {
  const words = normalized(query).split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((word) => normalized(text).includes(word));
  if (!words.length) return { sets: [], cards: [] };
  return {
    sets: data.sets.filter((set) => matches(`${set.title} ${set.category}`)),
    cards: data.sets.flatMap((set) => set.cards.filter((card) => !["削除済み", "アーカイブ"].includes(card.status) && matches(`${card.question} ${card.answer} ${set.title}`)).map((card) => ({ card, set }))),
  };
}
