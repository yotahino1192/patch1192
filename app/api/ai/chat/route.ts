import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";
import { InputError, readJsonObject } from "../../../../lib/api-input";
import { loadAiCardContext } from "../../../../db/store";
import { answerQuestion } from "../../../../lib/openai";

import { runAi } from "../../../../lib/ai-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const body = await readJsonObject(request);
    const question = String(body.question || "").trim();
    if (!question) return json({ error: "質問を入力してください。" }, 400);
    if (question.length > 2000) return json({ error: "質問は2,000文字以内で入力してください。" }, 400);
    const setId = String(body.setId || "").trim();
    const cardId = String(body.cardId || "").trim();
    const sessionId = String(body.sessionId || "").trim().slice(0, 120);
    if (!setId || !cardId || !sessionId) return json({ error: "学習セッションを確認できませんでした。" }, 400);
    const context = await loadAiCardContext(userId, setId, cardId, sessionId);
    const answer = await runAi(userId, String(body.operationId || ""), "chat", body, () => answerQuestion({
      language: body.language === "en" ? "en" : "ja",
      question,
      depth: String(body.depth || "かんたん"),
      cardQuestion: context.cardQuestion,
      cardAnswer: context.cardAnswer,
      sourceContent: context.sourceContent,
      category: context.category,
      history: context.history,
    }), async (tx, answer) => {
      // Recheck resource ownership after the external call, in the same transaction as insertion.
      if (!(await tx.execute({sql:"SELECT id FROM cards WHERE id=? AND set_id=? AND user_id=? AND status <> '削除済み'",args:[cardId,setId,userId]})).rows.length) throw new Error("CARD_NOT_FOUND");
      for (const [index,role,content] of [[0,"user",question],[1,"assistant",answer]] as const) {
        await tx.execute({sql:"INSERT INTO chat_messages (id,user_id,set_id,card_id,session_id,role,content,created_at) VALUES (?,?,?,?,?,?,?,?)",args:[crypto.randomUUID(),userId,setId,cardId,sessionId,role,content,new Date(Date.now()+index).toISOString()]});
      }
    });
    return json({ answer });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    console.error("AI request failed");
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return json({ error: "OpenAI APIの設定がまだ完了していません。管理者がAPIキーを設定すると利用できます。", code: "AI_NOT_CONFIGURED" }, 503);
    }
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return json({ error: "このカードの学習データを確認できませんでした。" }, 404);
    }
    return json({ error: "AIの送信結果を確認できません。自動再送はしません。再実行すると新しいAI処理として扱われます。" }, 502);
  }
}
