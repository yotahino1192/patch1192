'use client';
import { useMemo } from 'react';
import { useAccount, useApiFetch } from '../../app/account-context';
import { createDomainClient } from '../../lib/domain/client';
import { createDomainLessonAdapter } from './domain-adapter';
import { createMockLessonAdapter } from './mock-adapter';
import { LessonExperience } from './lesson-experience';
/** Host mounts under existing Account/Privacy providers. No production route/CTA is added. */
export function DomainLesson({ lessonId, onHome }: { lessonId: string; onHome: () => void }) {
  const account = useAccount();
  const request = useApiFetch();
  const { adapter, adapterSession } = useMemo(() => {
    const preview = createMockLessonAdapter();
    return { adapter: createDomainLessonAdapter(createDomainClient(request), lessonId, { help: preview.help, retainLearning: preview.retainLearning }), adapterSession: crypto.randomUUID() };
  }, [request, lessonId]);
  if (!account || !account.scope.isCurrent()) return <p role="status">ログインを確認してください。</p>;
  return <LessonExperience key={`${account.scope.account.userId}:${account.scope.account.sessionId}:${lessonId}`} sessionKey={adapterSession} adapter={adapter} onHome={onHome} />;
}
