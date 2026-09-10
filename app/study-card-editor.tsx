"use client";

import { useState } from "react";
import type { StudyEdit } from "../lib/workspace";
import type { CardFormat, AppData } from "../lib/types";
import { useLanguage } from "./language";

export function StudyCardEditor({ draft, format, onChange, onSaved, onCancel, onPause }: {
  draft: StudyEdit; format: CardFormat; onChange: (value: StudyEdit) => void;
  onSaved: (data: AppData) => void; onCancel: () => void; onPause: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="page study-edit-page">
    <div className="set-view-toolbar"><h1>{t("このカードを修正")}</h1><button type="button" className="secondary" disabled={busy} onClick={onPause}>{t("中断する")}</button></div>
    <form className="study-card-editor panel" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "editCard", cardId: draft.cardId, question: draft.question, answer: draft.answer, choices: draft.choices }) });
        const result = await response.json() as { data: AppData; error?: string };
        if (!response.ok) throw new Error(result.error || "保存できませんでした。");
        onSaved(result.data);
      } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); }
      finally { setBusy(false); }
    }}>
      <label>{t("質問")}<textarea required maxLength={5000} value={draft.question} disabled={busy} onChange={(e) => onChange({ ...draft, question: e.target.value })} /></label>
      <label>{t("答え")}<textarea required maxLength={10000} value={draft.answer} disabled={busy} onChange={(e) => onChange({ ...draft, answer: e.target.value })} /></label>
      {format === "multiple_choice" && draft.choices.map((choice, index) => <label key={index}>{t("選択肢")}{index + 1}<input required disabled={busy} value={choice} onChange={(e) => onChange({ ...draft, choices: draft.choices.map((value, i) => i === index ? e.target.value : value) })} /></label>)}
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
      <div className="manager-actions"><button className="primary" disabled={busy || !draft.question.trim() || !draft.answer.trim()}>{t(busy ? "保存中…" : "保存して学習に戻る")}</button><button className="secondary" type="button" disabled={busy} onClick={onCancel}>{t("キャンセル")}</button></div>
    </form>
  </div>;
}
