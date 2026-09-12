"use client";
import {createContext,useContext,useState,useRef,useEffect,useCallback,type ReactNode} from "react";
import {useAccount} from "./account-context";
import {useLanguage} from "./language";
import type {ApiTransport} from "../lib/api-client";
import {AI_DISCLOSURE,CONSENT_VERSION,POLICY_VERSION,type Consent} from "../lib/privacy-policy";
import {privacyStopKey} from "../lib/account-cleanup";
import {LegalContent} from "./legal-content";
type Privacy={request:ApiTransport;refresh:()=>Promise<Consent>;change:(state:"granted"|"revoked")=>Promise<void>};
export const PrivacyContext=createContext<Privacy|null>(null);
export const usePrivacy=()=>useContext(PrivacyContext);
export function PrivacyProvider({children}:{children:ReactNode}) {
 const {scope}=useAccount()!;
 const {language}=useLanguage();
 const [prompt,setPrompt]=useState<Consent|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[legal,setLegal]=useState(false);
 const dialog=useRef<HTMLDialogElement|null>(null);
 useEffect(()=>{if(prompt&&!dialog.current?.open)dialog.current?.showModal();},[prompt]);
 const pending=useRef<((allowed:boolean)=>void)|null>(null);
 useEffect(()=>()=>{pending.current?.(false);pending.current=null;},[]);
 const refresh=useCallback(async()=>{
  const res=await scope.request(`/api/privacy/consents?language=${language}`);if(!res.ok)throw Error("プライバシー設定を確認できません。");
  return (await res.json() as {consent:Consent}).consent;
 },[scope,language]);
 const save=useCallback(async(c:Consent,state:"granted"|"revoked"|"denied")=>{
  const res=await scope.request("/api/privacy/consents",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({state,revision:c.revision,operationId:crypto.randomUUID(),consentVersion:CONSENT_VERSION,policyVersion:POLICY_VERSION,textHash:c.textHash,language})});
  if(!res.ok)throw Error("設定が変更されたか、保存できませんでした。閉じて再試行してください。");
  scope.assertCurrent();
  const stored=(await res.json() as {consent:Consent}).consent;
  if(stored.state!==state)throw Error("設定が更新されています。もう一度確認してください。");
  if(state==="granted" || state==="revoked")localStorage.removeItem(privacyStopKey(scope.account.userId));
 },[scope,language]);
 const ask=useCallback(async(c:Consent)=>{
  if(pending.current)throw Error("同意の確認中です。");
  setError("");setLegal(false);setPrompt(c);
  return new Promise<boolean>(resolve=>{pending.current=resolve;});
 },[]);
 const finish=async(state:"granted"|"denied")=>{
  if(!prompt||busy)return;setBusy(true);setError("");
  try{await save(prompt,state);pending.current?.(state==="granted");pending.current=null;setPrompt(null);}
  catch(e){setError(e instanceof Error?e.message:"保存できません。");}finally{setBusy(false);}
 };
 const close=()=>{if(busy)return;pending.current?.(false);pending.current=null;setPrompt(null);};
 const request:ApiTransport=useCallback(async(path,options={})=>{
  if(!["/api/ai/cards","/api/ai/chat"].includes(path))return scope.request(path,options);
  const body=JSON.parse(String(options.body||"{}"));
  let consent=await refresh();scope.assertCurrent();
  const stopped=localStorage.getItem(privacyStopKey(scope.account.userId));
  if(stopped){await save(consent,"revoked");consent=await refresh();}
  if(stopped || consent.state!=="granted"||consent.consentVersion!==CONSENT_VERSION){
   // Never open an unsolicited dialog or send when automatic lesson summarization runs.
   if(body.mode==="lesson_summary" || !await ask(consent))throw Error("AIへの送信は許可されていません。保存済みカードで学習を続けられます。");
  }
  scope.assertCurrent();
  return scope.request(path,{...options,body:JSON.stringify({...body,operationId:body.operationId||crypto.randomUUID()})});
 },[scope,refresh,save,ask]);
 const change=useCallback(async(state:"granted"|"revoked")=>{
  if(state==="revoked")localStorage.setItem(privacyStopKey(scope.account.userId),"pending");
  const c=await refresh();
  if(state==="granted"){await ask(c);return;}
  await save(c,"revoked");
 },[scope,refresh,save,ask]);
 return <PrivacyContext.Provider value={{request,refresh,change}}>{children}{prompt&&<dialog ref={dialog} className="privacy-backdrop" onCancel={e=>{e.preventDefault();close();}}><section className="privacy-sheet" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title"><h2 id="ai-consent-title">{language==="en"?"AI data sharing":"AI機能へのデータ送信"}</h2><p>{AI_DISCLOSURE[language]}</p><button type="button" onClick={()=>setLegal(!legal)}>Privacy Policy</button>{legal&&<LegalContent kind="privacy"/>}{error&&<p role="alert">{error}</p>}<div className="privacy-actions"><button autoFocus disabled={busy} onClick={()=>void finish("denied")}>{language==="en"?"Not now":"今は許可しない"}</button><button className="primary" disabled={busy} onClick={()=>void finish("granted")}>{language==="en"?"Agree and continue":"同意して続ける"}</button><button disabled={busy} onClick={close}>{language==="en"?"Close":"閉じる"}</button></div></section></dialog>}</PrivacyContext.Provider>;
}
