"use client";
import {StartupSplash,useStartup} from '../startup-splash';
import {useEffect,useState,type ReactNode} from 'react';
export function AuthWaiting({render=(content)=>content}:{render?:(content:ReactNode)=>ReactNode}){
 const {starting}=useStartup();
 const [slow,setSlow]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[]);
 if(starting&&!slow)return <StartupSplash/>;
 return render(<div role="status"><p>{slow?'ログインの確認に時間がかかっています。接続を確認してください。':'ログインを確認しています…'}</p>{slow&&<button onClick={()=>{try{location.reload();}catch{setFailed(true);}}}>ログインを再確認</button>}{failed&&<p>再読み込みできませんでした。時間を置いて再試行してください。</p>}</div>);
}
