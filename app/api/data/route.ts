import { loadAppData, requestUserId, reviewCard, saveGeneratedSet } from "../../../db/store";
import type { GeneratedMaterial, ReviewRating } from "../../../lib/types";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  try {
    return json(await loadAppData(requestUserId(request)));
  } catch (error) {
    console.error("data GET failed", error);
    return json({ error: "学習データを読み込めませんでした。" }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const userId = requestUserId(request);
    if (body.action === "saveSet") {
      const material = body.material as GeneratedMaterial & { sourceContent?: string };
      if (!material?.title?.trim() || !material?.sourceContent?.trim() || !Array.isArray(material.cards) || material.cards.length === 0) {
        return json({ error: "保存する教材またはカードが空です。" }, 400);
      }
      if (material.cards.some((card) => !card.question?.trim() || !card.answer?.trim())) {
        return json({ error: "質問と回答をすべて入力してください。" }, 400);
      }
      const setId = await saveGeneratedSet(userId, {
        ...material,
        title: material.title.trim().slice(0, 120),
        category: material.category?.trim().slice(0, 60) || "未分類",
        sourceContent: material.sourceContent.slice(0, 30000),
      });
      return json({ setId, data: await loadAppData(userId) });
    }
    if (body.action === "reviewCard") {
      const cardId = String(body.cardId || "");
      const rating = String(body.rating || "") as ReviewRating;
      if (!cardId || !["again", "hard", "good", "easy"].includes(rating)) {
        return json({ error: "学習評価が正しくありません。" }, 400);
      }
      await reviewCard(userId, cardId, rating, Number(body.responseMs || 0));
      return json({ data: await loadAppData(userId) });
    }
    return json({ error: "未対応の操作です。" }, 400);
  } catch (error) {
    console.error("data POST failed", error);
    const message = error instanceof Error && error.message === "CARD_NOT_FOUND"
      ? "カードが見つかりませんでした。"
      : "データを保存できませんでした。";
    return json({ error: message }, 500);
  }
}

