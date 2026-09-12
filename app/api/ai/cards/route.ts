import { database } from '../../../../db/client';
import { runAi, aiErrorResponse } from '../../../../lib/ai/control';
import { logEvent } from '../../../../lib/safe-log';
import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";
import { InputError, readJsonObject } from "../../../../lib/api-input";
import { prepareMaterial } from "../../../../lib/openai";

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
    let send: ReturnType<typeof prepareMaterial>;
    const material = await runAi(database(), userId, 'cards', request.headers.get('Idempotency-Key'), body, () => send(), undefined, async () => {
      const text = String(body.text || '').trim();
      const mode = body.mode === 'lesson_summary' ? 'lesson_summary' : 'source';
      const minimumLength = mode === 'lesson_summary' ? 20 : 80;
      if (text.length < minimumLength) throw new InputError(mode === 'lesson_summary' ? '要約するAI解説が不足しています。' : 'カードを作るには、80文字以上の文章を入力してください。');
      if (text.length > 30000) throw new InputError('一度に解析できる文章は30,000文字までです。');
      send = prepareMaterial({
      language: body.language === "en" ? "en" : "ja",
      text,
      detail: String(body.detail || "標準"),
      style: String(body.style || "一問一答"),
      category: String(body.category || ""),
      mode,
      });
    });
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
