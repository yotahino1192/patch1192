"use client";
import {useEffect,useState} from 'react';
export function AuthWaiting(){
 const [slow,setSlow]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[]);
 return <div role="status"><p>{slow?'ログインの確認に時間がかかっています。接続を確認してください。':'ログインを確認しています…'}</p>{slow&&<button onClick={()=>{try{location.reload();}catch{setFailed(true);}}}>ログインを再確認</button>}{failed&&<p>再読み込みできませんでした。時間を置いて再試行してください。</p>}</div>;
}
