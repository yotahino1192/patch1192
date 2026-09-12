"use client";

import { RetentionSettings } from "./retention-settings";
import { useId, useState, useEffect, type RefObject } from "react";
import packageInfo from "../package.json" with { type: "json" };
import { getNativeAuth } from "../lib/auth-platform";
import { usePrivacy } from "./privacy-provider";
import { AccountDeletion } from "./account-deletion-dialog";
import { LegalLinks } from "./legal-content";
import { useAccount } from "./account-context";
import { useLanguage } from "./language";
import { AssetIcon } from "./asset-icon";

export function SettingsDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  const { t, language, setLanguage } = useLanguage();
  const account = useAccount();
  const [appVersion,setAppVersion]=useState(packageInfo.version);
  useEffect(()=>{let active=true;void getNativeAuth()?.appInfo?.().then(info=>{if(active)setAppVersion(`${info.version} (${info.build})`);}).catch(()=>{});return()=>{active=false;};},[]);
  const titleId = useId();
  const privacy=usePrivacy();const [deleting,setDeleting]=useState(false),[message,setMessage]=useState("");
  const change=async(state:"granted"|"revoked")=>{try{await privacy?.change(state);setMessage(state==="revoked"?"AI送信を停止しました。":"設定を確認しました。");}catch{setMessage("変更を同期できません。停止を選んだ場合、この端末では送信を止めています。再試行してください。");}};
  return <dialog ref={dialogRef} className="settings-dialog" aria-labelledby={titleId} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
  }}>
    <div className="settings-heading"><h2 id={titleId}>{t("設定")}</h2><button type="button" className="settings-close" aria-label={t("設定を閉じる")} onClick={() => dialogRef.current?.close()}><AssetIcon name="close" size={20} /></button></div>
    <p>Preferences</p><fieldset className="settings-language"><legend>{t("言語")}</legend>
      <button type="button" aria-pressed={language === "ja"} onClick={() => setLanguage("ja")}><span lang="ja"><span aria-hidden="true">🇯🇵</span> 日本語</span>{language === "ja" && <AssetIcon name="check" size={22} />}</button>
      <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}><span lang="en"><span aria-hidden="true">🇺🇸</span> English</span>{language === "en" && <AssetIcon name="check" size={22} />}</button>
    </fieldset>
    {account && <div className="settings-account"><h3>Account</h3><p>{account.email || "Email：認証情報を確認中"}</p><p>ログアウトすると、この端末の未保存の下書きは削除されます。</p><button onClick={() => void account.logout()}>ログアウト</button><button className="danger" onClick={()=>setDeleting(!deleting)}>Delete Account</button>{deleting&&<AccountDeletion close={()=>setDeleting(false)}/>}</div>}
    {privacy&&<section><h3>Privacy</h3><LegalLinks kinds={["privacy"]}/><p>AI Data Sharing</p><button onClick={()=>void change("granted")}>説明を確認して許可</button><button onClick={()=>void change("revoked")}>AI送信を停止</button><button onClick={()=>void privacy.refresh().then(c=>setMessage(`AI Data Sharing: ${c.state}`)).catch(()=>setMessage("確認できません。"))}>現在の状態を確認</button>{message&&<p role="status">{message}</p>}</section>}
    <RetentionSettings />
    <section><h3>About</h3><LegalLinks kinds={["support","terms"]}/><p>App Version: {appVersion}</p></section>
  </dialog>;
}
