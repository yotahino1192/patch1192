import type { ApiTransport } from './api-client';
import type { AppData, Card, CardSet, Folder } from './types';
import type { AppDataPage, MaterialCollection, MaterialPage, MaterialSummary, MaterialTextPage } from './material-data';
import { readApiResponse, ReliabilityError } from './reliability/errors.ts';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
async function collect<T>(request: ApiTransport, resource: MaterialCollection, first: MaterialPage<T>, options?: RequestInit): Promise<T[]> {
  const items = [...first.items], seen = new Set<string>();
  let cursor = first.nextCursor;
  while (cursor) {
    if (seen.has(cursor)) throw new ReliabilityError('invalid_response');
    seen.add(cursor);
    const page = await readApiResponse<MaterialPage<T>>(await request(`/api/materials?${new URLSearchParams({ resource, cursor })}`, { headers: options?.headers, signal: options?.signal }));
    items.push(...page.items); cursor = page.nextCursor;
  }
  return items;
}
export async function assembleAppData(request: ApiTransport, page: AppDataPage, options?: RequestInit): Promise<AppData> {
  const [summaries, cards, folders] = await Promise.all([
    collect<MaterialSummary>(request, 'sets', page.collections.sets, options),
    collect<Card>(request, 'cards', page.collections.cards, options),
    collect<Folder>(request, 'folders', page.collections.folders, options),
  ]);
  const bySet = new Map<string, Card[]>();
  // Pages arrive in insertion (rowid) order. Stable sort keeps a generated
  // batch's original order when all its cards share the same timestamp.
  cards.sort((a, b) => compare(a.createdAt, b.createdAt));
  for (const card of cards) { const group = bySet.get(card.setId) || []; group.push(card); bySet.set(card.setId, group); }
  const sets = summaries.sort((a, b) => compare(b.updatedAt, a.updatedAt) || compare(a.id, b.id)).map(set => ({ ...set, cards: bySet.get(set.id) || [] }));
  folders.sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));
  const { materialsVersion: _version, collections: _collections, ...state } = page;
  void _version; void _collections;
  return { ...state, sets, folders };
}

// One adapter shared by every Web/mobile consumer, outside the account-scoped
// transport: every continuation retains authentication and stale-account checks.
const adapters = new WeakMap<ApiTransport, ApiTransport>();
const assertScopes = new WeakMap<ApiTransport, () => void>();
export function materialDataTransport(request: ApiTransport, assertCurrent: () => void = () => {}): ApiTransport {
  const existing = adapters.get(request);
  if (existing) return existing;
  const adapted: ApiTransport = async (path, options) => {
    assertCurrent();
    const response = await request(path, options);
    if (path.split('?')[0] !== '/api/data' || !response.ok) return response;
    const json = response.json.bind(response);
    response.json = async () => {
      const body = await json();
      // Old small-account fixtures/cached application versions can still be read.
      if (!body || typeof body !== 'object') return body;
      const envelope = body as Record<string, unknown>;
      const page = envelope.data ?? envelope;
      if (!page || typeof page !== 'object' || !('materialsVersion' in page) || page.materialsVersion !== 1) return body;
      const data = await assembleAppData(request, page as AppDataPage, options);
      assertCurrent();
      return envelope.data ? { ...envelope, data } : data;
    };
    return response;
  };
  adapters.set(request, adapted);
  assertScopes.set(adapted, assertCurrent);
  return adapted;
}

const details = new WeakMap<ApiTransport, Map<string, Promise<string>>>();
/** Bounded, account-scoped in-memory cache, including in-flight deduplication. */
export function readMaterialText(request: ApiTransport, set: Pick<CardSet, 'id' | 'updatedAt' | 'sourceUpdatedAt'>, field: 'source' | 'keyPoints'): Promise<string> {
  const assertCurrent = assertScopes.get(request) ?? (() => {});
  assertCurrent();
  let cache = details.get(request);
  if (!cache) { cache = new Map(); details.set(request, cache); }
  const key = JSON.stringify([set.id, set.sourceUpdatedAt ?? set.updatedAt, field]);
  const found = cache.get(key);
  if (found) return found.then(value => { assertCurrent(); return value; });
  const result = (async () => {
    const parts: string[] = [], seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const query = new URLSearchParams({ resource: field, id: set.id });
      if (cursor) query.set('cursor', cursor);
      const page: MaterialTextPage = await readApiResponse(await request(`/api/materials?${query}`));
      parts.push(page.content); cursor = page.nextCursor;
      if (cursor && seen.has(cursor)) throw new ReliabilityError('invalid_response');
      if (cursor) seen.add(cursor);
    } while (cursor);
    assertCurrent();
    return parts.join('');
  })();
  cache.set(key, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  void result.catch(() => { if (cache.get(key) === result) cache.delete(key); });
  return result;
}
