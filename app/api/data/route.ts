import { addCardsToSet, loadAppData, requestUserId, reviewCard, saveGeneratedSet } from "../../../db/store";
import type { BinaryReviewRating, GeneratedCard, GeneratedMaterial } from "../../../lib/types";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validCards(value: unknown): value is GeneratedCard[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return false;
  return value.every((card) => {
    if (!card || typeof card !== "object") return false;
    const item = card as Record<string, unknown>;
    if (!String(item.question || "").trim() || !String(item.answer || "").trim()) return false;
    if (!["qa", "multiple_choice", "self_explain"].includes(String(item.format || ""))) return false;
    if (!Array.isArray(item.choices)) return false;
    if (item.format === "multiple_choice") {
      const choices = item.choices.map((choice) => String(choice).trim());
      const answer = String(item.answer).trim();
      return choices.length === 4 && choices.every(Boolean) && new Set(choices).size === 4 && choices.includes(answer);
    }
    return item.choices.length === 0;
  });
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
      if (!material?.title?.trim() || !material?.sourceContent?.trim() || !validCards(material.cards)) {
        return json({ error: "保存する教材またはカードが空です。" }, 400);
      }
      const setId = await saveGeneratedSet(userId, {
        ...material,
        title: material.title.trim().slice(0, 120),
        category: material.category?.trim().slice(0, 60) || "未分類",
        sourceContent: material.sourceContent.slice(0, 30000),
      });
      return json({ setId, data: await loadAppData(userId) });
    }
    if (body.action === "addCardsToSet") {
      const setId = String(body.setId || "");
      if (!setId || !validCards(body.cards)) return json({ error: "追加するカードを選択してください。" }, 400);
      await addCardsToSet(userId, setId, body.cards);
      return json({ data: await loadAppData(userId) });
    }
    if (body.action === "reviewCard") {
      const cardId = String(body.cardId || "");
      const rating = String(body.rating || "") as BinaryReviewRating;
      if (!cardId || !["again", "good"].includes(rating)) {
        return json({ error: "学習評価が正しくありません。" }, 400);
      }
      const sessionId = String(body.sessionId || "").trim().slice(0, 120) || null;
      await reviewCard(userId, cardId, rating, Number(body.responseMs || 0), sessionId);
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
