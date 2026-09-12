"use client";
import {useEffect,useState} from "react";
import {apiFetch} from "../lib/api-client";
export function DeletionStatus(){
 const [receipt,setReceipt]=useState(""),[message,setMessage]=useState("削除操作の受付状況を確認できます。受付済みの処理はアプリを閉じても継続します。");
 useEffect(()=>{const value=sessionStorage.getItem("patch:deletion-status");if(value)queueMicrotask(()=>setReceipt(value));},[]);
 if(!receipt)return null;
 const check=async()=>{try{const r=await apiFetch("/api/account/deletion",{headers:{"X-Deletion-Receipt":receipt},credentials:"omit",cache:"no-store"});if(!r.ok)throw Error();const data=await r.json() as {state:string};setMessage(data.state==="completed"?"サーバー上のアカウント削除が完了しました。バックアップ・送信先の扱いはPrivacy Policyをご確認ください。":"削除処理中です。失敗した手順はサーバーで再試行します。");}catch{setMessage("現在の状態を確認できません。後でもう一度確認してください。");}};
 return <section><p role="status">{message}</p><button onClick={()=>void check()}>削除の進行状況を確認</button><button onClick={()=>{sessionStorage.removeItem("patch:deletion-status");setReceipt("");}}>受付表示を閉じる</button></section>;
}
