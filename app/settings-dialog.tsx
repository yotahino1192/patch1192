"use client";

import { useId, type RefObject } from "react";
import { useLanguage } from "./language";
import { AssetIcon } from "./asset-icon";

export function SettingsDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  const { t, language, setLanguage } = useLanguage();
  const titleId = useId();
  return <dialog ref={dialogRef} className="settings-dialog" aria-labelledby={titleId} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
  }}>
    <div className="settings-heading"><h2 id={titleId}>{t("設定")}</h2><button type="button" className="settings-close" aria-label={t("設定を閉じる")} onClick={() => dialogRef.current?.close()}><AssetIcon name="close" size={20} /></button></div>
    <fieldset className="settings-language"><legend>{t("言語")}</legend>
      <button type="button" aria-pressed={language === "ja"} onClick={() => setLanguage("ja")}><span lang="ja"><span aria-hidden="true">🇯🇵</span> 日本語</span>{language === "ja" && <AssetIcon name="check" size={22} />}</button>
      <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}><span lang="en"><span aria-hidden="true">🇺🇸</span> English</span>{language === "en" && <AssetIcon name="check" size={22} />}</button>
    </fieldset>
  </dialog>;
}
