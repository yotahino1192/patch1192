import type { ActivityState, ActivityViewModel, Feedback, LessonViewModel, TimeBudget } from './contracts';
export const initialActivity = (): ActivityState => ({ status: 'READY', response: '', revealed: false });
export type ActivityAction =
  | { type: 'answer'; response: string }
  | { type: 'assessment'; value: 'CORRECT' | 'INCORRECT' }
  | { type: 'retry' }
  | { type: 'reveal' }
  | { type: 'submit' }
  | { type: 'feedback'; feedback: Feedback }
  | { type: 'error' }
  | { type: 'complete' };
export function activityReducer(state: ActivityState, action: ActivityAction): ActivityState {
  if (state.status === 'COMPLETED') return state;
  switch (action.type) {
    case 'retry': return state.status === 'FEEDBACK' ? { ...initialActivity(), revealed: state.revealed } : state;
    case 'assessment': return ['READY', 'ANSWERING', 'ERROR'].includes(state.status) ? { ...state, assessment: action.value, status: 'ANSWERING' } : state;
    case 'answer': return ['READY', 'ANSWERING', 'ERROR'].includes(state.status) ? { ...state, response: action.response, status: 'ANSWERING' } : state;
    case 'reveal': return ['READY', 'ANSWERING'].includes(state.status) ? { ...state, revealed: true, status: 'ANSWERING' } : state;
    case 'submit': return ['READY', 'ANSWERING', 'ERROR'].includes(state.status) ? { ...state, status: 'SUBMITTING' } : state;
    case 'feedback': return state.status === 'SUBMITTING' ? { ...state, status: 'FEEDBACK', feedback: action.feedback } : state;
    case 'error': return state.status === 'SUBMITTING' ? { ...state, status: 'ERROR' } : state;
    case 'complete': return state.status === 'FEEDBACK' || state.status === 'READY' ? { ...state, status: 'COMPLETED' } : state;
  }
}
export function primaryAction(activity: ActivityViewModel, state: ActivityState) {
  if (state.status === 'FEEDBACK' && state.feedback?.correct === false) return { action: 'retry', label: 'もう一度回答する', disabled: false } as const;
  if (activity.type === 'LEARN' || state.status === 'FEEDBACK') return { action: 'next', label: '次へ', disabled: false } as const;
  if (activity.type === 'RECALL' && !state.revealed) return { action: 'reveal', label: '答えを見る', disabled: false } as const;
  return { action: 'submit', label: state.status === 'SUBMITTING' ? '確認中…' : state.status === 'ERROR' ? 'もう一度確認する' : '回答を確認する', disabled: state.status === 'SUBMITTING' || !state.response.trim() || (activity.selfAssessment === true && !state.assessment) } as const;
}
export function timeBudget(lesson: LessonViewModel, elapsedSeconds: number, index: number): TimeBudget {
  const elapsed = Math.max(0, Math.floor(elapsedSeconds));
  return { targetMinutes: lesson.targetMinutes, elapsedSeconds: elapsed, remainingSeconds: Math.max(0, lesson.targetMinutes * 60 - elapsed), estimatedSeconds: lesson.activities[index]?.estimatedSeconds ?? 0 };
}
/** Reject malformed adapter payloads before they can leave the shell with no valid action. */
export function validateLesson(lesson: LessonViewModel): LessonViewModel {
  if (!lesson || !lesson.lessonId || !lesson.patch?.name || !Number.isFinite(lesson.targetMinutes) || lesson.targetMinutes < 5 || lesson.targetMinutes > 15 || !Array.isArray(lesson.activities) || !Array.isArray(lesson.completion?.strengthenedConcepts)) throw Error('Invalid lesson');
  const ids = new Set<string>();
  for (const a of lesson.activities) {
    if (!a.id || ids.has(a.id) || !a.prompt || !['LEARN', 'RECALL', 'CHOICE', 'EXPLAIN', 'APPLY'].includes(a.type) || !Number.isFinite(a.estimatedSeconds) || a.estimatedSeconds < 0) throw Error('Invalid activity');
    ids.add(a.id);
    if (a.type === 'CHOICE' && (!Array.isArray(a.choices) || a.choices.length < 2 || new Set(a.choices.map(c => c.id)).size !== a.choices.length || a.choices.some(c => !c.id || !c.label))) throw Error('Invalid choices');
    if (a.type === 'LEARN' && (!a.explanation || (a.visual && (!a.visual.alt || !a.visual.src)))) throw Error('Invalid explanation');
    if (a.type === 'RECALL' && !a.answer) throw Error('Invalid answer');
  }
  return lesson;
}
