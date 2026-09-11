import { requireAuth, authErrorResponse } from "../../../../lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, true);
    return Response.json(auth, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error) || Response.json({ error: "アカウントを読み込めません。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
