import test from 'node:test';
import assert from 'node:assert/strict';
import { createResultFence } from '../lib/result-fence.ts';
import { PendingDeepLinks } from '../lib/pending-deep-links.ts';
test('AI result invalidation remains effective after revoke/regrant and before body consumption',()=>{
 const fence=createResultFence(),pending=fence.capture();pending();fence.invalidate();assert.throws(pending,/AI_RESULT_INVALIDATED/);
 const newlyAllowed=fence.capture();newlyAllowed();assert.throws(pending,/AI_RESULT_INVALIDATED/);fence.invalidate();assert.throws(newlyAllowed,/AI_RESULT_INVALIDATED/);
});
test('Deep Link survives API outage with bounded backoff and is consumed only after success',()=>{
 const inbox=new PendingDeepLinks('A'),link={url:'patch://continue',at:1000,owner:'A'};
 inbox.enqueue([link,link],1000);assert.equal(inbox.next(1000),link);inbox.retry(1000);assert.equal(inbox.next(1999),undefined);assert.equal(inbox.next(2000),link);
 inbox.retry(2000);assert.equal(inbox.next(3999),undefined);assert.equal(inbox.next(4000),link);inbox.complete(link);assert.equal(inbox.next(4000),undefined);
});
test('pre-login links remain scoped, expiry and account switch cannot deliver another account resource',()=>{
 const inbox=new PendingDeepLinks('B');inbox.enqueue([{url:'patch://set/foreign',owner:'A',at:1000},{url:'https://example.com',at:1000},{url:'patch://continue',at:1000}],1100);
 assert.equal(inbox.next(1100).url,'patch://continue');assert.equal(inbox.next(301000),undefined);
 const other=new PendingDeepLinks('A');assert.equal(other.next(1100),undefined);
});

test('Deep Link retries honor transient failures and Retry-After, never access failures', async()=>{
 const {ReliabilityError}=await import('../lib/reliability/errors.ts');
 const inbox=new PendingDeepLinks('A'),link={url:'patch://continue',at:1000,owner:'A'};
 inbox.enqueue([link],1000);inbox.handleFailure(new ReliabilityError('rate_limit',429,undefined,undefined,15000),1000);
 assert.equal(inbox.next(15999),undefined);assert.equal(inbox.next(16000),link);
 inbox.handleFailure(new ReliabilityError('offline'),16000);assert.equal(inbox.next(16001),undefined);assert.equal(inbox.next(18000),link);
 for(const kind of ['unauthorized','forbidden','not_found','conflict','cancelled','unknown']){
  inbox.enqueue([link],18000);inbox.handleFailure(new ReliabilityError(kind),18000);assert.equal(inbox.next(50000),undefined);
 }
});
