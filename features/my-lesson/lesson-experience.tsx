'use client';
import { useEffect, useRef, useState } from 'react';
import type { ActivityState, CompleteVariant, LessonAdapter, LessonProgress, LessonViewModel, TimeBudget } from './contracts';
import { activityReducer, initialActivity, primaryAction, timeBudget, validateLesson } from './state';
import { ActivityRenderer } from './renderers';
import { HelpSheet } from './help-sheet';
import { LessonComplete } from './complete';
import styles from './lesson.module.css';
import type { CheckpointStore } from './checkpoint';
export type LessonExperienceProps = {
  adapter: LessonAdapter;
  checkpoint?: CheckpointStore;
  /** Change on account scope, lesson selection or adapter replacement; unmounts all stale work. */
  sessionKey: string;
  onHome: () => void;
  variant?: CompleteVariant;
  /** Read-only signal to the future Composer; this shell never removes activities. */
  onBudgetChange?: (budget: TimeBudget, progress: LessonProgress) => void;
};
export function LessonExperience(props: LessonExperienceProps) {
  return <LessonLoader key={props.sessionKey} {...props} />;
}
function LessonLoader(props: LessonExperienceProps) {
  const [attempt, setAttempt] = useState(0);
  return <LoadAttempt key={attempt} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}
