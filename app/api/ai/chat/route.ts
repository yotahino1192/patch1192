import { randomUUID } from 'node:crypto';
import { database } from '../../../../db/client';
import { runAi, aiErrorResponse } from '../../../../lib/ai/control';
import { logEvent } from '../../../../lib/safe-log';
import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";
import { InputError, readJsonObject } from "../../../../lib/api-input";
import { loadAiCardContext } from "../../../../db/store";
import { prepareQuestion } from "../../../../lib/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const body = await readJsonObject(request, 128 * 1024);
    const question = String(body.question || "").trim();
    const setId = String(body.setId || "").trim();
    const cardId = String(body.cardId || "").trim();
    const sessionId = String(body.sessionId || "").trim().slice(0, 120);
    let send: ReturnType<typeof prepareQuestion>;
    const result = await runAi(database(), userId, 'chat', request.headers.get('Idempotency-Key'), body, async () => ({ answer: await send() }), async (tx, result) => {
      const owner = (await tx.execute({ sql: "SELECT id FROM cards WHERE id=? AND set_id=? AND user_id=? AND status <> '削除済み'", args: [cardId, setId, userId] })).rows[0];
      if (!owner) throw new Error('CARD_NOT_FOUND');
      const now = Date.now();
      for (const [role, content, offset] of [['user', question, 0], ['assistant', result.answer, 1]] as const) {
        await tx.execute({ sql: 'INSERT INTO chat_messages(id,user_id,set_id,card_id,session_id,role,content,created_at) VALUES(?,?,?,?,?,?,?,?)', args: [randomUUID(), userId, setId, cardId, sessionId, role, content, new Date(now + offset).toISOString()] });
      }
    }, async () => {
      if (!question) throw new InputError('質問を入力してください。');
      if (question.length > 2000) throw new InputError('質問は2,000文字以内で入力してください。');
      if (!setId || !cardId || !sessionId) throw new InputError('学習セッションを確認できませんでした。');
    const context = await loadAiCardContext(userId, setId, cardId, sessionId);
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

    });
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
