import { migrate } from '../scripts/infra/migrations.mjs';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';
import { createClient } from '@libsql/client';
import { createDatabase } from '../db/client.ts';
import { headers, token, issuer, origin } from './auth-fixture.mjs';
const client = createClient({url: ':memory:'});
await migrate(client);
const db = createDatabase(client);
globalThis.__authDatabase = db;
after(() => client.close());
registerHooks({resolve(specifier, context, next) {
  if ((specifier === './client' || specifier === '../../../../db/client')) return {url:'data:text/javascript,export function database(){return globalThis.__authDatabase} export async function initializeDatabase(){await globalThis.__authDatabase.initialize()}',shortCircuit:true};
  if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return next(new URL(specifier+'.ts',context.parentURL).href,context);
  return next(specifier,context);
}});
const { GET, POST } = await import('../app/api/data/route.ts');
const { GET: SESSION } = await import('../app/api/auth/session/route.ts');
const { POST: CHAT } = await import('../app/api/ai/chat/route.ts');
const { POST: GENERATE } = await import('../app/api/ai/cards/route.ts');
const { resolveInternalUser } = await import('../db/auth-store.ts');
const store = await import('../db/store.ts');
const material = name => ({title:name,category:'Test',summary:'',keyPoints:[],sourceContent:`private source ${name}`,cards:[{question:`private question ${name}`,answer:'A',format:'qa',choices:[],difficulty:1}]});
const request = (subject, owner, body, extra = {}, path = '/api/data') => new Request(origin+path, {method:body === undefined ? 'GET' : 'POST',headers:headers(subject,owner,{'content-type':'application/json',...extra}),...(body === undefined ? {} : {body:JSON.stringify(body)})});
const bootstrap = async subject => {const response=await SESSION(request(subject,null,undefined,{},'/api/auth/session'));assert.equal(response.status,200);return response.json();};

