import test from 'node:test';
import assert from 'node:assert/strict';
import { execution, ProviderError, inputUpperBound } from '../lib/ai/execution.ts';
import { answerQuestion, generateMaterial } from '../lib/openai.ts';
import { logEvent } from '../lib/safe-log.ts';
const response=()=>({status:'completed',usage:{input_tokens:120,output_tokens:300},output:[{content:[{type:'output_text',text:'answer'}]}]});
async function mocked(fn, fetcher) {const prev=globalThis.fetch,old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='isolated-mock';globalThis.fetch=fetcher;try {await fn();}finally {globalThis.fetch=prev;if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}}
test('OpenAI call requires admission, preserves model/output/timeout and records reasoning-inclusive usage',async()=>{
 await assert.rejects(answerQuestion({question:'Q',depth:'short'}), /AI_ADMISSION_REQUIRED/);
 let dispatched=false,calls=0;const ctx={endpoint:'chat',dispatch:async()=>{dispatched=true;}};
 await mocked(async()=>{assert.equal(await execution.run(ctx,()=>answerQuestion({question:'Q',depth:'short'})),'answer');assert.deepEqual(ctx.usage,{input:120,output:300});},async(url,init)=>{
 calls++;assert.equal(dispatched,true);assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.redirect,'error');assert.ok(init.signal instanceof AbortSignal);const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-5-nano');assert.equal(body.max_output_tokens,1800);return Response.json(response());});assert.equal(calls,1);
});
for(const [label,fetcher,uncertain] of [
 ['429',async()=>new Response('private provider body',{status:429}),false],
 ['500',async()=>new Response('private provider body',{status:500}),true],
 ['503',async()=>new Response('private provider body',{status:503}),true],
 ['timeout',async()=>{throw new DOMException('private endpoint','TimeoutError');},true],
 ['network',async()=>{throw new Error('private connection');},true],
 ['invalid json',async()=>new Response('private response'),true],
 ['incomplete',async()=>Response.json({...response(),status:'incomplete'}),false],
]) test(`provider ${label} has zero retries and sanitized outcome`,async()=>{
 let calls=0;await mocked(async()=>{await assert.rejects(execution.run({endpoint:'chat',dispatch:async()=>{}},()=>answerQuestion({question:'Q',depth:'short'})),e=>e instanceof ProviderError && e.uncertain===uncertain && !e.message.includes('private'));},async(...args)=>{calls++;return fetcher(...args);});assert.equal(calls,1);
});
test('aggregate input cap includes instructions, schema, multibyte text and history before dispatch',async()=>{
 for(const [endpoint,invoke] of [ ['cards',()=>generateMaterial({text:'日'.repeat(9000),detail:'normal',style:'qa'})], ['chat',()=>answerQuestion({question:'Q',depth:'short',history:[{role:'user',content:'日'.repeat(5000)}]})] ]) {
 await mocked(async()=>assert.rejects(execution.run({endpoint,dispatch:async()=>assert.fail('dispatch')},invoke),e=>e.code==='AI_INPUT_TOO_LARGE'),async()=>assert.fail('fetch'));
 }assert.ok(inputUpperBound({input:'日'})>3);
});
test('allowlisted logging never serializes tokens, secrets, body, content, email, raw IP or errors',()=>{
 const lines=[];logEvent('ai_complete',{endpoint:'chat',status:200,costMicros:45,token:'sensitive',secret:'sensitive',body:'sensitive',email:'a@private.tld',ip:'192.0.2.1',error:new Error('sensitive'),durationMs:'sensitive',inputTokens:Infinity},s=>lines.push(s));
 assert.deepEqual(JSON.parse(lines[0]),{event:'ai_complete',endpoint:'chat',status:200,costMicros:45});
 logEvent('sensitive',{endpoint:'sensitive'},s=>lines.push(s));assert.equal(lines[1],'{"event":"api_failed"}');
});
