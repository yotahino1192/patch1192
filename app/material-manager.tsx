"use client";

import { apiFetch } from "../lib/api-client";

import { useLanguage } from "./language";

import { useState } from "react";
import type { AppData, Card, CardSet } from "../lib/types";

export function MaterialManager({ set, onData }: { set: CardSet; onData: (data: AppData) => void }) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [title, setTitle] = useState(set.title);
  const [editing, setEditing] = useState<Card | null>(null);
  const [tab, setTab] = useState("学習中");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deletedId, setDeletedId] = useState<{ id: string; archived: boolean } | null>(null);
  const run = async (body: Record<string, unknown>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { data: AppData; error?: string };
      if (!response.ok) throw new Error(result.error || "保存できませんでした。");
      onData(result.data);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); return false; }
    finally { setBusy(false); }
  };
  const visible = set.cards.filter((c) => tab === "削除済み" ? c.status === "削除済み" : tab === "アーカイブ" ? c.status === "アーカイブ" : !["削除済み", "アーカイブ"].includes(c.status));
  return <section className="panel material-manager">
    <h2>{t("教材を管理")}</h2>
    <form className="rename-form" onSubmit={async (e) => { e.preventDefault(); await run({ action: "renameSet", setId: set.id, title }); }}>
      <label>{t("セット名")}<input value={title} maxLength={120} required onChange={(e) => setTitle(e.target.value)} /></label>
      <button className="primary" disabled={busy || !title.trim() || title === set.title}>{t("名前を保存")}</button>
    </form>
    <details className="source-details"><summary>{t("元の文章を確認")}</summary><p>{set.sourceContent}</p></details>
    <div className="manager-tabs">{["学習中", "アーカイブ", "削除済み"].map((tabName) => <button key={tabName} aria-pressed={tab === tabName} onClick={() => { setTab(tabName); setEditing(null); }}>{t(tabName)}</button>)}</div>
    {error && <p role="alert" className="inline-error">{t(error)}</p>}
    {deletedId && <div className="undo-notice" role="status">{t("カードを削除しました。")}<button disabled={busy} onClick={async () => { if (await run({ action: deletedId.archived ? "archiveCard" : "restoreCard", cardId: deletedId.id })) setDeletedId(null); }}>{t("取り消す")}</button></div>}
    {!visible.length && <p className="muted">{t("この一覧にカードはありません。")}</p>}
    {visible.map((card) => <article className="managed-card" key={card.id}>
      {editing?.id === card.id ? <form onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "editCard", cardId: card.id, question: editing.question, answer: editing.answer, choices: editing.choices })) setEditing(null); }}>
        <label>{t("質問")}<textarea required maxLength={5000} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} /></label>
        <label>{t("答え")}<textarea required maxLength={10000} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} /></label>
        {editing.format === "multiple_choice" && editing.choices.map((choice, i) => <label key={i}>{t("選択肢")}{i + 1}<input required value={choice} onChange={(e) => setEditing({ ...editing, choices: editing.choices.map((v, j) => j === i ? e.target.value : v) })} /></label>)}
        <div className="manager-actions"><button className="primary" disabled={busy}>{t("変更を保存")}</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>{t("キャンセル")}</button></div>
      </form> : <><strong>{card.question}</strong><p>{card.answer}</p><div className="manager-actions">
        {card.status !== "削除済み" && <button disabled={busy} onClick={() => setEditing({ ...card, choices: [...card.choices] })}>{t("編集")}</button>}
        {!["アーカイブ", "削除済み"].includes(card.status) && <button disabled={busy} onClick={() => run({ action: "archiveCard", cardId: card.id })}>{t("アーカイブ")}</button>}
        {["アーカイブ", "削除済み"].includes(card.status) && <button disabled={busy} onClick={() => run({ action: "restoreCard", cardId: card.id })}>{t("学習に戻す")}</button>}
        {card.status !== "削除済み" && <button disabled={busy} onClick={async () => { if (await run({ action: "deleteCard", cardId: card.id })) setDeletedId({ id: card.id, archived: card.status === "アーカイブ" }); }}>{t("削除")}</button>}
      </div><details className="source-details"><summary>{t("このカードの元の文章")}</summary><p>{set.sourceContent}</p></details></>}
    </article>)}
  </section>;
}
