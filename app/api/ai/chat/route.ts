import { observeRoute } from "../../../../lib/reliability/server";
import { randomUUID } from 'node:crypto';
import { database } from '../../../../db/client';
import { runAi, aiErrorResponse } from '../../../../lib/ai/control';
import { logEvent } from '../../../../lib/safe-log';
import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";
import { InputError, readJsonObject } from "../../../../lib/api-input";
import { loadAiCardContext } from "../../../../db/store";
import { prepareQuestion, prepareLessonQuestion } from "../../../../lib/openai";
import { lessonHelpContext, loadLessonHelp } from '../../../../lib/ai/lesson-context';
import { AiError } from '../../../../lib/ai/execution';
import { contentRevision, requireExplanationCard } from '../../../../db/study';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function handlePOST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const body = await readJsonObject(request, 128 * 1024);
    if (body.context === 'lesson') {
      const lessonId = body.lessonId, activityId = body.activityId;
      const question = typeof body.question === 'string' ? body.question.trim() : '';
      let send: ReturnType<typeof prepareLessonQuestion>;
      const result = await runAi(database(), userId, 'chat', request.headers.get('Idempotency-Key'), body,
        async () => ({ answer: await send(), lessonHelp: { lessonId, activityId, question } }),
        async tx => {
          try { await lessonHelpContext(tx, userId, String(lessonId), String(activityId)); }
          catch (error) {
            // A definitively closed/removed Lesson is cancellation, not an uncertain provider outcome.
            if (error instanceof AiError && error.code === 'LESSON_UNAVAILABLE') throw new AiError('AI_REQUEST_CANCELLED', 409);
            throw error;
          }
        },
        async () => {
          if (Object.keys(body).some(key => !['context','lessonId','activityId','question','language','operationId'].includes(key)) ||
            ![lessonId, activityId].every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id)) ||
            !question || question.length > 2000 || !['ja','en'].includes(String(body.language))) throw new InputError('Lessonの質問を確認してください。');
          const material = await database().transaction(tx => loadLessonHelp(tx, userId, String(lessonId), String(activityId)));
          const context = Object.fromEntries(Object.entries(material.context).filter(([key]) => key !== 'patch_id').map(([key, value]) => [key, String(value).slice(0, 1200)]));
          send = prepareLessonQuestion({ question, language: body.language as 'ja' | 'en', context, sources: material.sources, history: material.history });
        }, request.signal);
      return json({ answer: result.answer });
    }
    if (body.context !== undefined || body.lessonId !== undefined || body.activityId !== undefined) throw new InputError('学習の文脈を確認してください。');
    const question = String(body.question || "").trim();
    const setId = String(body.setId || "").trim();
    const cardId = String(body.cardId || "").trim();
    const sessionId = String(body.sessionId || "").trim().slice(0, 120);
    let send: ReturnType<typeof prepareQuestion>;
    let revision: string;
    const result = await runAi(database(), userId, 'chat', request.headers.get('Idempotency-Key'), body, async () => ({ answer: await send() }), async (tx, result) => {
      try {
        const card = await requireExplanationCard(tx,userId,setId,cardId,sessionId);
        if (contentRevision(card) !== revision) throw new AiError('AI_REQUEST_CANCELLED',409);
      } catch (error) {
        if (error instanceof Error && error.message === 'CARD_NOT_FOUND') throw new AiError('AI_REQUEST_CANCELLED',409);
        throw error;
      }
      const now = Date.now();
      for (const [role, content, offset] of [['user', question, 0], ['assistant', result.answer, 1]] as const) {
        await tx.execute({ sql: 'INSERT INTO chat_messages(id,user_id,set_id,card_id,session_id,role,content,created_at) VALUES(?,?,?,?,?,?,?,?)', args: [randomUUID(), userId, setId, cardId, sessionId, role, content, new Date(now + offset).toISOString()] });
      }
    }, async () => {
      if (!question) throw new InputError('質問を入力してください。');
      if (question.length > 2000) throw new InputError('質問は2,000文字以内で入力してください。');
      if (!setId || !cardId || !sessionId) throw new InputError('学習セッションを確認できませんでした。');
    const context = await loadAiCardContext(userId, setId, cardId, sessionId);
    revision = context.contentRevision;
    if (body.contentRevision !== undefined && body.contentRevision !== revision) throw new InputError('教材が変更されています。画面を再読み込みしてください。',409);
    send = prepareQuestion({
      language: body.language === "en" ? "en" : "ja",
      question,
      depth: String(body.depth || "かんたん"),
      cardQuestion: context.cardQuestion,
      cardAnswer: context.cardAnswer,
      sourceContent: context.sourceContent,
      category: context.category,
      history: context.history,
    });

    }, request.signal);
    return json(result);
  } catch (error) {
    const aiResponse = aiErrorResponse(error);
    if (aiResponse) return aiResponse;
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    logEvent('api_failed', { endpoint: 'chat', status: 503 });
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return json({ error: "OpenAI APIの設定がまだ完了していません。管理者がAPIキーを設定すると利用できます。", code: "AI_NOT_CONFIGURED" }, 503);
    }
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return json({ error: "このカードの学習データを確認できませんでした。" }, 404);
    }
    return json({ error: "AIから回答を受け取れませんでした。少し待ってからもう一度お試しください。" }, 502);
  }
}

export const POST = observeRoute(handlePOST);
