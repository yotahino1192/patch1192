import { database, initializeDatabase } from './client';
import { loadAppData, mapCard } from './store.ts';
import { InputError, validId } from '../lib/api-input.ts';
import { MATERIAL_PAGE_BYTES, MATERIAL_PAGE_SIZE, MATERIAL_MAX_PAGE_SIZE, MATERIAL_TEXT_CHARACTERS, type AppDataPage, type MaterialCollection, type MaterialPages, type MaterialTextPage, type MaterialSummary } from '../lib/material-data.ts';
import type { Card, Folder } from '../lib/types';

type Cursor = { owner: string; resource: string; after: number; through: number; revision?: string; id?: string };
const encode = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');
function decode(value: string | null, userId: string, resource: string): Cursor | null {
  if (!value) return null;
  try {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error();
    const c = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (c.owner !== userId || c.resource !== resource || !Number.isSafeInteger(c.after) || !Number.isSafeInteger(c.through) || c.after < 0 || c.through < c.after) throw Error();
    return c;
  } catch { throw new InputError('INVALID_MATERIAL_CURSOR'); }
}
function pageSize(value: string | null) {
  if (value === null) return MATERIAL_PAGE_SIZE;
  if (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > MATERIAL_MAX_PAGE_SIZE) throw new InputError('INVALID_MATERIAL_LIMIT');
  return Number(value);
}

// Immutable rowid keysets prevent rename/review/move from shifting page boundaries.
// Capture an insertion watermark; new rows are picked up on the next refresh.
export async function loadMaterialPage<R extends MaterialCollection>(userId: string, resource: R, cursor: string | null = null, limit: string | null = null): Promise<MaterialPages[R]> {
  await initializeDatabase();
  const size = pageSize(limit), db = database();
  const table = { sets: 'card_sets', cards: 'cards', folders: 'folders' }[resource];
  if (!table) throw new InputError('INVALID_MATERIAL_RESOURCE');
  const previous = decode(cursor, userId, resource);
  const through = previous?.through ?? Number((await db.prepare(`SELECT COALESCE(MAX(rowid),0) AS value FROM ${table} WHERE user_id=?`).bind(userId).first<{value:number}>())?.value || 0);
  const selection = resource === 'sets'
    ? 'p.rowid AS page_row, p.id,p.folder_id,p.title,p.category,p.summary,p.created_at,p.updated_at,p.last_studied_at,p.next_review_at,s.input_kind,s.updated_at AS source_updated_at'
    : 'p.rowid AS page_row,p.*';
  const join = resource === 'sets' ? ' LEFT JOIN sources s ON s.id=p.source_id AND s.user_id=p.user_id' : '';
  const rows = (await db.prepare(`SELECT ${selection} FROM ${table} p${join} WHERE p.user_id=? AND p.rowid>? AND p.rowid<=? ORDER BY p.rowid LIMIT ?`).bind(userId, previous?.after ?? 0, through, size + 1).all()).results;
  const items: (MaterialSummary | Card | Folder)[] = [];
  let bytes = 2048, after = previous?.after ?? 0;
  for (const row of rows.slice(0, size)) {
    const item = resource === 'cards' ? mapCard(row) : resource === 'folders'
      ? { id: String(row.id), parentId: row.parent_id ? String(row.parent_id) : null, name: String(row.name) }
      : { id: String(row.id), folderId: row.folder_id ? String(row.folder_id) : null, title: String(row.title), category: String(row.category), summary: String(row.summary), sourceKind: (row.input_kind || 'source') as MaterialSummary['sourceKind'], sourceUpdatedAt: String(row.source_updated_at || row.created_at), createdAt: String(row.created_at), updatedAt: String(row.updated_at), lastStudiedAt: row.last_studied_at ? String(row.last_studied_at) : null, nextReviewAt: row.next_review_at ? String(row.next_review_at) : null };
    const cost = Buffer.byteLength(JSON.stringify(item), 'utf8') + 1;
    if (bytes + cost > MATERIAL_PAGE_BYTES) {
      if (!items.length) throw new InputError('MATERIAL_ITEM_TOO_LARGE', 503);
      break;
    }
    items.push(item); bytes += cost; after = Number(row.page_row);
  }
  return { items, nextCursor: rows.length > items.length ? encode({ owner: userId, resource, after, through }) : null } as MaterialPages[R];
}

export async function loadAppDataPage(userId: string, sessions: string[] = [], timezone?: string): Promise<AppDataPage> {
  // Never load all materials merely to slice a wire response.
  const { sets: _sets, folders: _folders, ...state } = await loadAppData(userId, sessions, timezone, false);
  void _sets; void _folders;
  const [sets, cards, folders] = await Promise.all([loadMaterialPage(userId, 'sets'), loadMaterialPage(userId, 'cards'), loadMaterialPage(userId, 'folders')]);
  return { ...state, materialsVersion: 1, collections: { sets, cards, folders } };
}

/** Source content grows when appending material, so even a single detail is chunked. */
export async function loadMaterialText(userId: string, id: string, field: 'source' | 'keyPoints', cursor: string | null = null): Promise<MaterialTextPage> {
  if (!validId(id)) throw new InputError('INVALID_MATERIAL_ID');
  await initializeDatabase();
  const previous = decode(cursor, userId, field);
  if (previous && previous.id !== id) throw new InputError('INVALID_MATERIAL_CURSOR');
  const text = field === 'source' ? "COALESCE(s.content,'')" : 'p.key_points';
  const row = await database().prepare(`SELECT substr(${text},?,?) AS content, length(${text}) AS size, p.updated_at || ':' || COALESCE(s.updated_at,'') AS revision FROM card_sets p LEFT JOIN sources s ON s.id=p.source_id AND s.user_id=p.user_id WHERE p.user_id=? AND p.id=?`)
    .bind((previous?.after ?? 0) + 1, MATERIAL_TEXT_CHARACTERS, userId, id).first<{ content: string; size: number; revision: string }>();
  if (!row) throw new InputError('MATERIAL_NOT_FOUND', 404);
  if (previous && (previous.revision !== row.revision || previous.through !== Number(row.size))) throw new InputError('MATERIAL_CHANGED', 409);
  const after = (previous?.after ?? 0) + MATERIAL_TEXT_CHARACTERS;
  return { content: row.content, nextCursor: after < Number(row.size) ? encode({ owner: userId, resource: field, id, revision: row.revision, after, through: Number(row.size) }) : null };
}

export async function materialCardIds(userId: string, setId: string): Promise<string[]> {
  return (await database().prepare('SELECT id FROM cards WHERE user_id=? AND set_id=? ORDER BY created_at,rowid').bind(userId, setId).all<{id:string}>()).results.map(row => row.id);
}
