import type { ApiTransport } from '../../lib/api-client';
import { readApiResponse } from '../../lib/reliability/errors';
import type { LessonAdapter } from './contracts';

/** Caller passes useApiFetch: consent, account fences and durable AI admission stay upstream. */
export function createLessonHelp(request: ApiTransport, language: 'ja' | 'en'): Pick<LessonAdapter, 'help'> {
  return {
    async help({ lessonId, activity, question }, { signal, operationId }) {
      const response = await request('/api/ai/chat', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'lesson', lessonId, activityId: activity.id, question, language, operationId }),
      });
      const result = await readApiResponse<{ answer: string }>(response);
      signal.throwIfAborted();
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw Error('AI_EMPTY_RESULT');
      return result.answer;
    },
  };
}
