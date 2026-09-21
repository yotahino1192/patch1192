import type { ReviewRating } from '../types';
/** Server-owned content and evidence. Old logs have no response; never invent one. */
export type StudyContent = { question: string; answer: string; format: string; choices: string[] };
export type StudyResponse = StudyContent & { selectedChoice: string | null; correct: boolean; contentRevision: string };
export type StudyResult = { id: string; cardId: string; rating: ReviewRating; response: StudyResponse | null; reviewedAt: string; operationId: string | null };
export type StudySessionView = {
  id: string; setId: string; title: string; cardIds: string[]; remainingIds: string[];
  currentItemId: string | null; processed: number; total: number;
  status: 'ACTIVE' | 'COMPLETED' | 'UNAVAILABLE'; completedAt: string | null;
  qualifies: boolean; results: StudyResult[];
};
