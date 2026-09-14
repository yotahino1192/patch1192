'use client';
import { useMemo } from 'react';
import { useAccount, useApiFetch } from '../../app/account-context';
import { createDomainClient } from '../../lib/domain/client';
import { createDomainLessonAdapter } from './domain-adapter';
import { createLessonHelp } from './ai-help';
import { createLessonCheckpoint } from './checkpoint';
import { useLanguage } from '../../app/language';
import { LessonExperience, type LessonExperienceProps } from './lesson-experience';
/** Host mounts under existing Account/Privacy providers with an already assigned Lesson ID. */
export function DomainLesson({ lessonId, onHome, renderComplete }: { lessonId: string; onHome: () => void; renderComplete?: LessonExperienceProps["renderComplete"] }) {
  const account = useAccount();
  const request = useApiFetch();
  const { language } = useLanguage();
  const scope = account?.scope;
  const checkpoint = useMemo(() => scope ? createLessonCheckpoint({
    getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key),
  }, scope.account.userId, scope.assertCurrent) : undefined, [scope]);
  const { adapter, adapterSession } = useMemo(() => {
    return { adapter: createDomainLessonAdapter(createDomainClient(request), lessonId, createLessonHelp(request, language), checkpoint), adapterSession: crypto.randomUUID() };
  }, [request, lessonId, language, checkpoint]);
  if (!account || !account.scope.isCurrent()) return <p role="status">ログインを確認してください。</p>;
  return <LessonExperience key={`${account.scope.account.userId}:${account.scope.account.sessionId}:${lessonId}`} sessionKey={adapterSession} adapter={adapter} checkpoint={checkpoint} onHome={onHome} renderComplete={renderComplete} />;
}
