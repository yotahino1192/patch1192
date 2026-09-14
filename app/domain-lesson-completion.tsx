'use client';

import { useEffect } from 'react';
import type { AppData } from '../lib/types';
import type { LessonViewModel } from '../features/my-lesson/contracts';
import { LessonCompletion } from './lesson-completion';
import { PatchIcon } from './patch-ui';
import { useLanguage } from './language';

/** Reuse Phase 1 presentation only after U2 confirms durable completion. */
export function DomainLessonCompletion({ lesson, actualSeconds, data, now, onHome }: {
  lesson: LessonViewModel; actualSeconds: number; data: AppData; now: Date; onHome: () => void;
}) {
  const { t } = useLanguage();
  useEffect(() => { window.dispatchEvent(new Event('patch-retention-refresh')); }, [lesson.lessonId]);
  return <div className="page session-complete patch-complete patch-ui">
    <LessonCompletion data={data} now={now} cards={lesson.activities.length} mistakes={lesson.completion.retryCount ?? 0} unit="activities" />
    <p>{lesson.patch.name} · {t('この端末での学習時間：{0}分{1}秒', Math.floor(actualSeconds / 60), actualSeconds % 60)}</p>
    {lesson.completion.strengthenedConcepts.length > 0 && <details><summary>{t('今回取り組んだこと')}</summary><ul>{lesson.completion.strengthenedConcepts.map((concept, index) => <li key={index}>{concept}</li>)}</ul></details>}
    <div className="completion-actions"><button className="patch-primary" data-primary onClick={onHome}><PatchIcon name="home" />{t('ホームに戻る')}</button></div>
  </div>;
}
