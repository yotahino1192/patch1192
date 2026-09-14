import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/.test(s)){const url=new URL(s+'.ts',c.parentURL);if(existsSync(url))return next(url.href,c);}return next(s,c);}});
const {createLessonCheckpoint,parseLessonCheckpoint,lessonCheckpointKey}=await import('../features/my-lesson/checkpoint.ts');
const {cleanupAccount}=await import('../lib/account-cleanup.ts');
const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function memory(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
test('checkpoint preserves pending operation during draft/timer writes and remains account/lesson isolated',()=>{
 const storage=memory(),one=createLessonCheckpoint(storage,a,()=>{}),two=createLessonCheckpoint(storage,b,()=>{});
 const pending={lessonId:'lesson',activityId:'activity',operationId:'operation',response:'answer',result:'CORRECT',durationMs:0};
 one.write('lesson',{pending});one.write('lesson',{elapsedSeconds:123,activityId:'activity',revision:'rev',draft:{status:'ANSWERING',response:'draft',revealed:true,assessment:'CORRECT'}});
 assert.deepEqual(one.read('lesson').pending,pending);assert.equal(one.read('other'),null);assert.equal(two.read('lesson'),null);
 one.write('lesson',{pending:null});assert.equal(one.read('lesson').draft.response,'draft');
 assert.equal(parseLessonCheckpoint(storage.getItem(lessonCheckpointKey(a)),b),null);
});
test('checkpoint rejects corrupt, oversized or foreign pending state without creating progress',()=>{
 for(const checkpoint of [{lessonId:'lesson',elapsedSeconds:-1},{lessonId:'lesson',draft:{status:'COMPLETED'}},{lessonId:'lesson',pending:{lessonId:'foreign'}},{lessonId:'lesson',activityId:'activity',revision:'r',draft:{status:'ANSWERING',revealed:true,response:'a'.repeat(12001)}}])assert.equal(parseLessonCheckpoint(JSON.stringify({version:1,userId:a,checkpoint}),a),null);
 assert.equal(parseLessonCheckpoint('{',a),null);
});
test('invalidated account cannot read/write/clear a checkpoint; logout clears only its scoped draft',async()=>{
 const storage=memory();let active=true;const one=createLessonCheckpoint(storage,a,()=>{if(!active)throw Error('stale');}),two=createLessonCheckpoint(storage,b,()=>{});
 one.write('lesson',{elapsedSeconds:8});two.write('lesson',{elapsedSeconds:20});active=false;
 assert.throws(()=>one.write('lesson',{elapsedSeconds:90}),/stale/);assert.throws(()=>one.read('lesson'),/stale/);assert.throws(()=>one.clear('lesson'),/stale/);
 const original=globalThis.localStorage;globalThis.localStorage=storage;
 try{await cleanupAccount(storage,a);assert.equal(storage.getItem(lessonCheckpointKey(a)),null);assert.equal(two.read('lesson').elapsedSeconds,20);}finally{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;}
});
