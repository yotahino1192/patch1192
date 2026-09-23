import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { migrate } from '../scripts/infra/migrations.mjs';
import { headers, issuer, origin } from './auth-fixture.mjs';
import { materialDataTransport, readMaterialText } from '../lib/material-data-client.ts';
import { MATERIAL_PAGE_BYTES, MATERIAL_MAX_PAGE_SIZE } from '../lib/material-data.ts';

const c = createClient({ url: ':memory:' }); await migrate(c);
const db = createDatabase(c), queries = [];
globalThis.__materialsDb = { ...db, prepare(sql) { queries.push(sql); return db.prepare(sql); } };
after(() => c.close());
registerHooks({ resolve(s, ctx, next) {
  if (s === './client') return { url: 'data:text/javascript,export function database(){return globalThis.__materialsDb} export async function initializeDatabase(){await globalThis.__materialsDb.initialize()}', shortCircuit: true };
  if (s.startsWith('.') && !/\.[a-z]+$/.test(s)) { const url = new URL(s + '.ts', ctx.parentURL); if (existsSync(url)) return next(url.href, ctx); }
  return next(s, ctx);
} });
const { createAccountScope } = await import('../lib/account-scope.ts');
const { configureApi, apiFetch } = await import('../lib/api-client.ts');
const data = await import('../app/api/data/route.ts'), materials = await import('../app/api/materials/route.ts');
const store = await import('../db/store.ts'), { loadMaterialPage, loadMaterialText } = await import('../db/materials.ts');
const { resolveInternalUser } = await import('../db/auth-store.ts');
let serial = 0;
async function user() { const subject = 'user_materials_' + ++serial; return { subject, userId: await resolveInternalUser(issuer, subject) }; }
const material = (extra = {}) => ({ title: 'Fixture', category: 'fixture', summary: '', keyPoints: [], sourceContent: '文'.repeat(30000), cards: [{ question: 'Q', answer: 'A', format: 'qa', choices: [], difficulty: 1 }], ...extra });
function transport(u, calls = []) {
  return async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET' });
    const req = new Request(origin + path, { ...options, headers: headers(u.subject, u.userId, { 'content-type': 'application/json', ...Object.fromEntries(new Headers(options.headers)) }) });
    return path.startsWith('/api/materials') ? materials.GET(req) : options.method === 'POST' ? data.POST(req) : data.GET(req);
  };
}
async function drain(u, resource, limit = '10') {
  const result = []; let cursor = null;
  do { const page = await loadMaterialPage(u.userId, resource, cursor, limit); assert.ok(Buffer.byteLength(JSON.stringify(page)) < MATERIAL_PAGE_BYTES); result.push(...page.items); cursor = page.nextCursor; } while (cursor);
  return result;
}

test('60 × 30,000 Japanese characters: raw GET and mutation collections omit full source and remain bounded; one joined source metadata query', async () => {
  const u = await user();
  for (let i = 0; i < 60; i++) await store.saveGeneratedSet(u.userId, material({ title: 'Fixture ' + i }));
  const before = Buffer.byteLength(JSON.stringify(await store.loadAppData(u.userId)));
  queries.length = 0;
  const response = await transport(u)('/api/data'); assert.equal(response.status, 200);
  const wireText = await response.text(), wire = JSON.parse(wireText), after = Buffer.byteLength(wireText);
  assert.ok(before > 4.5 * 1024 * 1024); assert.ok(after < 100000);
  assert.equal(wire.materialsVersion, 1); assert.equal(wire.collections.sets.items.length, 60);
  assert.equal(wire.collections.cards.items.length, 60);
  assert.equal(wire.collections.sets.nextCursor, null);
  assert.equal('sets' in wire, false);
  for (const set of wire.collections.sets.items) for (const key of ['sourceContent', 'content', 'keyPoints', 'cards']) assert.equal(key in set, false);
  assert.equal(queries.filter(sql => sql.includes('JOIN sources')).length, 1);
  assert.ok(!queries.some(sql => sql.includes('s.content')));
  const changed = await transport(u)('/api/data', { method: 'POST', body: JSON.stringify({ action: 'renameSet', setId: wire.collections.sets.items[0].id, title: 'Renamed' }) });
  assert.equal(changed.status, 200); const mutation = await changed.text(); assert.ok(Buffer.byteLength(mutation) < 100000); assert.ok(!mutation.includes('sourceContent'));
  console.log(JSON.stringify({ materials: 60, charactersPerMaterial: 30000, beforeBytes: before, afterBytes: after }));
});

