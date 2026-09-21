import { observeRoute } from "../../../../lib/reliability/server";
import { database } from '../../../../db/client';
import { runAi, aiErrorResponse } from '../../../../lib/ai/control';
import { logEvent } from '../../../../lib/safe-log';
import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";
import { InputError, readJsonObject } from "../../../../lib/api-input";
import { prepareMaterial } from "../../../../lib/openai";
import { MIN_SOURCE_LENGTH, MAX_SOURCE_LENGTH, MAX_FOCUS_LENGTH } from '../../../../lib/material-limits';

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
    let send: ReturnType<typeof prepareMaterial>;
    const material = await runAi(database(), userId, 'cards', request.headers.get('Idempotency-Key'), body, () => send(), undefined, async () => {
      if (typeof body.text !== 'string' || (body.inputKind !== undefined && !['source','topic'].includes(String(body.inputKind)))) throw new InputError('入力の種類と文章を確認してください。');
      const text = body.text.trim();
      const topic = body.inputKind === 'topic';
      if (topic && (body.mode === 'lesson_summary' || body.focus !== undefined || text.length > 200)) throw new InputError('トピックは1〜200文字で入力してください。');
      const mode = body.mode === 'lesson_summary' ? 'lesson_summary' : 'source';
      const minimumLength = topic ? 1 : mode === 'lesson_summary' ? 20 : MIN_SOURCE_LENGTH;
      if (text.length < minimumLength) throw new InputError(topic ? 'トピックは1〜200文字で入力してください。' : mode === 'lesson_summary' ? '要約するAI解説が不足しています。' : 'カードを作るには、80文字以上の文章を入力してください。');
      if (text.length > MAX_SOURCE_LENGTH) throw new InputError('一度に解析できる文章は30,000文字までです。');
      if (body.focus !== undefined && (typeof body.focus !== 'string' || !body.focus.trim() || body.focus.length > MAX_FOCUS_LENGTH)) throw new InputError('学習の焦点を1〜1,000文字で入力してください。');
      send = prepareMaterial({
      language: body.language === "en" ? "en" : "ja",
      text,
      inputKind: topic ? 'topic' : 'source',
      detail: String(body.detail || "標準"),
      style: String(body.style || "一問一答"),
      category: String(body.category || ""),
      mode,
      focus: typeof body.focus === 'string' ? body.focus.trim() : undefined,
      });
    }, request.signal);
    return json(material);
  } catch (error) {
    const aiResponse = aiErrorResponse(error);
    if (aiResponse) return aiResponse;
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    logEvent('api_failed', { endpoint: 'cards', status: 503 });
    if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
      return json({ error: "OpenAI APIの設定がまだ完了していません。管理者がAPIキーを設定すると利用できます。", code: "AI_NOT_CONFIGURED" }, 503);
    }
    return json({ error: "AIがカードを生成できませんでした。少し待ってからもう一度お試しください。" }, 502);
  }
}

export const POST = observeRoute(handlePOST);
