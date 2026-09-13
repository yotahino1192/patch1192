/** UI-only contract. Domain objects, persistence and account scope belong to adapters. */
export type ActivityType = 'LEARN' | 'RECALL' | 'CHOICE' | 'EXPLAIN' | 'APPLY';
export type ActivityStatus = 'READY' | 'ANSWERING' | 'SUBMITTING' | 'FEEDBACK' | 'COMPLETED' | 'ERROR';
type BaseActivity = { id: string; prompt: string; estimatedSeconds: number; concept: string };
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
  completion: { strengthenedConcepts: string[]; streak?: number; nextLessonTiming?: string };
};
export type TimeBudget = { targetMinutes: number; elapsedSeconds: number; remainingSeconds: number; estimatedSeconds: number };
export type LessonProgress = { completed: number; total: number };
export type Feedback = { message: string; correct?: boolean; explanation?: string };
export type ActivityState = { status: ActivityStatus; response: string; revealed: boolean; feedback?: Feedback };
export type AdapterContext = { signal: AbortSignal; operationId: string };
export type HelpMessage = { role: 'user' | 'assistant'; text: string };
export type LearningObjectiveCandidate = { lessonId: string; activityId: string; question: string; explanation: string };
export interface LessonAdapter {
  load(context: AdapterContext): Promise<LessonViewModel>;
  evaluate(input: { lessonId: string; activity: ActivityViewModel; response: string }, context: AdapterContext): Promise<Feedback>;
  help(input: { lessonId: string; activity: ActivityViewModel; question: string; messages: HelpMessage[] }, context: AdapterContext): Promise<string>;
  /** Idempotent by operationId. Future Domain adapter creates an objective candidate, not a card. */
  retainLearning(candidate: LearningObjectiveCandidate, context: AdapterContext): Promise<void>;
}
export type CompleteVariant = 'normal' | 'firstLesson';
