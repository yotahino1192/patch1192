import { migrate } from '../scripts/infra/migrations.mjs';
import { headers as authHeaders } from './auth-fixture.mjs';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { EMPTY_SESSION, EMPTY_WORKSPACE, parseWorkspace, reconcileSession } from '../lib/workspace.ts';
const { mkdtemp, rm } = await import('node:fs/promises');
const { tmpdir } = await import('node:os');
const directory = await mkdtemp(tmpdir() + '/loop-delivery-');
const client = createClient({ url: 'file:' + directory + '/test.db' });
await migrate(client);
const db = createDatabase(client);
globalThis.__deliveryDatabase = db;
after(async () => { client.close(); await rm(directory, { recursive:true, force:true }); });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './client') return { url: 'data:text/javascript,export function database(){return globalThis.__deliveryDatabase} export async function initializeDatabase(){await globalThis.__deliveryDatabase.initialize()}', shortCircuit: true };
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return next(new URL(specifier + '.ts', context.parentURL).href, context);
  return next(specifier, context);
} });
const { saveGeneratedSet, loadAppData, reviewCard, undoReview } = await import('../db/store.ts');
async function setup(user) {
  await saveGeneratedSet(user, { title:'Test', category:'Test', summary:'', keyPoints:[], sourceContent:'Source', cards:[{question:'Q',answer:'A',format:'qa',choices:[],difficulty:1}] });
  const card = (await loadAppData(user)).sets[0].cards[0];
  const pendingReview = { operationId: crypto.randomUUID(), cardId: card.id, rating:'good', responseMs:100, expectedReviewCount:0 };
  const session = { ...EMPTY_SESSION, id:`session-${user}`, scope:card.setId, setId:card.setId, queue:[card.id], total:1, flipped:true, pendingReview };
  const send = (attempt=pendingReview) => reviewCard(user, attempt.cardId, attempt.rating, attempt.responseMs, session.id, attempt);
  return { card, pendingReview, session, send };
}
test('lost response and retry after reload record an answer once', async () => {
  const {card,session,send}=await setup('lost');
  const saved=JSON.stringify({...EMPTY_WORKSPACE,session});
  const first=await send(); // Commit succeeds; transport loses this response.
  const restored=parseWorkspace(saved).session;
  assert.equal(restored.pendingReview.operationId,session.pendingReview.operationId);
  assert.equal(await send(restored.pendingReview),first);
  const data=await loadAppData('lost',[session.id]);
  assert.equal(data.sets[0].cards[0].reviewCount,1);
  assert.equal(data.sets[0].cards[0].intervalDays,1);
  assert.deepEqual(reconcileSession(restored,data).queue,[]);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM review_logs WHERE card_id=?').bind(card.id).first()).n,1);
});
test('simultaneous duplicate delivery returns the original result; reused ID with different input conflicts', async () => {
  const {send,pendingReview}=await setup('double');
  const deliveries=await Promise.allSettled([send(),send()]);
  assert.ok(deliveries.some((result) => result.status === "fulfilled"));
  const results=await Promise.all(deliveries.map(async (result) => result.status === "fulfilled" ? result.value : await send()));
  assert.equal(results[0],results[1]);
  await assert.rejects(send({...pendingReview,rating:'again'}),/REVIEW_OPERATION_CONFLICT/);
  await assert.rejects(send({...pendingReview,operationId:crypto.randomUUID()}),/REVIEW_STATE_CONFLICT/);
});
test('failed transaction leaves the operation retryable and retry after undo never reapplies it', async () => {
  const {send,card,session}=await setup('rollback');
  await client.execute(`CREATE TEMP TRIGGER fail_delivery BEFORE INSERT ON review_logs WHEN NEW.card_id='${card.id}' BEGIN SELECT RAISE(ABORT, 'delivery rollback'); END`);
  await assert.rejects(send());
  assert.equal((await loadAppData('rollback')).sets[0].cards[0].reviewCount,0);
  await client.execute('DROP TRIGGER fail_delivery');
  const id=await send();await undoReview('rollback',id,session.id);
  assert.equal(await send(),id);
  assert.equal((await loadAppData('rollback')).sets[0].cards[0].reviewCount,0);
});
test('session recovery and undo recovery are not limited by the 500 displayed logs', async () => {
  const {send,session,card}=await setup('old');const id=await send();
  await db.batch(Array.from({length:501},(_,i)=>db.prepare('INSERT INTO review_logs (id,user_id,card_id,session_id,rating,response_ms,reviewed_at,undone_at) VALUES (?,?,?,?,?,?,?,?)').bind(`noise-${i}`,'old',card.id,'other','again',0,new Date(Date.now()+i+1).toISOString(),'undone')));
  const data=await loadAppData('old',[session.id]);
  assert.equal(data.reviews.length,0);
  assert.equal(reconcileSession(session,data).done,true);
  const other=await loadAppData('different-user',[session.id]);assert.equal(other.sessionReviews.length,0);
  await undoReview('old',id,session.id);
  assert.equal(reconcileSession(session,await loadAppData('old',[session.id])).queue.length,1);
});
test('lost incorrect-answer response rotates the queue exactly once on recovery', async () => {
  const {send,session,pendingReview}=await setup('again');
  session.pendingReview={...pendingReview,rating:'again'};
  await send(session.pendingReview);
  const data=await loadAppData('again',[session.id]);
  const restored=reconcileSession(session,data);
  assert.equal(restored.mistakes,1);assert.equal(restored.flipped,false);assert.equal(restored.pendingReview,null);
  assert.deepEqual(reconcileSession(restored,data),restored);
});

