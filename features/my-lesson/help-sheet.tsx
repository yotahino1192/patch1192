'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ActivityViewModel, HelpMessage, LessonAdapter } from './contracts';
import styles from './lesson.module.css';
export function HelpSheet({ adapter, lessonId, activity, onClose, returnFocusRef }: { returnFocusRef: RefObject<HTMLButtonElement | null>; adapter: LessonAdapter; lessonId: string; activity: ActivityViewModel; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const task = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const captureId = useRef(crypto.randomUUID());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const returnTarget = returnFocusRef.current ?? previous;
    element?.showModal();
    return () => { task.current?.abort(); element?.close(); returnTarget?.focus(); };
  }, [returnFocusRef]);
  async function run(retain: boolean) {
    if (busy.current || (retain && (saved || !messages.length))) return;
    busy.current = true;
    const controller = new AbortController(); task.current = controller;
    setPending(true); setError('');
    try {
      if (retain) {
        await adapter.retainLearning({ lessonId, activityId: activity.id, question: messages.at(-2)?.text ?? '', explanation: messages.at(-1)?.text ?? '' }, { signal: controller.signal, operationId: captureId.current });
        if (!controller.signal.aborted) setSaved(true);
      } else {
        const text = question.trim() || 'この内容をやさしく説明してください';
        const answer = await adapter.help({ lessonId, activity, question: text, messages }, { signal: controller.signal, operationId: crypto.randomUUID() });
        if (!controller.signal.aborted) { setMessages([...messages, { role: 'user', text }, { role: 'assistant', text: answer }]); setQuestion(''); setSaved(false); captureId.current = crypto.randomUUID(); }
      }
    } catch {
      if (!controller.signal.aborted) setError(retain ? '学びを残せませんでした。もう一度お試しください。' : '今は説明を表示できません。回答はそのままに、Lessonへ戻れます。');
    } finally {
      if (!controller.signal.aborted) { busy.current = false; setPending(false); }
    }
  }
  return <dialog ref={dialog} className={styles.sheet} aria-labelledby="lesson-help-title" onCancel={e => { e.preventDefault(); onClose(); }}><div className={styles.helpHeader}><h2 id="lesson-help-title">わからない・AIに聞く</h2><button onClick={onClose} autoFocus>閉じる</button></div><p>このActivityについて聞いてみましょう。</p><div className={styles.messages} role="log" aria-live="polite">{messages.map((message, index) => <p key={index}><strong>{message.role === 'user' ? 'あなた' : 'AI Help'}：</strong>{message.text}</p>)}</div><label>追加で聞きたいこと<textarea rows={3} maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} disabled={pending} /></label>{error && <p role="alert">{error}</p>}{saved && <p role="status">次のLessonに反映します ✓</p>}<div className={styles.actions}><button disabled={pending || !messages.length || saved} onClick={() => void run(true)}>学びに残す</button><button className={styles.primary} data-primary disabled={pending} onClick={() => void run(false)}>{pending ? '処理中…' : messages.length ? '質問する' : '説明を聞く'}</button></div></dialog>;
}
