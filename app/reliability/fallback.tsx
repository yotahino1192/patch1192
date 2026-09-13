"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Fatal recovery must work without the Next router, including Capacitor. */
import {useRef,useState} from 'react';
export function Recovery({retry,home,reload}:{retry?:()=>void|Promise<void>;home?:()=>void;reload?:()=>void}) {
 const lock=useRef(false);const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const run=async(action:()=>void|Promise<void>,reload=false)=>{if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
  try{await action();if(reload)setMessage('再読み込みが完了しない場合は、接続を確認してもう一度お試しください。');}
  catch{setMessage('復旧できませんでした。接続を確認してください。保存領域は消去していません。');}
  finally{lock.current=false;setBusy(false);}
 };
 return <section role="alert" aria-labelledby="recovery-title" style={{maxWidth:640,margin:'40px auto',padding:24,lineHeight:1.8}}>
 <h1 id="recovery-title">Patchを表示できませんでした</h1><p>保存済みの内容は消去していません。未保存の内容がある場合は、まず再試行してください。</p>
 {retry&&<button disabled={busy} onClick={()=>void run(retry)}>再試行</button>}{' '}
 <button disabled={busy} onClick={()=>void run(reload||(()=>window.location.reload()),true)}>再読み込み</button>{' '}
 <button disabled={busy} onClick={()=>void run(()=>{if(home)home();else window.location.assign('/');},true)}>ホームへ戻る</button>
 {message&&<p role="status">{message}</p>}<p>再読み込みすると、保存できていない変更は失われる場合があります。通信が戻っても操作は自動再送しません。</p>
 </section>;
}
