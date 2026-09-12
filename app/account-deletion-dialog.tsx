"use client";
import {useState} from "react";
import {useAccount} from "./account-context";
import {apiFetch} from "../lib/api-client";
export function AccountDeletion({close}:{close:()=>void}) {
 const account=useAccount()!;
 const [stage,setStage]=useState<"explain"|"code"|"confirm"|"accepted">("explain"),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [challenge,setChallenge]=useState("");
 const [operationId]=useState(()=>crypto.randomUUID());
 const [receipt]=useState(()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join(""));
 const call=async(body:unknown)=>{
  const res=await account.scope.request("/api/account/deletion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!res.ok){const data=await res.json() as {code?:string};throw Error(data.code==="REAUTH_REQUIRED"?"再認証を確認できません。Clerkの再認証設定を確認し、最初からやり直してください。":"削除を受け付けられませんでした。");}return res.json() as Promise<{challengeId:string}>;
 };
 const run=async()=>{
  setBusy(true);setError("");
  try{
   if(stage==="explain"){
    if(!account.reauthenticate)throw Error("この端末の再認証は未対応です。");
    const c=await call({action:"challenge"});setChallenge(c.challengeId);await account.reauthenticate();account.scope.assertCurrent();setStage("code");
   }else if(stage==="code"){
    await account.reauthenticate!(code);account.scope.assertCurrent();setCode("");setStage("confirm");
   }else if(stage==="confirm"){
    // Keep a status-only receipt before sending, so an ambiguous response can be checked.
    sessionStorage.setItem(`patch:deletion-receipt:${account.scope.account.userId}`,receipt);
    sessionStorage.setItem("patch:deletion-status",receipt);
    try{await call({action:"delete",challengeId:challenge,operationId,receipt});}
    catch(e){const status=await apiFetch("/api/account/deletion",{headers:{"X-Deletion-Receipt":receipt},credentials:"omit",cache:"no-store"});if(!status.ok)throw e;}
    account.scope.assertCurrent();sessionStorage.setItem("patch:deletion-status",receipt);setStage("accepted");
    // logout invalidates the UI synchronously and clears scoped state. Worker completion is independent.
    await account.logout(true);
   }
  }catch(e){setError(e instanceof Error?e.message:"削除処理を確認できません。受付済みの削除はサーバーで継続します。");}finally{setBusy(false);}
 };
 return <section className="account-deletion" aria-labelledby="delete-title"><h3 id="delete-title">アカウントを削除</h3><p>教材・カード・学習履歴・AI会話・プロフィールと、この端末の下書きを削除します。受付後は取り消せません。他端末も次回接続時に利用できなくなります。</p><p>送信済みAIデータやオフライン端末は即時消去できない場合があります。バックアップ等の保持期間は公開準備中です。</p>{stage==="code"&&<label>メールの確認コード<input autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></label>}{stage==="confirm"&&<p>本人確認を行いました。このアカウントの削除を確定しますか？</p>}{error&&<p role="alert">{error}</p>}<button className="danger" disabled={busy||stage==="accepted"} onClick={()=>void run()}>{busy?"処理中…":stage==="explain"?"本人確認コードを送る":stage==="code"?"確認する":stage==="accepted"?"削除受付済み":"アカウントを削除する"}</button><button disabled={busy} onClick={close}>閉じる</button></section>;
}
