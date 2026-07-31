import { loadAiCardContext, requestUserId, saveChatPair } from "../../../../db/store";
import { answerQuestion } from "../../../../lib/openai";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const question = String(body.question || "").trim();
    if (!question) return json({ error: "質問を入力してください。" }, 400);
    if (question.length > 2000) return json({ error: "質問は2,000文字以内で入力してください。" }, 400);
    const setId = String(body.setId || "").trim();
    const cardId = String(body.cardId || "").trim();
    const sessionId = String(body.sessionId || "").trim().slice(0, 120);
    if (!setId || !cardId || !sessionId) return json({ error: "学習セッションを確認できませんでした。" }, 400);
    const userId = requestUserId(request);
    const context = await loadAiCardContext(userId, setId, cardId, sessionId);
    const answer = await answerQuestion({
      question,
      depth: String(body.depth || "かんたん"),
      cardQuestion: context.cardQuestion,
      cardAnswer: context.cardAnswer,
      sourceContent: context.sourceContent,
      category: context.category,
      history: context.history,
    });
    await saveChatPair(userId, context.setId, context.cardId, sessionId, question, answer);
    return json({ answer });
  } catch (error) {
    console.error("AI chat failed", error);
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return json({ error: "OpenAI APIの設定がまだ完了していません。管理者がAPIキーを設定すると利用できます。", code: "AI_NOT_CONFIGURED" }, 503);
    }
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return json({ error: "このカードの学習データを確認できませんでした。" }, 404);
    }
    return json({ error: "AIから回答を受け取れませんでした。少し待ってからもう一度お試しください。" }, 502);
  }
}
