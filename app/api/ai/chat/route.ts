import { requestUserId, saveChatPair } from "../../../../db/store";
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
    const history = Array.isArray(body.history)
      ? body.history
          .filter((item): item is { role: "user" | "assistant"; content: string } =>
            Boolean(item) && typeof item === "object" &&
            ["user", "assistant"].includes(String((item as Record<string, unknown>).role)) &&
            typeof (item as Record<string, unknown>).content === "string")
          .map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }))
      : [];
    const answer = await answerQuestion({
      question,
      depth: String(body.depth || "かんたん"),
      cardQuestion: String(body.cardQuestion || ""),
      cardAnswer: String(body.cardAnswer || ""),
      sourceContent: String(body.sourceContent || ""),
      category: String(body.category || ""),
      history,
    });
    const setId = body.setId ? String(body.setId) : null;
    const cardId = body.cardId ? String(body.cardId) : null;
    await saveChatPair(requestUserId(request), setId, cardId, question, answer);
    return json({ answer });
  } catch (error) {
    console.error("AI chat failed", error);
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return json({ error: "OpenAI APIの設定がまだ完了していません。管理者がAPIキーを設定すると利用できます。", code: "AI_NOT_CONFIGURED" }, 503);
    }
    return json({ error: "AIから回答を受け取れませんでした。少し待ってからもう一度お試しください。" }, 502);
  }
}

