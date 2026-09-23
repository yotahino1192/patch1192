import { observeRoute } from '../../../lib/reliability/server';
import { requireAuth, authErrorResponse } from '../../../lib/auth-server';
import { InputError } from '../../../lib/api-input';
import { loadMaterialPage, loadMaterialText } from '../../../db/materials';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function handle(request: Request) {
  try {
    const { userId } = await requireAuth(request);
    const p = new URL(request.url).searchParams;
    if ([...p.keys()].some(key => !['resource','cursor','limit','id'].includes(key) || p.getAll(key).length !== 1)) throw new InputError('INVALID_MATERIAL_QUERY');
    const resource = p.get('resource');
    if (resource === 'source' || resource === 'keyPoints') {
      if (p.has('limit')) throw new InputError('INVALID_MATERIAL_QUERY');
      return json(await loadMaterialText(userId, p.get('id') || '', resource, p.get('cursor')));
    }
    if (!['sets','cards','folders'].includes(resource || '') || p.has('id')) throw new InputError('INVALID_MATERIAL_QUERY');
    return json(await loadMaterialPage(userId, resource as 'sets' | 'cards' | 'folders', p.get('cursor'), p.get('limit')));
  } catch (error) {
    return authErrorResponse(error) ?? (error instanceof InputError ? json({ code: error.message }, error.status) : json({ code: 'MATERIALS_UNAVAILABLE' }, 503));
  }
}
export const GET = observeRoute(handle);
