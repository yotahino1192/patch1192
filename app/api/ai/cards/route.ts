import { generateMaterial } from "../../../../lib/openai";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const text = String(body.text || "").trim();
    if (text.length < 80) return json({ error: "カードを作るには、80文字以上の文章を入力してください。" }, 400);
    if (text.length > 30000) return json({ error: "一度に解析できる文章は30,000文字までです。" }, 400);
    const material = await generateMaterial({
      text,
      detail: String(body.detail || "標準"),
      style: String(body.style || "一問一答"),
      count: Number(body.count || 6),
      category: String(body.category || ""),
    });
    return json(material);
  } catch (error) {
    console.error("card generation failed", error);
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return json({ error: "OpenAI APIの設定がまだ完了していません。管理者がAPIキーを設定すると利用できます。", code: "AI_NOT_CONFIGURED" }, 503);
    }
    return json({ error: "AIがカードを生成できませんでした。少し待ってからもう一度お試しください。" }, 502);
  }
}

