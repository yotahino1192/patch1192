import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthBoundary} from '../../app/auth-provider';
import {ReliabilityBoundary,ReliabilityRuntime} from '../../app/reliability/boundary';
import {Recovery} from '../../app/reliability/fallback';
import {useAccount,useApiFetch} from '../../app/account-context';
import {useWorkspace} from '../../app/use-workspace';
import {configureNativeAuth} from '../../lib/auth-platform';
import {configureApi} from '../../lib/api-client';
import {readApiResponse} from '../../lib/reliability/errors';
import {singleFlight} from '../../lib/reliability/network';
if(location.search.includes('offline=1'))Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
const identity={subject:'user_A',sessionId:'sess_A',userId:'10000000-0000-4000-8000-000000000001'};
window.fixture={down:true,clerkFail:false,status:200,calls:0,slow:false,crash:false,failRetry:true};
configureNativeAuth({initialize:async()=>{if(fixture.clerkFail)throw Error('raw secret');return identity;},getSession:async()=>identity,getToken:async()=>'fixture',subscribe:()=>()=>{},signOut:async()=>{},startEmail:async()=>{},verifyEmail:async()=>identity});
configureApi('https://fixture.invalid',async(url)=>{fixture.calls++;if(fixture.down)throw Error('secret@example.com');if(fixture.slow)await new Promise(r=>setTimeout(r,200));if(url.endsWith('/api/auth/session'))return Response.json(identity);return Response.json(fixture.status===200?{text:'saved card'}:{code:fixture.status===429?'AI_QUOTA':'SERVICE_UNAVAILABLE',error:'raw secret'},{status:fixture.status});});
function Study(){const api=useApiFetch(),account=useAccount(),{workspace,setWorkspace,workspaceReady,saveError}=useWorkspace();const [text,setText]=useState(''),[error,setError]=useState(''),[crash,setCrash]=useState(false);
 const load=useRef(singleFlight(async()=>{try{setText((await readApiResponse(await api('/api/data'))).text);setError('');}catch(e){setError(e.message);}}));
 if(crash)throw Error('fixture controlled render failure');
 return <section data-private={account.scope.account.userId}><p>{workspaceReady?'workspace ready':'loading'}</p><p id="card">{text}</p><p id="draft">{workspace.importDraft.text}</p>{saveError&&<p id="storage-error">保存を確認してください</p>}<p role="alert" id="error">{error}</p><button id="load" onClick={()=>void load.current()}>読み込む</button><button id="edit" onClick={()=>setWorkspace(w=>({...w,importDraft:{...w.importDraft,text:'unsaved study'}}))}>学習途中を保存</button><button id="crash" onClick={()=>setCrash(true)}>render failure</button></section>;
}
function App(){const [failed,setFailed]=useState(false);return <><ReliabilityRuntime/>{failed?<Recovery reload={()=>{throw Error('failed navigation');}} retry={async()=>{if(fixture.failRetry)throw Error('raw secret');setFailed(false);}}/>:<><button id="failed-recovery" onClick={()=>setFailed(true)}>failed retry test</button><ReliabilityBoundary><AuthBoundary><Study/></AuthBoundary></ReliabilityBoundary></>}</>;}
createRoot(document.getElementById('root'),{onCaughtError:()=>{}}).render(<App/>);
