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
const db = createDatabase(client);
globalThis.__deliveryDatabase = db;
after(async () => { client.close(); await rm(directory, { recursive:true, force:true }); });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === './client') return { url: 'data:text/javascript,export function database(){return globalThis.__deliveryDatabase} export async function initializeDatabase(){await globalThis.__deliveryDatabase.initialize()}', shortCircuit: true };
  if (['../lib/daily-review', '../lib/review'].includes(specifier)) return next(new URL(specifier + '.ts', context.parentURL).href, context);
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
  await client.execute(`CREATE TRIGGER fail_delivery BEFORE INSERT ON review_logs WHEN NEW.card_id='${card.id}' BEGIN SELECT RAISE(ABORT, 'delivery rollback'); END`);
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
