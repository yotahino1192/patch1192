'use client';

import { useEffect, useState } from 'react';
import { useApiFetch } from '../../app/account-context';
import { useLanguage } from '../../app/language';
import { LessonPreview } from '../../app/lesson-preview';
import { PatchIcon } from '../../app/patch-ui';
import { createDomainClient } from '../../lib/domain/client';
import type { Lesson } from '../../lib/domain/types';

/** Explicit selection of already assigned Lessons; the Continue resolver is unchanged. */
export function AvailableLessons({ onStart }: { onStart: (id: string) => void }) {
  const request = useApiFetch();
  const { t } = useLanguage();
  const [items, setItems] = useState<{ lesson: Lesson; title: string }[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const client = createDomainClient(request);
    const options = { signal: controller.signal };
    void client.query({ resource: 'patches' }, options).then(async patches => {
      const groups = await Promise.all(patches.filter(patch => patch.status === 'ACTIVE').map(async patch => {
        const lessons = await client.query({ resource: 'lessons', id: patch.id }, options);
        return lessons.filter(lesson => !lesson.legacy && ['CREATED', 'ACTIVE'].includes(lesson.status)).map(lesson => ({ lesson, title: patch.title }));
      }));
      if (!controller.signal.aborted) { setItems(groups.flat()); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [request, retry]);
  const preview = items.find(item => item.lesson.id === selected);
  if (error) return <section className="patch-home-lessons"><p role="alert">{t('マイレッスンを読み込めませんでした。')}</p><button className="patch-text-button" onClick={() => setRetry(value => value + 1)}>{t('再試行')}</button></section>;
  if (!items.length) return null;
  return <section className="patch-home-lessons" aria-label={t('マイレッスン')}>
    <h2 className="patch-section-label">{t('マイレッスン')}</h2>
    {items.map(({ lesson, title }) => <button key={lesson.id} className="patch-action-card" data-lesson-id={lesson.id} onClick={() => setSelected(lesson.id)}>
      <span className="patch-action-icon"><PatchIcon name="book" /></span>
      <span><strong>{title}</strong><small>{t(lesson.status === 'ACTIVE' ? '中断したレッスン' : '未開始のレッスン')} · {t('予定時間：約{0}分', Math.ceil(lesson.estimatedSeconds / 60))}</small></span>
      <PatchIcon name="arrow" size={19} />
    </button>)}
    <LessonPreview open={!!preview} onClose={() => setSelected(null)} onStart={() => { if (preview) { setSelected(null); onStart(preview.lesson.id); } }} title={preview?.title ?? ''} sessionId={preview?.lesson.id} label="マイレッスン" titleId="assigned-lesson-preview-title" />
  </section>;
}
