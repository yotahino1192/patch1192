"use client";

import { useLanguage } from "./language";

import { useState, type ReactNode } from "react";
import type { AppData, Folder } from "../lib/types";

export function folderPath(folders: Folder[], id: string | null): Folder[] {
  const path: Folder[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folders.find((f) => f.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

export function SetLibrary({ data, folderId, openSetId, onFolder, onSet, onData, onAdd, children }: {
  data: AppData; folderId: string | null; openSetId: string | null;
  onFolder: (id: string | null) => void; onSet: (id: string) => void;
  onData: (data: AppData) => void; onAdd: () => void; children: ReactNode;
}) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState(folderId || "");
  const [movingSet, setMovingSet] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const currentSet = data.sets.find((set) => set.id === openSetId);
  const currentFolderId = currentSet ? currentSet.folderId : folderId;
  const path = folderPath(data.folders, currentFolderId);
  const folder = path[path.length - 1];
  const folders = data.folders.filter((f) => f.parentId === currentFolderId);
  const sets = data.sets.filter((set) => set.folderId === currentFolderId);
  const run = async (body: Record<string, unknown>) => {
    if (busy) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { data: AppData; error?: string };
      if (!response.ok) throw new Error(result.error || "保存できませんでした。");
      onData(result.data);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); return false; }
    finally { setBusy(false); }
  };
  const navigate = (id: string | null) => { setName(""); setRenaming(false); setMovingSet(null); setError(""); setMessage(""); onFolder(id); };
  const options = <><option value="">{t("すべての教材（直下）")}</option>{data.folders.map((f) => <option key={f.id} value={f.id}>{folderPath(data.folders, f.id).map((p) => p.name).join(" / ")}</option>)}</>;
  return <>
    <div className="page library-page">
      <nav className="folder-breadcrumb" aria-label={t("フォルダの場所")}><button onClick={() => navigate(null)}>{t("すべての教材")}</button>{path.map((f) => <span key={f.id}><span aria-hidden="true"> / </span><button onClick={() => navigate(f.id)}>{f.name}</button></span>)}{currentSet && <span aria-current="page"> / {currentSet.title}</span>}</nav>
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
      {message && <p role="status">{t(message)}</p>}
      {currentSet ? <div className="folder-toolbar"><button className="secondary" onClick={() => navigate(currentFolderId)}>{t("← フォルダへ戻る")}</button><button className="secondary" onClick={() => { setMovingSet(currentSet.id); setDestination(currentSet.folderId || ""); }}>{t("別のフォルダへ移動")}</button></div> : <>
        <div className="library-heading">{folder && <h1>{folder.name}</h1>}<button className="primary" onClick={onAdd}>{t("＋ カードセットを追加")}</button></div>
        <form className="folder-create" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: renaming ? "renameFolder" : "createFolder", folderId: currentFolderId, name: name.trim() })) { setName(""); setRenaming(false); setMessage(renaming ? t("フォルダ名を変更しました。") : t("フォルダを作成しました。")); } }}>
          <label>{renaming ? t("フォルダ名を変更") : t("新しいフォルダ")}<input required maxLength={120} placeholder={t("例：資格の勉強、日本史")} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button className="secondary" disabled={busy || !name.trim()}>{renaming ? t("名前を保存") : t("フォルダを作成")}</button>
          {folder && <button type="button" className="folder-text-button" disabled={busy} onClick={() => { setRenaming(!renaming); setName(renaming ? "" : folder.name); }}>{renaming ? t("キャンセル") : t("このフォルダの名前を変更")}</button>}
        </form>
        <div className="folder-grid">{folders.map((f) => <button className="folder-tile" key={f.id} onClick={() => navigate(f.id)}><span aria-hidden="true">📁</span><strong>{f.name}</strong><small>{data.folders.filter((c) => c.parentId === f.id).length}{t("フォルダ ·")}{data.sets.filter((set) => set.folderId === f.id).length}{language === "en" ? " sets" : "セット"}</small><span className="folder-arrow" aria-hidden="true">›</span></button>)}</div>
        <div className="library-sets">{sets.map((set) => <article key={set.id}><button className="library-set-open" onClick={() => onSet(set.id)}><span aria-hidden="true">▤</span><div><strong>{set.title}</strong><small>{set.cards.filter((c) => !["アーカイブ", "削除済み"].includes(c.status)).length}{t("枚 ·")}{set.category}</small></div><span aria-hidden="true">›</span></button><button className="folder-text-button" onClick={() => { setMovingSet(set.id); setDestination(set.folderId || ""); }}>{t("移動")}</button></article>)}</div>
        {!sets.length && !folders.length && <p className="library-empty">{t("まだ教材がありません。カードセットを追加するか、フォルダを作って整理しましょう。")}</p>}
      </>}
      {movingSet && <form className="folder-move panel" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "moveSet", setId: movingSet, folderId: destination || null })) { setMovingSet(null); setMessage(t("カードセットを移動しました。")); if (currentSet) onFolder(destination || null); } }}><h2>{t("「")}{data.sets.find((set) => set.id === movingSet)?.title}{t("」の移動先")}</h2><label>{t("フォルダ")}<select value={destination} onChange={(e) => setDestination(e.target.value)}>{options}</select></label><div className="manager-actions"><button className="primary" disabled={busy}>{t("ここへ移動")}</button><button type="button" disabled={busy} onClick={() => setMovingSet(null)}>{t("キャンセル")}</button></div></form>}
    </div>
    {currentSet && children}
  </>;
}
