// Browser-only test adapter. This file is never an application entry or API bypass.
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthBoundary } from '../../app/auth-provider';
import { usePrivacy } from '../../app/privacy-provider';
import { AccountDeletion } from '../../app/account-deletion-dialog';
import { CONSENT_VERSION, POLICY_VERSION, AI_DISCLOSURE } from '../../lib/privacy-policy';
import { useAccount, useApiFetch } from '../../app/account-context';
import { useWorkspace } from '../../app/use-workspace';
import { configureNativeAuth } from '../../lib/auth-platform';
import { configureApi } from '../../lib/api-client';
const accounts = {
 A: {subject:'user_A',sessionId:'sess_A',userId:'10000000-0000-4000-8000-000000000001'},
 B: {subject:'user_B',sessionId:'sess_B',userId:'20000000-0000-4000-8000-000000000002'},
};
const listeners=new Set();let held=[];let releaseInit;
let active=localStorage.getItem('fixture-provider-session')||null;
const consents={};let receipt="";
window.fixture={accounts,hold:false,failLogout:false,calls:[],
 change(next){active=next;if(next)localStorage.setItem('fixture-provider-session',next);else localStorage.removeItem('fixture-provider-session');for(const listener of listeners)listener(accounts[next]||null);},
 release(){for(const fn of held)fn();held=[];},ready(){releaseInit(accounts[active]||null);},
};
const initialized=new Promise(resolve=>releaseInit=resolve);
configureNativeAuth({
 initialize:()=>initialized,
 getSession:async()=>accounts[active]||null,
 getToken:async id=>active&&accounts[active].sessionId===id?'fixture-token-'+id:null,
 subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
 startEmail:async()=>{},verifyEmail:async()=>null,
 reauthenticate:async(_id,code)=>{window.fixture.reauthed=code==='123456';},
 signOut:async (id,deleting)=>{window.fixture.deletedLogout=deleting;if(window.fixture.failLogout)throw Error('Offline');if(accounts[active]?.sessionId===id)window.fixture.change(null);},
});
configureApi(location.origin,async(url,options)=>{
 const path=new URL(url).pathname;
 const owner=accounts[active];const headers=new Headers(options.headers);
 window.fixture.calls.push({path,session:headers.get('x-patch-session')});
 if(path==='/api/account/deletion'&&options.method!=='POST')return Response.json({}, {status:headers.get('X-Deletion-Receipt')===receipt?200:404});
 if(!owner||headers.get('authorization')!=='Bearer fixture-token-'+owner.sessionId||headers.get('x-patch-session')!==owner.sessionId)return Response.json({}, {status:401});
 if(path==='/api/auth/session')return Response.json(owner);
 if(headers.get('x-patch-account')!==owner.userId)return Response.json({}, {status:409});
 if(window.fixture.remoteDeleted)return Response.json({code:'ACCOUNT_DELETED'},{status:403,headers:{'X-Patch-Auth-Error':'ACCOUNT_DELETED'}});
 if(path==='/api/privacy/consents') {
  const textHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(AI_DISCLOSURE.ja))),b=>b.toString(16).padStart(2,'0')).join('');
  if(options.method==='PUT'){const b=JSON.parse(options.body);consents[owner.userId]={...b,revision:b.revision+1};}
  return Response.json({consent:consents[owner.userId]||{state:'unset',revision:0,textHash,consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,language:'ja'}});
 }
 if(path==='/api/account/deletion') {
  const b=JSON.parse(options.body);
  if(b.action==='challenge')return Response.json({challengeId:'challenge-test'});
  if(!window.fixture.reauthed)return Response.json({code:'REAUTH_REQUIRED'},{status:403});
  receipt=b.receipt;if(window.fixture.loseDeletionResponse)throw Error('Lost response');return Response.json({state:'pending'},{status:202});
 }
 if(window.fixture.hold)await new Promise(resolve=>held.push(resolve));
 return Response.json({value:owner.subject});
});
function PrivateWorkspace(){
 const api=useApiFetch(),privacy=usePrivacy();const [deleting,setDeleting]=useState(false);
 const {scope,logout}=useAccount();const {workspace,workspaceReady,setWorkspace}=useWorkspace();const [result,setResult]=useState('');
 return <section data-private={scope.account.subject}><p>{workspaceReady?'workspace ready':'workspace loading'}</p><output id="draft">{workspace.importDraft.text}</output><output id="result">{result}</output>
 <button id="edit" onClick={()=>setWorkspace(w=>({...w,importDraft:{...w.importDraft,text:'draft '+scope.account.subject}}))}>edit</button>
 <button id="request" onClick={async()=>{try{const response=await scope.request('/api/data');const data=await response.json();setResult(data.value);setWorkspace(w=>({...w,importDraft:{...w.importDraft,text:data.value}}));}catch{ /* Expected stale responses are ignored. */ }}}>request</button>
 <button id="generate" onClick={()=>api('/api/ai/cards',{method:'POST',body:JSON.stringify({text:'test'})}).then(()=>setResult('AI complete')).catch(()=>setResult('AI blocked'))}>generate</button>
 <button id="summary" onClick={()=>api('/api/ai/cards',{method:'POST',body:JSON.stringify({mode:'lesson_summary'})}).catch(()=>setResult('summary blocked'))}>summary</button>
 <button id="revoke" onClick={()=>privacy.change('revoked')}>revoke</button>
 <button id="delete" onClick={()=>setDeleting(true)}>delete</button>{deleting&&<AccountDeletion close={()=>setDeleting(false)}/>}
 <button id="logout" onClick={()=>void logout()}>logout</button></section>;
}
createRoot(document.getElementById('root')).render(<StrictMode><AuthBoundary><PrivateWorkspace/></AuthBoundary></StrictMode>);
