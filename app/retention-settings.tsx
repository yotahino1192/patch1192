"use client";
import { useEffect, useState } from "react";
import { useAccount, useApiFetch } from "./account-context";
import { nativeRetention, publishRetention } from "../lib/retention-platform";
import type { RetentionSnapshot } from "../lib/retention";
export function RetentionSettings(){
 const api=useApiFetch(),account=useAccount();const [s,set]=useState<RetentionSnapshot|null>(null),[message,msg]=useState("");
 useEffect(()=>{let active=true;void api("/api/retention").then(async r=>{if(r.ok&&active)set(await r.json());}).catch(()=>{});return()=>{active=false;};},[api]);
 if(!s||!account)return null;
 const save=async()=>{try{
  if(nativeRetention()&&(s.reviewReminder||s.streakWarning)&&!(await nativeRetention()!.permission()).granted){msg("通知が許可されていません。iOSの設定から変更できます。");return;}
  const r=await api("/api/retention",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"preferences",reminderTime:s.reminderTime,reviewReminder:s.reviewReminder,streakWarning:s.streakWarning})});if(!r.ok)throw new Error();
  const updated=await r.json() as RetentionSnapshot;set(updated);await publishRetention(account.scope.account.userId,updated);window.dispatchEvent(new Event("patch-retention-refresh"));msg("保存しました。");
 }catch{msg("保存できませんでした。再試行してください。");}};
 return <section><h3>Notifications</h3><label><input type="checkbox" checked={s.reviewReminder} onChange={e=>set({...s,reviewReminder:e.target.checked})}/> Review reminder</label><input aria-label="復習通知の時刻" type="time" value={s.reminderTime} onChange={e=>set({...s,reminderTime:e.target.value})}/><label><input type="checkbox" checked={s.streakWarning} onChange={e=>set({...s,streakWarning:e.target.checked})}/> Streak warning（期限3時間前）</label><p>通知を有効にして保存すると、iOSで通知の許可を確認します。通知はこの端末で同期できた当日分のみです。</p><button onClick={()=>void save()}>通知設定を保存</button><p role="status">{message}</p></section>;
}
