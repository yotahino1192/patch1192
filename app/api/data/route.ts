import { requireAuth, authErrorResponse } from "../../../lib/auth-server";
import { InputError, readJsonObject, validId, boundedText } from "../../../lib/api-input";
import { updateOnboarding, organizeSets, manageMaterial, seedIfEmpty, addCardsToSet, loadAppData, reviewCard, undoReview, saveGeneratedSet } from "../../../db/store";
import type { BinaryReviewRating, GeneratedCard, GeneratedMaterial } from "../../../lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validCards(value: unknown): value is GeneratedCard[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return false;
  return value.every((card) => {
    if (!card || typeof card !== "object") return false;
    const item = card as Record<string, unknown>;
    if (!boundedText(item.question, 5000) || !boundedText(item.answer, 10000)) return false;
    if (!Number.isInteger(item.difficulty) || Number(item.difficulty) < 1 || Number(item.difficulty) > 3) return false;
    if (!["qa", "multiple_choice", "self_explain"].includes(String(item.format || ""))) return false;
    if (!Array.isArray(item.choices) || !item.choices.every((choice) => boundedText(choice, 10000))) return false;
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
    const { userId } = await requireAuth(request);
    const sessionIds = [...new Set(new URL(request.url).searchParams.getAll("sessionId"))];
    if (sessionIds.length > 100 || !sessionIds.every(validId)) return json({ error: "学習セッションの指定を確認してください。" }, 400);
    return json(await loadAppData(userId, sessionIds));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("data GET failed", error);
    return json({ error: "学習データを読み込めませんでした。" }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(request);
    const body = await readJsonObject(request);
    if (body.action === "onboarding") {
      await updateOnboarding(userId, body);
      return json({ data: await loadAppData(userId) });
    }
    if (["createFolder", "renameFolder", "moveSet"].includes(String(body.action))) {
      const action = body.action as "createFolder" | "renameFolder" | "moveSet";
      const name = String(body.name || "").trim();
      const folderId = body.folderId ? String(body.folderId) : null;
      const setId = String(body.setId || "");
      if (action === "moveSet" ? !setId : !name || name.length > 120) return json({ error: "名前を1〜120文字で入力し、対象を選んでください。" }, 400);
      const createdFolderId = await organizeSets(userId, { action, folderId, setId, name });
      return json({ folderId: createdFolderId, data: await loadAppData(userId) });
    }
    if (body.action === "sample") {
      await seedIfEmpty(userId, body.language === "en" ? "en" : "ja");
      return json({ data: await loadAppData(userId) });
    }
    if (["renameSet", "editCard", "deleteCard", "archiveCard", "restoreCard"].includes(String(body.action))) {
      const action = String(body.action);
      const cardId = String(body.cardId || "");
      const setId = String(body.setId || "");
      const title = String(body.title || "").trim();
      const question = String(body.question || "").trim();
      const answer = String(body.answer || "").trim();
      if (action === "renameSet" ? !setId || !title || title.length > 120 : !cardId) return json({ error: "対象と名前を確認してください。" }, 400);
      if (action === "editCard" && (!question || !answer || question.length > 5000 || answer.length > 10000)) return json({ error: "質問と答えを入力してください（質問5,000文字、答え10,000文字以内）。" }, 400);
      const choices = Array.isArray(body.choices) ? body.choices.map((v) => String(v).trim()) : [];
      await manageMaterial(userId, { action, cardId, setId, title, question, answer, choices });
      return json({ data: await loadAppData(userId) });
    }
    if (body.action === "saveSet") {
      const material = body.material as GeneratedMaterial & { sourceContent?: string; folderId?: string | null };
      if (!material || !boundedText(material.title, 120) || !boundedText(material.sourceContent, 30000) || !boundedText(material.category, 60, true) || !boundedText(material.summary, 10000, true) || !Array.isArray(material.keyPoints) || material.keyPoints.length > 100 || !material.keyPoints.every((point) => boundedText(point, 5000)) || !validCards(material.cards)) {
        return json({ error: "保存する教材またはカードが空です。" }, 400);
      }
      const setId = await saveGeneratedSet(userId, {
        ...material,
        title: material.title.trim().slice(0, 120),
        category: material.category?.trim().slice(0, 60) || "未分類",
        sourceContent: material.sourceContent.slice(0, 30000),
        folderId: material.folderId ? String(material.folderId) : null,
      });
      return json({ setId, data: await loadAppData(userId) });
    }
    if (body.action === "addCardsToSet") {
      const setId = String(body.setId || "");
      if (!setId || !validCards(body.cards)) return json({ error: "追加するカードを選択してください。" }, 400);
      if (body.sourceContent !== undefined && (typeof body.sourceContent !== "string" || !body.sourceContent.trim() || body.sourceContent.length > 30000)) return json({ error: "元の文章を1〜30,000文字で指定してください。" }, 400);
      await addCardsToSet(userId, setId, body.cards, typeof body.sourceContent === "string" ? { title: String(body.sourceTitle || "追加資料").slice(0, 120), content: body.sourceContent.trim() } : undefined);
      return json({ data: await loadAppData(userId) });
    }
    if (body.action === "undoReview") {
      const reviewId = String(body.reviewId || "");
      const sessionId = String(body.sessionId || "");
      if (!reviewId || !sessionId) return json({ error: "取り消す評価が見つかりません。" }, 400);
      await undoReview(userId, reviewId, sessionId);
      return json({ data: await loadAppData(userId) });
    }
    if (body.action === "reviewCard") {
      const cardId = String(body.cardId || "");
      const rating = String(body.rating || "") as BinaryReviewRating;
      if (!cardId || !["again", "good"].includes(rating)) {
        return json({ error: "学習評価が正しくありません。" }, 400);
      }
      if (!validId(body.sessionId) || !validId(body.operationId) || !validId(body.cardId) || !Number.isSafeInteger(body.expectedReviewCount) || Number(body.expectedReviewCount) < 0 || typeof body.responseMs !== "number" || !Number.isFinite(body.responseMs) || body.responseMs < 0) return json({ error: "画面を再読み込みして、学習状態を確認してください。", code: "INVALID_REVIEW_OPERATION" }, 400);
      const sessionId = body.sessionId;
      const reviewId = await reviewCard(userId, cardId, rating, body.responseMs, sessionId, { operationId: body.operationId, expectedReviewCount: Number(body.expectedReviewCount) });
      return json({ reviewId, data: await loadAppData(userId, [sessionId]) });
    }
    return json({ error: "未対応の操作です。" }, 400);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    if (error instanceof Error && ["REVIEW_OPERATION_CONFLICT", "REVIEW_STATE_CONFLICT"].includes(error.message)) return json({ error: "別の操作で学習状態が変更されています。最新の状態を確認してください。", code: error.message }, 409);
    if (error && typeof error === "object" && "code" in error && ["SQLITE_BUSY", "TRANSACTION_ACTIVE"].includes(String(error.code))) return json({ error: "保存処理が混み合っています。同じ回答をもう一度送信してください。" }, 503);
    console.error("data POST failed", error);
    if (error instanceof Error && error.message === "UNDO_NOT_AVAILABLE") return json({ error: "この評価は取り消せません。別の学習が進んでいるか、カードが変更されています。" }, 409);
    if (error instanceof Error && error.message === "FOLDER_NOT_FOUND") return json({ error: "フォルダが見つかりませんでした。" }, 404);
    if (error instanceof Error && error.message === "SET_NOT_FOUND") return json({ error: "セットが見つかりませんでした。保存先を選び直してください。" }, 404);
    if (error instanceof Error && error.message === "INVALID_CHOICES") return json({ error: "選択肢は重複のない4つにし、答えを含めてください。" }, 400);
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") return json({ error: "カードが見つかりませんでした。" }, 404);
    return json({ error: "データを保存できませんでした。" }, 500);
  }
}