const { POST, GET } = await import('../app/api/data/route.ts');
const { resolveInternalUser } = await import('../db/auth-store.ts');
const owner = await resolveInternalUser(process.env.CLERK_ISSUER, 'user_delivery');
const headers = (extra = {}) => authHeaders('user_delivery', owner, extra);
const request = (body) => new Request('http://localhost/api/data', {method:'POST',headers:headers({'content-type':'application/json'}),body:JSON.stringify(body)});
test('API response failure after commit can be retried without another write', async () => {
  const { session, pendingReview } = await setup(owner);
  const payload = {action:'reviewCard',sessionId:session.id,...pendingReview};
  let failRead = false;
  globalThis.__deliveryDatabase = {
    ...db,
    transaction: async (action) => { const result = await db.transaction(action); failRead = true; return result; },
    prepare(sql, args) {
      if (failRead && sql.startsWith('SELECT * FROM card_sets')) { failRead = false; throw new Error('simulated response read failure'); }
      return db.prepare(sql,args);
    },
  };
  try { assert.equal((await POST(request(payload))).status,500); }
  finally { globalThis.__deliveryDatabase = db; }
  const response = await POST(request(payload));assert.equal(response.status,200);
  const result = await response.json();assert.equal(result.data.sets[0].cards[0].reviewCount,1);
  const duplicate = await (await POST(request(payload))).json();assert.equal(duplicate.reviewId,result.reviewId);
  assert.equal((await POST(request({...payload,rating:'again'}))).status,409);
  assert.equal((await POST(request({...payload,operationId:undefined}))).status,400);
  const restored = await (await GET(new Request(`http://localhost/api/data?sessionId=${session.id}`, {headers:headers()}))).json();
  assert.equal(reconcileSession(session,restored).done,true);
});
test('authenticated API rejects invalid bodies before business writes', async () => {
  for (const body of [null,[],42]) assert.equal((await POST(request(body))).status,400);
  assert.equal((await POST(new Request('http://localhost/api/data',{method:'POST',headers:headers({'content-type':'application/json'}),body:'{'}))).status,400);
  assert.equal((await POST(new Request('http://localhost/api/data',{method:'POST',headers:headers(),body:'{}'}))).status,415);
  assert.equal((await POST(new Request('http://localhost/api/data',{method:'POST',headers:headers({'content-type':'application/json-invalid'}),body:'{}'}))).status,415);
  const oversized = ' '.repeat(2 * 1024 * 1024 + 1);
  assert.equal((await POST(new Request('http://localhost/api/data',{method:'POST',headers:headers({'content-type':'application/json'}),body:oversized}))).status,413);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(oversized)); controller.close(); } });
  assert.equal((await POST(new Request('http://localhost/api/data',{method:'POST',headers:headers({'content-type':'application/json'}),body:stream,duplex:'half'}))).status,413);
  assert.equal((await POST(request({action:'addCardsToSet',setId:'x',cards:[{question:123,answer:'A',choices:[],format:'qa',difficulty:1}]}))).status,400);
  assert.equal((await GET(new Request('http://localhost/api/data?sessionId=bad%20id',{headers:headers()}))).status,400);
});
test('database unique constraint rejects bypassed duplicate operation IDs', async () => {
  const {send,card,pendingReview}=await setup('constraint');await send();
  await assert.rejects(db.prepare('INSERT INTO review_logs (id,user_id,card_id,rating,response_ms,reviewed_at,operation_id) VALUES (?,?,?,?,?,?,?)').bind('bypass','constraint',card.id,'good',0,new Date().toISOString(),pendingReview.operationId).run(),/UNIQUE/);
});
