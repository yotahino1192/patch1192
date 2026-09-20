import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { migrate } from '../scripts/infra/migrations.mjs';
import { headers as authHeaders } from './auth-fixture.mjs';
import { reviewError, materialSaveInput } from '../lib/material-save.ts';
import { EMPTY_WORKSPACE, parseWorkspace } from '../lib/workspace.ts';
const dir = await mkdtemp(tmpdir() + '/patch-material-save-');
const client = createClient({ url: 'file:' + dir + '/test.db' }); await migrate(client);
globalThis.__materialSaveDb = createDatabase(client);
after(async () => { client.close(); await rm(dir, { recursive: true, force: true }); });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './client') return { url: 'data:text/javascript,export function database(){return globalThis.__materialSaveDb} export async function initializeDatabase(){await globalThis.__materialSaveDb.initialize()}', shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return next(new URL(specifier + '.ts', context.parentURL).href, context);
  return next(specifier, context);
} });
const store = await import('../db/store.ts');
const { POST } = await import('../app/api/data/route.ts');
const { GET: session } = await import('../app/api/auth/session/route.ts');
const material = { title: 'Memory', category: 'Learning', summary: '', keyPoints: ['Recall supports memory'], sourceContent: 'Recall supports memory. Practice helps retrieval.', cards: [{ question: 'What supports memory?', answer: 'Recall', choices: [], format: 'qa', difficulty: 1 }] };
const draft = { ...material, cards: material.cards.map((c, i) => ({ ...c, selected: true, draftId: String(i) })) };
async function user(subject) { const r = await session(new Request('http://localhost/api/auth/session', { headers: authHeaders(subject) })); return { subject, ...(await r.json()) }; }
function send(who, body) { return POST(new Request('http://localhost/api/data', { method: 'POST', headers: authHeaders(who.subject, who.userId, { 'content-type': 'application/json' }), body: JSON.stringify(body) })); }

test('new Patch save replays the original result across concurrent delivery and lost response', async () => {
  const who = await user('user_material_new'), operationId = crypto.randomUUID();
  const payload = { action: 'saveSet', material, operationId };
  const responses = await Promise.all([send(who, payload), send(who, payload)]);
  for (const r of responses) assert.equal(r.status, 200);
  const [a,b] = await Promise.all(responses.map(r => r.json()));
  assert.equal(a.setId, b.setId); assert.deepEqual(a.cardIds, b.cardIds); assert.equal(b.data.sets.length, 1);
  await store.addCardsToSet(who.userId, a.setId, [{ ...material.cards[0], question: 'Later material' }]);
  const replay = await (await send(who, payload)).json();
  assert.deepEqual(replay.cardIds, a.cardIds, 'Replay targets original material, not later additions');
  assert.equal(replay.data.sets[0].cards.length, 2);
  assert.equal((await send(who, { ...payload, material: { ...material, title: 'Changed' } })).status, 409);
});
test('append retry is atomic and preserves name, prior cards, source and learning progress', async () => {
  const who = await user('user_material_append');
  const setId = await store.saveGeneratedSet(who.userId, material);
  const before = await store.loadAppData(who.userId);
  const payload = { action: 'addCardsToSet', setId, sourceTitle: 'New notes', sourceContent: 'New source', cards: [{ ...material.cards[0], question: 'New question' }], operationId: crypto.randomUUID() };
  const a = await (await send(who, payload)).json(); const b = await (await send(who, payload)).json();
  assert.deepEqual(a.cardIds,b.cardIds); assert.equal(b.cardIds.length,1); assert.equal(b.setId,setId);
  const set = b.data.sets[0]; assert.equal(set.title,material.title); assert.equal(set.cards.length,2);
  assert.equal(set.sourceContent.split('New source').length,2);
  assert.deepEqual(set.cards.find(c => c.id === before.sets[0].cards[0].id),before.sets[0].cards[0]);
  assert.deepEqual(b.data.reviews,before.reviews); assert.equal(b.data.retention.streak,before.retention.streak); assert.equal(b.data.retention.session,before.retention.session);
  await store.manageMaterial(who.userId,{action:'deleteCard',cardId:b.cardIds[0]});
  assert.equal((await send(who,payload)).status,200,'Soft deletion retains duplicate protection');
  const other = await user('user_material_other');
  assert.equal((await send(other,payload)).status,404);
});
test('failed atomic write can retry without leaving an orphan source or partial append',async()=>{
  const who=await user('user_material_rollback');const setId=await store.saveGeneratedSet(who.userId,material);
  const before=await store.loadAppData(who.userId);const operationId=crypto.randomUUID();
  const original=globalThis.__materialSaveDb;
  globalThis.__materialSaveDb={...original,transaction:fn=>original.transaction(tx=>fn({execute:statement=>{if(statement.sql.includes('INSERT INTO cards'))throw Error('TEST_WRITE_FAILURE');return tx.execute(statement);}}))};
  try { await assert.rejects(store.addCardsToSet(who.userId,setId,[{...material.cards[0],question:'Fail me'}],{title:'Test',content:'Retry source'},operationId),/TEST_WRITE_FAILURE/); }
  finally { globalThis.__materialSaveDb=original; }
  assert.deepEqual((await store.loadAppData(who.userId)).sets,before.sets);
  const ids=await store.addCardsToSet(who.userId,setId,[{...material.cards[0],question:'Fail me'}],{title:'Test',content:'Retry source'},operationId);
  assert.equal(ids.length,1);assert.equal((await store.loadAppData(who.userId)).sets[0].cards.length,2);
});
test('operation IDs are account scoped and reject malformed/reused different payloads',async()=>{
  const a=await user('user_material_scope_a'),b=await user('user_material_scope_b');const operationId=crypto.randomUUID();
  const x=await(await send(a,{action:'saveSet',material,operationId})).json();const y=await(await send(b,{action:'saveSet',material,operationId})).json();
  assert.notEqual(x.setId,y.setId);assert.notDeepEqual(x.cardIds,y.cardIds);
  assert.equal((await send(a,{action:'saveSet',material,operationId:'invalid space'})).status,400);
});
test('Review rejects missing outcomes and invalid choice content; draft and exact pending save survive reload',()=>{
  assert.equal(reviewError(draft,'root',[]),'');
  assert.match(reviewError({...draft,keyPoints:[]},'root',[]),/outcomes/);
  assert.match(reviewError({...draft,cards:[]},'root',[]),/study content/);
  assert.match(reviewError({...draft,cards:[{...draft.cards[0],format:'multiple_choice',choices:['A','A','B','C']}]},'root',[]),/options/);
  assert.match(reviewError({...draft,title:' '},'root',[]),/name/);
  const pendingMaterialSave={operationId:crypto.randomUUID(),payload:materialSaveInput(draft,'set:existing')};
  const restored=parseWorkspace(JSON.stringify({...EMPTY_WORKSPACE,draft,pendingMaterialSave}));
  assert.deepEqual(restored.pendingMaterialSave,pendingMaterialSave);assert.deepEqual(restored.draft,draft);
  assert.equal(restored.pendingMaterialSave.payload.action,'addCardsToSet');assert.equal('title' in restored.pendingMaterialSave.payload,false);
});
