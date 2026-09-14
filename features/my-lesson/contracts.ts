/** UI-only contract. Domain objects, persistence and account scope belong to adapters. */
export type ActivityType = 'LEARN' | 'RECALL' | 'CHOICE' | 'EXPLAIN' | 'APPLY';
export type ActivityStatus = 'READY' | 'ANSWERING' | 'SUBMITTING' | 'FEEDBACK' | 'COMPLETED' | 'ERROR';
type BaseActivity = { id: string; prompt: string; estimatedSeconds: number; concept: string; revision?: string; selfAssessment?: boolean; referenceAnswer?: string };
export type ActivityViewModel = BaseActivity & (
  | { type: 'LEARN'; explanation: string; example?: string; visual?: { src: string; alt: string } }
  | { type: 'RECALL'; answer: string; explanation?: string }
  | { type: 'CHOICE'; choices: { id: string; label: string }[]; explanation?: string }
  | { type: 'EXPLAIN' | 'APPLY'; explanation?: string }
);
export type LessonViewModel = {
  lessonId: string;
  patch: { name: string };
  targetMinutes: number;
  activities: ActivityViewModel[];
  /** Supplied by the adapter, never calculated by the UI's Streak logic. */
  status?: 'ACTIVE' | 'COMPLETED';
  resume?: { completedIds: string[]; elapsedSeconds: number; states?: Record<string, ActivityState> };
  completion: { status?: 'COMPLETED'; actualSeconds?: number; strengthenedObjectiveCount?: number; strengthenedConcepts: string[]; streak?: number; nextLessonTiming?: string };
};
export type TimeBudget = { targetMinutes: number; elapsedSeconds: number; remainingSeconds: number; estimatedSeconds: number };
export type LessonProgress = { completed: number; total: number };
export type Feedback = { activityRevision?: string; objectiveState?: { mastery: number; incorrectCount: number; lastReviewedAt: string | null; nextReviewAt: string | null }; message: string; correct?: boolean; explanation?: string };
export type ActivityState = { status: ActivityStatus; response: string; revealed: boolean; assessment?: 'CORRECT' | 'INCORRECT'; feedback?: Feedback };
export type AdapterContext = { signal: AbortSignal; operationId: string };
export type HelpMessage = { role: 'user' | 'assistant'; text: string };
export type LearningObjectiveCandidate = { lessonId: string; activityId: string; question: string; explanation: string };
export interface LessonAdapter {
  load(context: AdapterContext): Promise<LessonViewModel>;
  evaluate(input: { lessonId: string; activity: ActivityViewModel; response: string; assessment?: 'CORRECT' | 'INCORRECT' }, context: AdapterContext): Promise<Feedback>;
  /** Server-managed progress; returns only after durable activity/lesson reconciliation. */
  advance?(input: { lessonId: string; activity: ActivityViewModel }, context: AdapterContext): Promise<LessonViewModel>;
  help(input: { lessonId: string; activity: ActivityViewModel; question: string; messages: HelpMessage[] }, context: AdapterContext): Promise<string>;
  /** Idempotent by operationId. Future Domain adapter creates an objective candidate, not a card. */
  retainLearning?(candidate: LearningObjectiveCandidate, context: AdapterContext): Promise<void>;
}
export type CompleteVariant = 'normal' | 'firstLesson';
