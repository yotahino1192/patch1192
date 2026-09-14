'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { DomainLesson } from './domain-lesson';

/** A selected, server-issued Lesson ID. Home/Continue selection policy remains unchanged. */
export function LessonEntry({ children, onHome }: { children: ReactNode; onHome?: () => void }) {
  const [selection, setSelection] = useState<{ ready: boolean; id: string | null }>({ ready: false, id: null });
  useEffect(() => {
    const read = () => setSelection({ ready: true, id: new URL(window.location.href).searchParams.get('lesson') });
    read(); window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  function home() {
    const url = new URL(window.location.href); url.searchParams.delete('lesson');
    history.replaceState(null, '', url); setSelection({ ready: true, id: null });
    onHome?.();
    window.dispatchEvent(new Event('patch-retention-refresh'));
  }
  if (!selection.ready) return <p role="status">学習画面を準備しています…</p>;
  if (selection.id === null) return children;
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(selection.id)) return <section><p role="alert">Lessonが見つかりません。</p><button onClick={home}>ホームへ</button></section>;
  return <DomainLesson lessonId={selection.id} onHome={home} />;
}
