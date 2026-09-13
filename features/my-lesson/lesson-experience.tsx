'use client';
import { useEffect, useRef, useState } from 'react';
import type { ActivityState, CompleteVariant, LessonAdapter, LessonProgress, LessonViewModel, TimeBudget } from './contracts';
import { activityReducer, initialActivity, primaryAction, timeBudget, validateLesson } from './state';
import { ActivityRenderer } from './renderers';
import { HelpSheet } from './help-sheet';
import { LessonComplete } from './complete';
import styles from './lesson.module.css';
export type LessonExperienceProps = {
  adapter: LessonAdapter;
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
function ActiveLesson({ adapter, lesson, onHome, variant, onBudgetChange }: LessonExperienceProps & { lesson: LessonViewModel }) {
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<ActivityState[]>(() => lesson.activities.map(initialActivity));
  const [elapsed, setElapsed] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const started = useRef<number | null>(null);
  const clock = useRef(0);
  const locked = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const operation = useRef<{ response: string; id: string } | null>(null);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const complete = index === lesson.activities.length;
  const activity = lesson.activities[index];
  const state = states[index];
  const budget = timeBudget(lesson, elapsed, index);
  const budgetCallback = useRef(onBudgetChange);
  useEffect(() => { budgetCallback.current = onBudgetChange; }, [onBudgetChange]);
  useEffect(() => {
    if (complete) return;
    started.current ??= performance.now();
    const tick = () => { clock.current = Math.floor((performance.now() - started.current!) / 1000); setElapsed(clock.current); };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [complete]);
  useEffect(() => () => { pending.current?.abort(); }, []);
  useEffect(() => { locked.current = false; operation.current = null; heading.current?.focus(); if (complete) document.getElementById('lesson-complete')?.focus(); }, [index, complete]);
  useEffect(() => { budgetCallback.current?.(timeBudget(lesson, elapsed, index), { completed: index, total: lesson.activities.length }); }, [lesson, elapsed, index]);
  function change(action: Parameters<typeof activityReducer>[1]) {
    setStates(previous => previous.map((value, i) => i === index ? activityReducer(value, action) : value));
  }
  async function primary() {
    if (locked.current || !activity || !state) return;
    const action = primaryAction(activity, state);
    if (action.disabled) return;
    if (action.action === 'reveal') { change({ type: 'reveal' }); return; }
    locked.current = true;
    if (action.action === 'next') {
      change({ type: 'complete' });
      if (started.current !== null) setElapsed(Math.floor((performance.now() - started.current) / 1000));
      setIndex(value => value + 1);
      return;
    }
    const controller = new AbortController(); pending.current = controller;
    if (!operation.current || operation.current.response !== state.response) operation.current = { response: state.response, id: crypto.randomUUID() };
    change({ type: 'submit' });
    try {
      const feedback = await adapter.evaluate({ lessonId: lesson.lessonId, activity, response: state.response }, { signal: controller.signal, operationId: operation.current.id });
      if (!controller.signal.aborted) change({ type: 'feedback', feedback });
    } catch {
      if (!controller.signal.aborted) change({ type: 'error' });
    } finally { if (!controller.signal.aborted) locked.current = false; }
  }
  if (complete) return <LessonComplete lesson={lesson} actualSeconds={elapsed} variant={variant} onHome={onHome} />;
  const action = primaryAction(activity, state);
  return <section className={styles.shell} aria-label="My Lesson" data-activity-type={activity.type} data-activity-state={state.status}>
    <header><p>{lesson.patch.name}</p><h1>My Lesson</h1><label>進捗 {index} / {lesson.activities.length}<progress value={index} max={lesson.activities.length} /></label><p className={styles.time}>目安 {budget.targetMinutes}分 · 経過 {budget.elapsedSeconds}秒 · 残り {budget.remainingSeconds}秒 · このActivity 約{budget.estimatedSeconds}秒</p>{budget.remainingSeconds === 0 && <p>目安の時間になりました。自分のペースで続けられます。</p>}</header>
    <article className={styles.activity} aria-busy={state.status === 'SUBMITTING'}><h2 ref={heading} tabIndex={-1}>{activity.prompt}</h2><ActivityRenderer activity={activity} state={state} onAnswer={response => change({ type: 'answer', response })} />{state.status === 'FEEDBACK' && <div role="status" className={styles.feedback}>{state.feedback?.correct !== undefined && <strong>{state.feedback.correct ? '正解です' : 'もう一度、考え方を確認しましょう'}</strong>}<p>{state.feedback?.message}</p>{state.feedback?.explanation && <p>{state.feedback.explanation}</p>}</div>}{state.status === 'ERROR' && <p role="alert">回答を確認できませんでした。入力は残っています。</p>}</article>
    <footer className={styles.actions}><button ref={helpTrigger} onClick={() => setHelpOpen(true)} disabled={state.status === 'SUBMITTING'}>わからない・AIに聞く</button>{!helpOpen && <button className={styles.primary} data-primary disabled={action.disabled} onClick={() => void primary()}>{action.label}</button>}</footer>
    {helpOpen && <HelpSheet returnFocusRef={helpTrigger} adapter={adapter} lessonId={lesson.lessonId} activity={activity} onClose={() => setHelpOpen(false)} />}
  </section>;
}
