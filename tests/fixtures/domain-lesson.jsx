import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createAccountScope} from '../../lib/account-scope';
import {AccountContext} from '../../app/account-context';
import {DomainLesson} from '../../features/my-lesson/domain-lesson';
import {apiFetch} from '../../lib/api-client';
import '../../app/globals.css';
const config=await (await fetch('/__lesson_identity')).json();
const fixture={scope:null, switchAccount:null, logout:null, fail:false, failComplete:false, lose:false, slow:false, posts:0, aborts:0};window.lessonFixture=fixture;
const transport=async(path,options)=>{
 options?.signal?.addEventListener('abort',()=>{fixture.aborts++;},{once:true});
 if(fixture.failComplete&&options?.body?.includes('completeLesson'))throw Error('complete unavailable');
 if(fixture.fail)throw Error('private upstream error');
 const result=await apiFetch(path,options);
 if(options?.method==='POST')fixture.posts++;
 if(fixture.lose&&options?.body?.includes('recordAttempt')){fixture.lose=false;throw Error('lost response');}
 if(fixture.slow)await new Promise(r=>setTimeout(r,500));
 return result;
};
function Preview(){
 const [account,setAccount]=useState('A'),[home,setHome]=useState(false);
 const [scope,setScope]=useState(null);
 useEffect(()=>{
  if(!account)return;
  const next=createAccountScope(config[account].identity,{getToken:async()=>config[account].token},transport);
  fixture.scope=next;
  Promise.resolve().then(()=>setScope(next));
  return()=>next.invalidate();
 },[account]);
 useEffect(()=>{fixture.switchAccount=value=>{fixture.scope?.invalidate();setScope(null);setAccount(value);};fixture.logout=()=>{fixture.scope?.invalidate();setScope(null);setAccount(null);};},[]);
 if(!scope||!scope.isCurrent())return <p>ログインしてください</p>;
 return <AccountContext.Provider value={{scope,logout:async()=>fixture.logout()}}>{home?<p>Test Home</p>:<DomainLesson lessonId={config.lessonId} onHome={()=>setHome(true)}/>}</AccountContext.Provider>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Preview/></React.StrictMode>);
