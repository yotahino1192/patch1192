import type { createDomainClient } from '../../lib/domain/client';
import type { Activity, Attempt, ObjectiveState, RecordAttempt } from '../../lib/domain/types';
import type { ActivityState, ActivityViewModel, AdapterContext, Feedback, LessonAdapter, LessonViewModel } from './contracts';
import { validateLesson } from './state';

type Client = ReturnType<typeof createDomainClient>;
type HelpBoundary = Pick<LessonAdapter, 'help' | 'retainLearning'>;
const success = (attempt?: Attempt) => !!attempt && !attempt.undoneAt && ['CORRECT', 'COMPLETED'].includes(attempt.result);
function fail(): never { throw new Error('LESSON_UNAVAILABLE'); }
function mapActivity(activity: Activity, concept: string, estimatedSeconds: number): ActivityViewModel {
  const base = { id: activity.id, concept, prompt: activity.prompt, estimatedSeconds };
  switch (activity.type) {
    case 'LEARN': return { ...base, type: 'LEARN', explanation: activity.explanation || activity.answer || activity.prompt };
    case 'RECALL': return { ...base, type: 'RECALL', answer: activity.answer, explanation: activity.explanation };
    case 'CHOICE': {
      if (!Array.isArray(activity.metadata?.choices) || !activity.metadata.choices.includes(activity.answer)) return fail();
      return { ...base, type: 'CHOICE', choices: activity.metadata.choices.map((label, index) => ({ id: String(index), label })), explanation: activity.explanation };
    }
    case 'EXPLAIN': case 'APPLY': return { ...base, type: activity.type, explanation: activity.explanation, referenceAnswer: activity.answer, selfAssessment: true };
    default: return fail();
  }
}
/** Only typed client calls. No repository, storage, auth bypass, scoring projection or automatic retry. */
export function createDomainLessonAdapter(client: Client, lessonId: string, helpBoundary: HelpBoundary): LessonAdapter {
  let activities = new Map<string, Activity>();
  let latest = new Map<string, Attempt>();
  let projection = new Map<string, ObjectiveState | null>();
  // Freeze every field across explicit retries, including duration and response.
  const evaluations = new Map<string, { payload: string; result?: Feedback }>();
  const pending = new Map<string, RecordAttempt>();
  async function snapshot(context: AdapterContext, start: boolean): Promise<LessonViewModel> {
    const options = { signal: context.signal };
    context.signal.throwIfAborted();
    let lesson = await client.query({ resource: 'lesson', id: lessonId }, options);
    if (lesson.legacy || !lesson.patchId || !lesson.targetMinutes || lesson.status === 'ABANDONED') return fail();
    const patch = await client.query({ resource: 'patch', id: lesson.patchId }, options);
    if (patch.status !== 'ACTIVE') return fail();
    const objectives = await client.query({ resource: 'objectives', id: patch.id }, options);
    const assignments = (await client.query({ resource: 'lessonActivities', id: lessonId }, options)).sort((a, b) => a.order - b.order);
    if (!assignments.length || assignments.some((a, i) => a.order !== i)) return fail();
    const groups = await Promise.all(objectives.map(o => client.query({ resource: 'activities', id: o.id }, options)));
    const content = new Map(groups.flat().map(a => [a.id, a]));
    const history = new Map<string, Attempt>();
    const states = new Map<string, ObjectiveState | null>();
    const views: ActivityViewModel[] = [];
    for (const assignment of assignments) {
      const activity = content.get(assignment.activityId);
      const objective = objectives.find(o => o.id === activity?.objectiveId);
      if (!activity || !objective || objective.status !== 'ACTIVE') return fail();
      views.push(mapActivity(activity, objective.description, assignment.estimatedSeconds));
      const attempts = await client.query({ resource: 'attempts', id: activity.id }, options);
      const last = attempts.filter(a => a.lessonId === lessonId && !a.undoneAt).at(-1);
      if (last) history.set(activity.id, last);
      if (!states.has(objective.id)) states.set(objective.id, await client.query({ resource: 'objectiveState', id: objective.id }, options));
    }
    // Validate the complete payload before starting a CREATED lesson.
    const completedIds = views.filter(v => success(history.get(v.id))).map(v => v.id);
    const strengthened = [...new Set(completedIds.map(id => content.get(id)!.objectiveId))];
    const restored: Record<string, ActivityState> = {};
    for (const view of views) {
      const attempt = history.get(view.id);
      if (attempt) restored[view.id] = { status: 'FEEDBACK', response: attempt.response, revealed: true, assessment: attempt.result === 'COMPLETED' ? undefined : attempt.result, feedback: { correct: success(attempt), message: '保存済みの回答を復元しました。', explanation: content.get(view.id)?.explanation } };
    }
    const elapsed = lesson.startedAt ? Math.max(0, Math.floor(((lesson.completedAt ? Date.parse(lesson.completedAt) : Date.now()) - Date.parse(lesson.startedAt)) / 1000)) : 0;
    const result: LessonViewModel = validateLesson({ lessonId, patch: { name: patch.title }, targetMinutes: lesson.targetMinutes, status: lesson.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE', activities: views, resume: { completedIds, elapsedSeconds: elapsed, states: restored }, completion: { strengthenedConcepts: strengthened.map(id => objectives.find(o => o.id === id)!.description), strengthenedObjectiveCount: strengthened.length, ...(lesson.status === 'COMPLETED' ? { status: 'COMPLETED', actualSeconds: elapsed } : {}) } });
    if (lesson.status === 'COMPLETED' && completedIds.length !== views.length) return fail();
    if (start && lesson.status === 'CREATED') lesson = await client.command({ action: 'startLesson', input: { lessonId } }, options);
    if (lesson.status === 'CREATED') return fail();
    context.signal.throwIfAborted();
    for (const [id, input] of pending) if (history.get(id)?.operationId === input.operationId) pending.delete(id);
    activities = content; latest = history; projection = states;
    return result;
  }
  async function record(activityId: string, response: string, result: RecordAttempt['result'], context: AdapterContext) {
    context.signal.throwIfAborted();
    let input = pending.get(activityId);
    if (!input) {
      // Same predecessor => same operation across reloads while an earlier response is lost/in-flight.
      const seed = `${lessonId}:${activityId}:${latest.get(activityId)?.id ?? 'initial'}`;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
      const operationId = 'lesson-' + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
      // Session wall duration comes from authoritative startedAt/completedAt. No fabricated per-answer timing.
      input = { lessonId, activityId, result, response, durationMs: 0, operationId };
      pending.set(activityId, input);
    } else if (input.response !== response || input.result !== result) throw new Error('PENDING_ANSWER_RELOAD_REQUIRED');
    const attempt = await client.command({ action: 'recordAttempt', input }, { signal: context.signal });
    if (attempt.undoneAt) throw new Error('ANSWER_UNDONE_RELOAD_REQUIRED');
    const activity = activities.get(activityId) ?? fail();
    const state = await client.query({ resource: 'objectiveState', id: activity.objectiveId }, { signal: context.signal });
    context.signal.throwIfAborted();
    latest.set(activityId, attempt); projection.set(activity.objectiveId, state); pending.delete(activityId);
    return { attempt, state };
  }
  return {
    load: context => snapshot(context, true),
    async evaluate(input, context) {
      context.signal.throwIfAborted();
      const payload = JSON.stringify([input.activity.id, input.response, input.assessment]);
      const prior = evaluations.get(context.operationId);
      if (prior && prior.payload !== payload) throw new Error('OPERATION_CONFLICT');
      if (prior?.result) return prior.result;
      evaluations.set(context.operationId, { payload });
      const activity = activities.get(input.activity.id) ?? fail();
      let correct: boolean;
      switch (activity.type) {
        case 'RECALL': correct = input.response === 'remembered'; break;
        case 'CHOICE': correct = activity.metadata.choices?.[Number(input.response)] === activity.answer; break;
        case 'EXPLAIN': case 'APPLY': if (!input.assessment) return fail(); correct = input.assessment === 'CORRECT'; break;
        default: return fail();
      }
      const { state } = await record(activity.id, input.response, correct ? 'CORRECT' : 'INCORRECT', context);
      const feedback = { correct, message: correct ? '回答を保存しました。' : '回答を保存しました。説明を確認して、もう一度練習しましょう。', explanation: activity.explanation || activity.answer, objectiveState: state ?? undefined };
      evaluations.set(context.operationId, { payload, result: feedback });
      return feedback;
    },
    async advance(input, context) {
      const activity = activities.get(input.activity.id) ?? fail();
      if (activity.type === 'LEARN' && !success(latest.get(activity.id))) await record(activity.id, '', 'COMPLETED', context);
      if (!success(latest.get(activity.id))) return fail();
      let view = await snapshot(context, false);
      if (view.resume!.completedIds.length === view.activities.length && view.status !== 'COMPLETED') {
        const lesson = await client.command({ action: 'completeLesson', input: { lessonId } }, { signal: context.signal });
        if (lesson.status !== 'COMPLETED') return fail();
        view = await snapshot(context, false);
      }
      return view;
    },
    help: helpBoundary.help,
    retainLearning: helpBoundary.retainLearning,
  };
}