function LoadAttempt(props: LessonExperienceProps & { onRetry: () => void }) {
  const [result, setResult] = useState<{ lesson?: LessonViewModel; error?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => props.adapter.load({ signal: controller.signal, operationId: crypto.randomUUID() })).then(validateLesson).then(lesson => { if (!controller.signal.aborted) setResult({ lesson }); }).catch(() => { if (!controller.signal.aborted) setResult({ error: true }); });
    return () => controller.abort();
  }, [props.adapter]);
  if (result.error) return <section className={styles.shell}><h1>My Lessonを読み込めませんでした</h1><p role="alert">時間をおいて、もう一度お試しください。</p><button className={styles.primary} data-primary onClick={props.onRetry}>再試行</button><button onClick={props.onHome}>ホームへ戻る</button></section>;
  if (!result.lesson) return <section className={styles.shell} aria-busy="true"><h1>My Lesson</h1><p role="status">Lessonを準備しています…</p><button onClick={props.onHome}>ホームへ戻る</button></section>;
  if (!result.lesson.activities.length) return <section className={styles.shell}><h1>今日は学ぶものがありません</h1><p>学ぶ内容ができたら、また始めましょう。</p><button className={styles.primary} data-primary onClick={props.onHome}>ホームへ</button></section>;
  return <ActiveLesson {...props} lesson={result.lesson} />;
}
function ActiveLesson({ adapter, checkpoint, lesson: initialLesson, onHome, variant, onBudgetChange, onRetry }: LessonExperienceProps & { lesson: LessonViewModel; onRetry: () => void }) {
  const [lesson, setLesson] = useState(initialLesson);
  const resumeIndex = (view: LessonViewModel) => { const next = view.activities.findIndex(a => !view.resume?.completedIds.includes(a.id)); return next < 0 ? view.activities.length - 1 : next; };
  const [index, setIndex] = useState(() => adapter.advance ? resumeIndex(initialLesson) : 0);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState(false);
  const [states, setStates] = useState<ActivityState[]>(() => {
    const saved = checkpoint?.read(lesson.lessonId);
    return lesson.activities.map(a => saved?.activityId === a.id && saved.revision === a.revision && saved.draft && !lesson.resume?.completedIds.includes(a.id) ? saved.draft : lesson.resume?.states?.[a.id] ?? initialActivity());
  });
  const [saveError, setSaveError] = useState(false);
  const statesRef = useRef(states);
  const [elapsed, setElapsed] = useState(lesson.resume?.elapsedSeconds ?? 0);
  const [helpOpen, setHelpOpen] = useState(false);
  const started = useRef<number | null>(null);
  const clock = useRef(lesson.resume?.elapsedSeconds ?? 0);
  const locked = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const operation = useRef<{ response: string; id: string } | null>(null);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = adapter.advance ? lesson.status === 'COMPLETED' : index === lesson.activities.length;
  const activity = lesson.activities[index];
  const state = states[index];
  const budget = timeBudget(lesson, elapsed, index);
  const budgetCallback = useRef(onBudgetChange);
  useEffect(() => { budgetCallback.current = onBudgetChange; }, [onBudgetChange]);
  useEffect(() => {
    if (complete) return;
    let accumulated = clock.current;
    started.current = document.hidden ? null : performance.now();
    const tick = () => {
      const now = performance.now();
      if (started.current !== null) accumulated += (now - started.current) / 1000;
      started.current = document.hidden ? null : now;
      clock.current = Math.floor(accumulated); setElapsed(clock.current);
      try { checkpoint?.write(lesson.lessonId, { elapsedSeconds: clock.current }); }
      catch { setSaveError(true); }
    };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pagehide', tick);
    return () => { tick(); clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pagehide', tick); };
  }, [complete, checkpoint, lesson.lessonId]);
  useEffect(() => () => { pending.current?.abort(); }, []);
  useEffect(() => {
    const visible = () => { if (document.hidden) setHelpOpen(false); else onRetry(); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [onRetry]);
  useEffect(() => { locked.current = false; operation.current = null; heading.current?.focus(); if (complete) document.getElementById('lesson-complete')?.focus(); }, [index, complete]);
  useEffect(() => { budgetCallback.current?.(timeBudget(lesson, elapsed, index), { completed: adapter.advance ? lesson.resume?.completedIds.length ?? 0 : index, total: lesson.activities.length }); }, [lesson, elapsed, index, adapter.advance]);
  function change(action: Parameters<typeof activityReducer>[1]) {
    const next = activityReducer(statesRef.current[index], action);
    try {
      checkpoint?.write(lesson.lessonId, { activityId: activity.id, revision: activity.revision,
        draft: ['READY','ANSWERING','ERROR','SUBMITTING'].includes(next.status) ? { ...next, status: next.status === 'SUBMITTING' ? 'ERROR' : next.status } : undefined });
      setSaveError(false);
    } catch { setSaveError(true); }
    statesRef.current = statesRef.current.map((value, i) => i === index ? next : value);
    setStates(statesRef.current);
  }
  async function primary() {
    if (locked.current || !activity || !state) return;
    const action = primaryAction(activity, state);
    if (action.disabled) return;
    if (action.action === 'retry') { operation.current = null; change({ type: 'retry' }); return; }
    if (action.action === 'reveal') { change({ type: 'reveal' }); return; }
    locked.current = true;
    if (action.action === 'next') {
      if (adapter.advance) {
        const controller = new AbortController(); pending.current = controller;
        setAdvancing(true); setAdvanceError(false);
        try {
          const next = await adapter.advance({ lessonId: lesson.lessonId, activity }, { signal: controller.signal, operationId: crypto.randomUUID() });
          if (!controller.signal.aborted) {
            const valid = validateLesson(next);
            setLesson(valid); setIndex(resumeIndex(valid));
            statesRef.current = valid.activities.map(a => valid.resume?.states?.[a.id] ?? initialActivity());
            setStates(statesRef.current);
            setElapsed(valid.resume?.elapsedSeconds ?? elapsed);
          }
        } catch { if (!controller.signal.aborted) setAdvanceError(true); }
        finally { if (!controller.signal.aborted) { locked.current = false; setAdvancing(false); } }
        return;
      }
      change({ type: 'complete' });
      setElapsed(clock.current);
      setIndex(value => value + 1);
      return;
    }
    const controller = new AbortController(); pending.current = controller;
    if (!operation.current || operation.current.response !== state.response) operation.current = { response: state.response, id: crypto.randomUUID() };
    change({ type: 'submit' });
    try {
      const feedback = await adapter.evaluate({ lessonId: lesson.lessonId, activity, response: state.response, assessment: state.assessment }, { signal: controller.signal, operationId: operation.current.id });
      if (!controller.signal.aborted) {
        change({ type: 'feedback', feedback });
        if (feedback.activityRevision) setLesson(current => ({ ...current, activities: current.activities.map(a => a.id === activity.id ? { ...a, revision: feedback.activityRevision } : a) }));
      }
    } catch {
      if (!controller.signal.aborted) change({ type: 'error' });
    } finally { if (!controller.signal.aborted) locked.current = false; }
  }
  if (complete) return <LessonComplete lesson={lesson} actualSeconds={lesson.completion.actualSeconds ?? elapsed} variant={variant} onHome={onHome} />;
  const action = primaryAction(activity, state);
  return <section className={styles.shell} aria-label="My Lesson" data-activity-type={activity.type} data-activity-state={state.status}>
    <header><button onClick={onHome}>中断してホームへ</button><p>{lesson.patch.name}</p><h1>My Lesson</h1><label>進捗 {adapter.advance ? lesson.resume?.completedIds.length ?? 0 : index} / {lesson.activities.length}<progress value={adapter.advance ? lesson.resume?.completedIds.length ?? 0 : index} max={lesson.activities.length} /></label><p className={styles.time}>目安 {budget.targetMinutes}分 · 経過 {budget.elapsedSeconds}秒 · 残り {budget.remainingSeconds}秒 · このActivity 約{budget.estimatedSeconds}秒</p>{budget.remainingSeconds === 0 && <p>目安の時間になりました。中断して、残りは後で再開できます。</p>}</header>
    {saveError && <p role="alert">この端末に途中の入力を保存できません。保存を確認できるまで回答は送信されません。</p>}
    <article className={styles.activity} aria-busy={state.status === 'SUBMITTING'}><h2 ref={heading} tabIndex={-1}>{activity.prompt}</h2><ActivityRenderer activity={activity} state={advancing ? { ...state, status: 'SUBMITTING' } : state} onAssessment={value => change({ type: 'assessment', value })} onAnswer={response => change({ type: 'answer', response })} />{state.status === 'FEEDBACK' && <div role="status" className={styles.feedback}>{state.feedback?.correct !== undefined && <strong>{state.feedback.correct ? '正解です' : 'もう一度、考え方を確認しましょう'}</strong>}<p>{state.feedback?.message}</p>{state.feedback?.explanation && <p>{state.feedback.explanation}</p>}</div>}{(state.status === 'ERROR' || advanceError) && <div role="alert"><p>保存状態を確認できませんでした。入力は残っています。同じ操作の再試行、またはLessonの再読み込みができます。</p><button onClick={onRetry}>Lessonを再読み込み</button></div>}</article>
    <footer className={styles.actions}><button ref={helpTrigger} onClick={() => setHelpOpen(true)} disabled={advancing || state.status === 'SUBMITTING'}>わからない・AIに聞く</button>{!helpOpen && <button className={styles.primary} data-primary disabled={advancing || action.disabled} onClick={() => void primary()}>{advancing ? '保存中…' : action.label}</button>}</footer>
    {helpOpen && <HelpSheet remainingSeconds={budget.remainingSeconds} returnFocusRef={helpTrigger} adapter={adapter} lessonId={lesson.lessonId} activity={activity} onClose={() => setHelpOpen(false)} />}
  </section>;
}
