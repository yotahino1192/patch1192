import type { LessonAdapter, LessonViewModel } from './contracts';
/** Preview/test fixture only. No API, persistence, Streak mutation or card generation. */
export const mockLesson: LessonViewModel = {
  lessonId: 'preview-lesson', patch: { name: '学び方を学ぶ' }, targetMinutes: 5,
  activities: [
    { id: 'learn', type: 'LEARN', concept: '想起', prompt: '思い出すことが学びになる', explanation: '答えを見ずに思い出すことで、理解を確かめられます。', example: '本を閉じて、今読んだ内容を一言で説明する。', estimatedSeconds: 45 },
    { id: 'recall', type: 'RECALL', concept: '想起', prompt: '想起とは、どんな学び方ですか？', answer: '答えを見ずに思い出す学び方です。', estimatedSeconds: 45 },
    { id: 'choice', type: 'CHOICE', concept: '想起', prompt: '想起の例を選びましょう', choices: [{ id: 'a', label: '本を閉じて説明する' }, { id: 'b', label: '文章をそのまま読み続ける' }], estimatedSeconds: 40 },
    { id: 'explain', type: 'EXPLAIN', concept: '理解の確認', prompt: '読み直しと想起の違いを、自分の言葉で説明してください', estimatedSeconds: 60 },
    { id: 'apply', type: 'APPLY', concept: '学びの活用', prompt: '新しい単語を覚えました。明日どうやって理解を確かめますか？', estimatedSeconds: 60 },
    { id: 'wrap', type: 'LEARN', concept: '理解の確認', prompt: '小さく確かめて、続けましょう', explanation: '思い出せない部分は、次の学びの手がかりです。', estimatedSeconds: 30 },
  ],
  completion: { strengthenedConcepts: ['想起', '理解の確認', '学びの活用'], streak: 3, nextLessonTiming: '明日' },
};
export function createMockLessonAdapter(lesson: LessonViewModel = mockLesson): LessonAdapter {
  return {
    async load({ signal }) { signal.throwIfAborted(); return structuredClone(lesson); },
    async evaluate({ activity, response }, { signal }) {
      signal.throwIfAborted();
      if (activity.type === 'CHOICE') return { correct: response === 'a', message: '答えを見ずに説明すると、理解を確かめられます。' };
      return { message: activity.type === 'RECALL' ? '自分の理解を確認できました。' : '回答を受け取りました。これはプレビュー用のフィードバックです。AIによる評価は行っていません。', explanation: activity.explanation };
    },
    async help({ activity, question }, { signal }) { signal.throwIfAborted(); return `プレビューの説明：「${activity.prompt}」を身近な例で考えてみましょう。質問「${question}」への実際のAI回答は、今後adapterで接続します。`; },
    async retainLearning(_candidate, { signal }) { signal.throwIfAborted(); },
  };
}