test('all API handlers reject missing credentials with 401, including forged client identity', async () => {
  for (const [handler,path,method] of [[GET,'data','GET'],[POST,'data','POST'],[SESSION,'auth/session','GET'],[CHAT,'ai/chat','POST'],[GENERATE,'ai/cards','POST']]) {
    const response = await handler(new Request(`${origin}/api/${path}`,{method,headers:{'x-user-id':'loop-owner','x-patch-account':'loop-owner','x-patch-session':'sess_forged'}}));
    assert.equal(response.status,401,path);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  assert.equal((await db.prepare('SELECT count(*) n FROM users').first()).n,0);
});

test('signature, expiration, issuer, session type, azp, ambiguous credentials and stale account binding are checked', async () => {
  for (const claim of [{iss:'https://other.clerk.accounts.dev'},{exp:1},{nbf:9999999999},{sub:'machine_x'},{sid:undefined},{sts:'pending'},{act:{sub:'user_other'}},{azp:'https://attacker.example'}]) {
    assert.equal((await SESSION(request('user_A',null,undefined,{authorization:`Bearer ${token('user_A',claim)}`}))).status,401);
  }
  const invalid=token('user_A').split('.'); invalid[1]=Buffer.from(JSON.stringify({iss:issuer,sub:'user_B',sid:'sess_user_A'})).toString('base64url');
  assert.equal((await SESSION(request('user_A',null,undefined,{authorization:`Bearer ${invalid.join('.')}`}))).status,401);
  assert.equal((await SESSION(request('user_A',null,undefined,{cookie:`__session=${token('user_B')}`}))).status,401);
  assert.equal((await SESSION(request('user_A',null,undefined,{'x-patch-session':'sess_user_B'}))).status,409);
  const a=await bootstrap('user_A');
  assert.equal((await GET(request('user_A','loop-owner'))).status,409);
  assert.equal((await GET(request('user_A',a.userId))).status,200);
});

test('web cookie requires allowed azp and mutation Origin; native bearer works without cookies', async () => {
  const a=await bootstrap('user_A');
  const cookie=token('user_A',{azp:origin});
  const opts={method:'POST',headers:{cookie:`__session=${cookie}`,'content-type':'application/json','x-patch-session':a.sessionId,'x-patch-account':a.userId},body:JSON.stringify({action:'createFolder',name:'Web'})};
  assert.equal((await POST(new Request(origin+'/api/data',opts))).status,403);
  assert.equal((await POST(new Request(origin+'/api/data',{...opts,headers:{...opts.headers,origin:'https://attacker.example'}}))).status,403);
  assert.equal((await POST(new Request(origin+'/api/data',{...opts,headers:{...opts.headers,origin}}))).status,200);
  assert.equal((await GET(new Request(origin+'/api/data',{headers:opts.headers}))).status,200);
  assert.equal((await GET(new Request(origin+'/api/data',{headers:{...opts.headers,cookie:`__session=${token('user_A')}`}}))).status,401);
});

test('A and B own isolated data; reload retains mapping; legacy is neither claimed nor returned', async () => {
  await store.saveGeneratedSet('loop-owner',material('legacy'));
  const a=await bootstrap('user_A'),b=await bootstrap('user_B');
  assert.notEqual(a.userId,b.userId);assert.notEqual(a.userId,'loop-owner');
  assert.deepEqual(await bootstrap('user_A'),a);
  const concurrent=await Promise.all(Array.from({length:5},()=>resolveInternalUser(issuer,'user_concurrent')));assert.equal(new Set(concurrent).size,1);
  assert.notEqual(await resolveInternalUser('https://different-issuer.example','user_A'),a.userId);
  for(const [subject,owner,label] of [['user_A',a,'A'],['user_B',b,'B']]) {
    const response=await POST(request(subject,owner.userId,{action:'saveSet',userId: label==='A'?b.userId:a.userId,material:{...material(label),user_id:'loop-owner'}}));
    assert.equal(response.status,200);
    const data=(await response.json()).data;assert.equal(data.sets.length,1);assert.equal(data.sets[0].title,label);
    const reload=await (await GET(request(subject,owner.userId,undefined,{'x-user-id':'loop-owner'}))).json();
    assert.equal(reload.sets[0].sourceContent,`private source ${label}`);assert.ok(!JSON.stringify(reload).includes('legacy'));
  }
  assert.equal((await db.prepare("SELECT count(*) n FROM auth_identities WHERE user_id='loop-owner'").first()).n,0);
  assert.equal((await store.loadAppData('loop-owner')).sets[0].title,'legacy');
});

test('all resource mutations and AI context deny foreign IDs identically to missing IDs', async () => {
  const a=await bootstrap('user_A'),b=await bootstrap('user_B');
  const target=(await store.loadAppData(b.userId)).sets[0];const card=target.cards[0];
  const folder=await store.organizeSets(b.userId,{action:'createFolder',folderId:null,name:'B folder'});
  const mutations = [
    {action:'renameSet',setId:target.id,title:'stolen'},
    {action:'editCard',cardId:card.id,question:'stolen',answer:'stolen'},
    ...['deleteCard','archiveCard','restoreCard'].map(action=>({action,cardId:card.id})),
    {action:'renameFolder',folderId:folder,name:'stolen'},
    {action:'createFolder',folderId:folder,name:'stolen'},
    {action:'moveSet',setId:target.id,folderId:null},
    {action:'saveSet',material:{...material('stolen'),folderId:folder}},
    {action:'addCardsToSet',setId:target.id,cards:material('stolen').cards,sourceContent:'stolen'},
    {action:'reviewCard',cardId:card.id,sessionId:'lesson_shared',operationId:'operation_shared',expectedReviewCount:0,rating:'good',responseMs:50},
  ];
  for(const body of mutations) {
    const denied=await POST(request('user_A',a.userId,body));assert.equal(denied.status,404,body.action);
    const missing=JSON.parse(JSON.stringify(body).replaceAll(target.id,'missing-set').replaceAll(card.id,'missing-card').replaceAll(folder,'missing-folder'));
    const absent=await POST(request('user_A',a.userId,missing));assert.equal(absent.status,denied.status);assert.deepEqual(await absent.json(),await denied.json());
  }
  const chat={setId:target.id,cardId:card.id,sessionId:'lesson_shared',question:'tell me private context'};
  assert.equal((await CHAT(request('user_A',a.userId,chat,{'Idempotency-Key':'foreign-card-test-key'},'/api/ai/chat'))).status,404);
  await assert.rejects(store.saveChatPair(a.userId,target.id,card.id,'lesson_shared','Q','A'),/CARD_NOT_FOUND/);
  const own=(await store.loadAppData(a.userId)).sets[0];
  await assert.rejects(store.loadAiCardContext(a.userId,own.id,card.id,'lesson_shared'),/CARD_NOT_FOUND/);
  assert.equal((await store.loadAppData(b.userId)).sets[0].cards[0].question,'private question B');
});

test('review operation and recovery scopes remain per owner, including undo and chat histories', async () => {
  const a=await bootstrap('user_A'),b=await bootstrap('user_B');
  const sets=await Promise.all([store.loadAppData(a.userId),store.loadAppData(b.userId)]);
  let bReview;
  for(const [index,subject,owner] of [[0,'user_A',a],[1,'user_B',b]]) {
    const set=sets[index].sets[0],card=set.cards[0];
    const body={action:'reviewCard',cardId:card.id,sessionId:'shared-lesson',operationId:'shared-operation',expectedReviewCount:0,rating:'good',responseMs:50};
    const one=await POST(request(subject,owner.userId,body)),two=await POST(request(subject,owner.userId,body));
    assert.equal(one.status,200);const result=await one.json();assert.equal((await two.json()).reviewId,result.reviewId);
    if(index===1)bReview=result.reviewId;
    await store.saveChatPair(owner.userId,set.id,card.id,'shared-lesson',subject,`private ${subject}`);
    const recovery=await (await GET(request(subject,owner.userId,undefined,{},'/api/data?sessionId=shared-lesson'))).json();
    assert.equal(recovery.sessionReviews.length,1);assert.equal(recovery.sessionReviews[0].cardId,card.id);
    assert.equal(recovery.chatMessages.length,2);assert.ok(recovery.chatMessages.every(message=>message.content.includes(subject)));
  }
  const foreign=await POST(request('user_A',a.userId,{action:'undoReview',reviewId:bReview,sessionId:'shared-lesson'}));
  const absent=await POST(request('user_A',a.userId,{action:'undoReview',reviewId:'missing',sessionId:'shared-lesson'}));
  assert.equal(foreign.status,absent.status);assert.deepEqual(await foreign.json(),await absent.json());
  const bData=await store.loadAppData(b.userId);assert.equal(bData.sets[0].cards[0].reviewCount,1);
});

test('a corrupt source relationship cannot leak another owner source into workspace or AI context', async () => {
  const a=await bootstrap('user_A'),b=await bootstrap('user_B');
  const aSet=(await store.loadAppData(a.userId)).sets[0];
  const original=await db.prepare('SELECT source_id FROM card_sets WHERE id=?').bind(aSet.id).first();
  const foreign=await db.prepare('SELECT id FROM sources WHERE user_id=?').bind(b.userId).first();
  await db.prepare('UPDATE card_sets SET source_id=? WHERE id=?').bind(foreign.id,aSet.id).run();
  try {
    const data=await (await GET(request('user_A',a.userId))).json();assert.equal(data.sets[0].sourceContent,'');
    await assert.rejects(store.loadAiCardContext(a.userId,aSet.id,aSet.cards[0].id,'lesson'),/CARD_NOT_FOUND/);
  } finally {await db.prepare('UPDATE card_sets SET source_id=? WHERE id=?').bind(original.source_id,aSet.id).run();}
});
