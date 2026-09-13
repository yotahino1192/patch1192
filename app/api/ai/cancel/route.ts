import { observeRoute } from '../../../../lib/reliability/server';
import { database } from '../../../../db/client';
import { cancelAi, aiErrorResponse } from '../../../../lib/ai/control';
import { requireAuth, authErrorResponse } from '../../../../lib/auth-server';
import { InputError, readJsonObject } from '../../../../lib/api-input';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Cancellation needs authentication, but never requires permission to send data to AI. */
async function handlePOST(request: Request) {
  try {
    const { userId } = await requireAuth(request);
    const body = await readJsonObject(request, 1024);
    await cancelAi(database(), userId, typeof body.operationKey === 'string' ? body.operationKey : '');
    return Response.json({ accepted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return authErrorResponse(error) || aiErrorResponse(error) || Response.json(
      { error: 'AI cancellation unavailable' },
      { status: error instanceof InputError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = observeRoute(handlePOST);
