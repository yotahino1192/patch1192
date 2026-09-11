// Browser-only test adapter. This file is never an application entry or API bypass.
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthBoundary } from '../../app/auth-provider';
import { useAccount } from '../../app/account-context';
import { useWorkspace } from '../../app/use-workspace';
import { configureNativeAuth } from '../../lib/auth-platform';
import { configureApi } from '../../lib/api-client';
const accounts = {
 A: {subject:'user_A',sessionId:'sess_A',userId:'10000000-0000-4000-8000-000000000001'},
 B: {subject:'user_B',sessionId:'sess_B',userId:'20000000-0000-4000-8000-000000000002'},
};
const listeners=new Set();let held=[];let releaseInit;
let active=localStorage.getItem('fixture-provider-session')||null;
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
 signOut:async id=>{if(window.fixture.failLogout)throw Error('Offline');if(accounts[active]?.sessionId===id)window.fixture.change(null);},
});
configureApi(location.origin,async(url,options)=>{
 const path=new URL(url).pathname;
 const owner=accounts[active];const headers=new Headers(options.headers);
 window.fixture.calls.push({path,session:headers.get('x-patch-session')});
 if(!owner||headers.get('authorization')!=='Bearer fixture-token-'+owner.sessionId||headers.get('x-patch-session')!==owner.sessionId)return Response.json({}, {status:401});
 if(path==='/api/auth/session')return Response.json(owner);
 if(headers.get('x-patch-account')!==owner.userId)return Response.json({}, {status:409});
 if(window.fixture.hold)await new Promise(resolve=>held.push(resolve));
 return Response.json({value:owner.subject});
});
function PrivateWorkspace(){
 const {scope,logout}=useAccount();const {workspace,workspaceReady,setWorkspace}=useWorkspace();const [result,setResult]=useState('');
 return <section data-private={scope.account.subject}><p>{workspaceReady?'workspace ready':'workspace loading'}</p><output id="draft">{workspace.importDraft.text}</output><output id="result">{result}</output>
 <button id="edit" onClick={()=>setWorkspace(w=>({...w,importDraft:{...w.importDraft,text:'draft '+scope.account.subject}}))}>edit</button>
 <button id="request" onClick={async()=>{try{const response=await scope.request('/api/data');const data=await response.json();setResult(data.value);setWorkspace(w=>({...w,importDraft:{...w.importDraft,text:data.value}}));}catch{ /* Expected stale responses are ignored. */ }}}>request</button>
 <button id="logout" onClick={()=>void logout()}>logout</button></section>;
}
createRoot(document.getElementById('root')).render(<StrictMode><AuthBoundary><PrivateWorkspace/></AuthBoundary></StrictMode>);