test('empty and small accounts preserve Home/Patches/search/Study data without source detail requests on Web and mobile transports', async () => {
  for (const native of [false, true]) {
    const u = await user(), calls = [], raw = transport(u, calls);
    if (native) configureApi('https://native-api.example', (url, options) => { const parsed = new URL(url); assert.equal(parsed.origin, 'https://native-api.example'); return raw(parsed.pathname + parsed.search, options); });
    const scope = createAccountScope({ ...u, sessionId: 'sess_' + u.subject }, {}, native ? apiFetch : raw);
    const api = materialDataTransport(scope.request, scope.assertCurrent);
    const empty = await (await api('/api/data')).json(); assert.deepEqual(empty.sets, []); assert.deepEqual(empty.folders, []);
    const saved = await (await api('/api/data', { method: 'POST', body: JSON.stringify({ action: 'saveSet', material: material({ summary: 'Preview', keyPoints: ['Intro'] }) }) })).json();
    const set = saved.data.sets[0]; assert.equal(set.summary, 'Preview'); assert.equal(set.cards[0].question, 'Q'); assert.equal(set.sourceContent, undefined);
    assert.equal(calls.filter(call => call.path.startsWith('/api/materials')).length, 0, 'first pages inline, no N+1 detail fetching');
    const [a, b] = await Promise.all([readMaterialText(api, set, 'source'), readMaterialText(api, set, 'source')]);
    assert.equal(a, material().sourceContent); assert.equal(a, b);
    await readMaterialText(api, { ...set, updatedAt: 'review-only-change' }, 'source');
    assert.equal(calls.filter(call => call.path.includes('resource=source')).length, 1, 'shared detail cache survives review updates');
    assert.deepEqual(JSON.parse(await readMaterialText(api, set, 'keyPoints')), ['Intro']);
    scope.invalidate(); await assert.rejects(api('/api/data'), /アカウント/); assert.throws(() => readMaterialText(api, set, 'source'), /アカウント/);
  }
});

test('count/byte pagination: stable keysets survive rename, insertion and deletion; limits and account-bound cursors are enforced', async () => {
  const u = await user(), other = await user(), ids = [];
  for (let i = 0; i < 205; i++) ids.push(await store.saveGeneratedSet(u.userId, material({ sourceContent: 'S', title: 'Same timestamp title' })));
  const plan = await c.execute({ sql: 'EXPLAIN QUERY PLAN SELECT p.rowid,p.id FROM card_sets p WHERE p.user_id=? AND p.rowid>? AND p.rowid<=? ORDER BY p.rowid LIMIT ?', args: [u.userId, 0, 999999, 101] });
  assert.match(JSON.stringify(plan.rows), /card_sets_user_idx/, 'existing owner index supports bounded rowid ranges');
  const first = await loadMaterialPage(u.userId, 'sets'); assert.equal(first.items.length, 100); assert.ok(first.nextCursor);
  await store.manageMaterial(u.userId, { action: 'renameSet', setId: ids[101], title: 'Moved sort position' });
  const inserted = await store.saveGeneratedSet(u.userId, material({ sourceContent: 'Later' }));
  await c.execute({ sql: 'DELETE FROM card_sets WHERE user_id=? AND id=?', args: [u.userId, ids[120]] });
  const second = await loadMaterialPage(u.userId, 'sets', first.nextCursor);
  const third = await loadMaterialPage(u.userId, 'sets', second.nextCursor);
  assert.equal(third.nextCursor, null);
  const readIds = [...first.items, ...second.items, ...third.items].map(s => s.id);
  assert.equal(new Set(readIds).size, 204); assert.deepEqual(new Set(readIds), new Set(ids.filter(id => id !== ids[120]))); assert.ok(!readIds.includes(inserted));
  assert.equal((await loadMaterialPage(u.userId, 'sets', null, String(MATERIAL_MAX_PAGE_SIZE))).items.length, 200);
  for (const limit of ['0', '201', '-1', '1.5', '99999']) await assert.rejects(loadMaterialPage(u.userId, 'sets', null, limit));
  await assert.rejects(loadMaterialPage(other.userId, 'sets', first.nextCursor));
  await assert.rejects(loadMaterialPage(u.userId, 'cards', first.nextCursor));
  const api = materialDataTransport(transport(u));
  const assembled = await (await api('/api/data')).json(); assert.equal(assembled.sets.length, 205); assert.ok(assembled.sets.some(s => s.id === inserted));
  const heavy = await user();
  const big = { question: '問'.repeat(5000), answer: '答'.repeat(10000), format: 'multiple_choice', choices: ['答'.repeat(10000), '乙'.repeat(10000), '丙'.repeat(10000), '丁'.repeat(10000)], difficulty: 1 };
  await store.saveGeneratedSet(heavy.userId, material({ summary: '\u0001'.repeat(10000), cards: Array.from({ length: 10 }, () => big) }));
  const page = await loadMaterialPage(heavy.userId, 'cards'); assert.ok(page.items.length < 10); assert.ok(page.nextCursor); assert.ok(Buffer.byteLength(JSON.stringify(page)) < MATERIAL_PAGE_BYTES);
  assert.equal((await drain(heavy, 'cards', '200')).length, 10);
});

