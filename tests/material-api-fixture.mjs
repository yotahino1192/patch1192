import { materialDataTransport } from '../lib/material-data-client.ts';
/** Exercise the same page assembly as useApiFetch, retaining real route auth. */
export async function materialDataHandlers() {
  const data = await import('../app/api/data/route.ts');
  const materials = await import('../app/api/materials/route.ts');
  const wrap = handler => async request => {
    const transport = materialDataTransport(async (path, options) => path.split('?')[0] === '/api/data'
      ? handler(request)
      : materials.GET(new Request(new URL(path, request.url), { ...options, headers: request.headers })));
    return transport(new URL(request.url).pathname + new URL(request.url).search);
  };
  return { GET: wrap(data.GET), POST: wrap(data.POST) };
}
