import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))return next(new URL(specifier+'.ts',context.parentURL).href,context);return next(specifier,context);}});
const {createAccountScope,loadAccount,StaleAccountError}=await import('../lib/account-scope.ts');
const {workspaceKey,readAccountWorkspace,writeAccountWorkspace,clearAccountWorkspace,logoutKey}=await import('../lib/account-storage.ts');
const {EMPTY_WORKSPACE}=await import('../lib/workspace.ts');
const a={userId:'10000000-0000-4000-8000-000000000001',subject:'user_A',sessionId:'sess_A'};
const b={userId:'20000000-0000-4000-8000-000000000002',subject:'user_B',sessionId:'sess_B'};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
const storage=()=>{const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k),entries};};

test('web requests carry account/session binding with same-origin cookies, native requests use refreshed Bearer only',async()=>{
  let count=0;
  for(const native of [false,true]) {
    const session=native?{getToken:async()=>`short-${++count}`} : {};
    const scope=createAccountScope(a,session,async(path,options)=>{
      assert.equal(path,'/api/data');assert.equal(options.headers.get('x-patch-account'),a.userId);assert.equal(options.headers.get('x-patch-session'),a.sessionId);
      assert.equal(options.credentials,native?'omit':'same-origin');assert.equal(options.cache,'no-store');
      assert.equal(options.headers.get('authorization'),native?`Bearer short-${count}`:null);
      return Response.json({ok:true});
    });
    await scope.request('/api/data');await scope.request('/api/data');
  }
  assert.equal(count,2);
});
test('switch/logout aborts pending requests and rejects old responses even if native HTTP ignores abort',async()=>{
  const gate=deferred();let signal;
  const scope=createAccountScope(a,{},async(_,options)=>{signal=options.signal;await gate.promise;return Response.json({private:'A'});});
  const result=scope.request('/api/data');scope.invalidate();assert.ok(signal.aborted);gate.resolve();
  await assert.rejects(result,StaleAccountError);await assert.rejects(scope.request('/api/data'),StaleAccountError);
  const next=createAccountScope(b,{},async()=>Response.json({private:'B'}));assert.deepEqual(await (await next.request('/api/data')).json(),{private:'B'});
});
test('switch during token refresh never sends the old action using the new account token',async()=>{
  const gate=deferred();let sent=0;
  const scope=createAccountScope(a,{getToken:()=>gate.promise},async()=>{sent++;return Response.json({});});
  const result=scope.request('/api/data',{method:'POST',body:'private A'});scope.invalidate();gate.resolve('token-B');
  await assert.rejects(result,StaleAccountError);assert.equal(sent,0);
});
test('switch after HTTP headers but before body parsing rejects stale data',async()=>{
  const scope=createAccountScope(a,{},async()=>Response.json({private:'A'}));
  const response=await scope.request('/api/data');scope.invalidate();await assert.rejects(response.json(),StaleAccountError);
});
test('401 locks the workspace, does not replay writes; review conflict 409 does not log out',async()=>{
  let unauthorized=0,sent=0;
  const scope=createAccountScope(a,{},async()=>{sent++;return Response.json({}, {status:401});},()=>unauthorized++);
  await scope.request('/api/data',{method:'POST',body:'review'});assert.equal(sent,1);assert.equal(unauthorized,1);
  await createAccountScope(a,{},async()=>Response.json({}, {status:409}),()=>unauthorized++).request('/api/data');assert.equal(unauthorized,1);
  await createAccountScope(a,{},async()=>Response.json({}, {status:409,headers:{'x-patch-auth-error':'ACCOUNT_CHANGED'}}),()=>unauthorized++).request('/api/data');assert.equal(unauthorized,2);
});
test('bootstrap after app reload reuses persisted SDK identity but still asks the server for the internal owner',async()=>{
  let calls=0,tokens=0;
  const provider={getToken:async()=>{tokens++;return 'fresh-token';}};
  const transport=async(path,options)=>{calls++;assert.equal(path,'/api/auth/session');assert.equal(options.headers.get('x-patch-session'),a.sessionId);assert.equal(options.headers.get('x-patch-account'),null);return Response.json(a);};
  const first=await loadAccount(a,provider,transport),afterReload=await loadAccount({...a},provider,transport);
  assert.deepEqual(first,afterReload);assert.equal(calls,2);assert.equal(tokens,2);
  await assert.rejects(loadAccount(a,provider,async()=>Response.json(b)),StaleAccountError);
});
test('account drafts survive reload; legacy or mismatched envelope never hydrate; logout clears only departing workspace',()=>{
  const disk=storage();const draft={...EMPTY_WORKSPACE,importDraft:{...EMPTY_WORKSPACE.importDraft,text:'private A'}};
  disk.setItem('loop-workspace-v1',JSON.stringify(draft));assert.deepEqual(readAccountWorkspace(disk,a.userId),EMPTY_WORKSPACE);
  writeAccountWorkspace(disk,a.userId,draft);assert.equal(readAccountWorkspace(disk,a.userId).importDraft.text,'private A');
  assert.equal(readAccountWorkspace(disk,b.userId).importDraft.text,'');
  disk.setItem(workspaceKey(b.userId),disk.getItem(workspaceKey(a.userId)));assert.deepEqual(readAccountWorkspace(disk,b.userId),EMPTY_WORKSPACE);
  writeAccountWorkspace(disk,b.userId,{...draft,importDraft:{...draft.importDraft,text:'private B'}});
  disk.setItem(logoutKey(a.sessionId),'pending');clearAccountWorkspace(disk,a.userId);
  assert.equal(readAccountWorkspace(disk,a.userId).importDraft.text,'');assert.equal(readAccountWorkspace(disk,b.userId).importDraft.text,'private B');
  assert.equal(disk.getItem(logoutKey(a.sessionId)),'pending');assert.ok(disk.getItem('loop-workspace-v1'));
  assert.throws(()=>workspaceKey('loop-owner'));
  assert.ok(!JSON.stringify([...disk.entries]).includes('fresh-token'));
});