test('detail chunks round-trip Unicode and appended text without truncation; missing/deleted/cross-account targets and mixed revisions fail safely', async () => {
  const u = await user(), other = await user(), source = '文😀\n'.repeat(30000);
  const id = await store.saveGeneratedSet(u.userId, material({ sourceContent: source, keyPoints: Array.from({ length: 100 }, () => '要'.repeat(5000)) }));
  const calls = [], api = materialDataTransport(transport(u, calls)), set = { id, updatedAt: 'revision1' };
  assert.equal(await readMaterialText(api, set, 'source'), source);
  assert.deepEqual(JSON.parse(await readMaterialText(api, set, 'keyPoints')), Array.from({ length: 100 }, () => '要'.repeat(5000)));
  for (const call of calls) { const r = await transport(u)(call.path); assert.ok(Buffer.byteLength(await r.text()) < MATERIAL_PAGE_BYTES); }
  const first = await loadMaterialText(u.userId, id, 'source'); assert.ok(first.nextCursor);
  await store.addCardsToSet(u.userId, id, material().cards, { title: 'More', content: '追'.repeat(30000) });
  await assert.rejects(loadMaterialText(u.userId, id, 'source', first.nextCursor), error => error.status === 409);
  const updated = await readMaterialText(api, { ...set, updatedAt: 'revision2' }, 'source'); assert.equal(updated, source + '\n\n--- More ---\n' + '追'.repeat(30000));
  for (const who of [other, u]) {
    const response = await transport(who)(`/api/materials?resource=source&id=${who === u ? 'missing' : id}`); assert.equal(response.status, 404);
  }
  const card = (await loadMaterialPage(u.userId, 'cards')).items[0];
  await store.manageMaterial(u.userId, { action: 'deleteCard', cardId: card.id });
  assert.equal((await loadMaterialPage(u.userId, 'cards')).items[0].status, '削除済み');
  assert.equal((await loadMaterialText(u.userId, id, 'source')).content, Array.from(updated).slice(0, 32000).join(''));
  await c.execute({ sql: 'DELETE FROM card_sets WHERE user_id=? AND id=?', args: [u.userId, id] });
  assert.equal((await transport(u)(`/api/materials?resource=source&id=${id}`)).status, 404);
  assert.equal((await materials.GET(new Request(origin + '/api/materials?resource=sets'))).status, 401);
  for (const query of ['resource=sets&limit=201', 'resource=sets&resource=cards', 'resource=source&id=x&limit=1', 'resource=sets&cursor=bad', 'resource=sets&ownerId=x']) assert.equal((await transport(u)('/api/materials?' + query)).status, 400);
});
