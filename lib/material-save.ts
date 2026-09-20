import type { GeneratedMaterial, GeneratedCard } from './types';
import type { DraftMaterial } from './workspace';

export type MaterialSaveInput =
  | { action: 'saveSet'; material: GeneratedMaterial & { sourceContent: string; folderId: string | null } }
  | { action: 'addCardsToSet'; setId: string; cards: GeneratedCard[]; sourceContent: string; sourceTitle: string; sourceKind?: 'source' | 'topic' };
export type PendingMaterialSave = { operationId: string; payload: MaterialSaveInput };
export type SavedMaterial = { setId: string; cardIds: string[]; title: string; appended: boolean };

export function reviewContentError(draft: DraftMaterial | null): string {
  if (!draft) return 'No generated draft is available. Go back to Customize learning.';
  if (!draft.keyPoints.length || draft.keyPoints.some(p => !p.trim())) return 'No learning outcomes were generated. Go back and generate again.';
  const cards = draft.cards.filter(c => c.selected);
  if (!cards.length || cards.some(c => !c.question.trim() || !c.answer.trim())) return 'This draft has no complete study content. Go back and generate again.';
  if (cards.some(c => c.format === 'multiple_choice' && (c.choices.length !== 4 || c.choices.some(v => !v.trim()) || new Set(c.choices.map(v => v.trim())).size !== 4 || !c.choices.map(v => v.trim()).includes(c.answer.trim())))) return 'Some answer options are incomplete. Go back and generate again.';
  return '';
}
export function reviewError(draft: DraftMaterial | null, destination: string, setIds: string[]): string {
  const invalid = reviewContentError(draft);
  if (invalid || !draft) return invalid;
  if (destination.startsWith('set:') && !setIds.includes(destination.slice(4))) return 'Choose an available Patch before saving.';
  if (!destination.startsWith('set:') && (!draft.title.trim() || draft.title.length > 120)) return 'Enter a Patch name of 1–120 characters.';
  return '';
}
export function materialSaveInput(draft: DraftMaterial, destination: string): MaterialSaveInput {
  const cards = draft.cards.filter(c => c.selected).map(({ question, answer, difficulty, format, choices }) => ({ question, answer, difficulty, format, choices }));
  return destination.startsWith('set:')
    ? { action: 'addCardsToSet', setId: destination.slice(4), cards, sourceContent: draft.sourceContent, sourceTitle: draft.title || 'Additional material', ...(draft.sourceKind ? { sourceKind: draft.sourceKind } : {}) }
    : { action: 'saveSet', material: { ...(draft.sourceKind ? { sourceKind: draft.sourceKind } : {}), title: draft.title.trim(), category: draft.category, summary: draft.summary, keyPoints: draft.keyPoints, sourceContent: draft.sourceContent, cards, folderId: destination.startsWith('folder:') ? destination.slice(7) : null } };
}

export function validPendingMaterialSave(value: unknown): value is PendingMaterialSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as PendingMaterialSave;
  if (typeof v.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(v.operationId) || !v.payload || typeof v.payload !== 'object') return false;
  const p = v.payload;
  const m = p.action === 'saveSet' ? p.material : p.action === 'addCardsToSet' ? { title: p.sourceTitle, sourceContent: p.sourceContent, cards: p.cards } : null;
  return !!m && typeof m.title === 'string' && typeof m.sourceContent === 'string' && Array.isArray(m.cards) && m.cards.length > 0;
}
