"use client";

import { useApiFetch } from "./account-context";

import { useLanguage } from "./language";
import { AssetIcon, IconLabel } from "./asset-icon";

import { useRef, useState, type ReactNode } from "react";
import type { AppData, Folder } from "../lib/types";
import { searchMaterials } from "../lib/material-search";
import { setEmoji } from "../lib/set-presentation";

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
  onFolder: (id: string | null) => void; onSet: (id: string, cardId?: string) => void;
  onData: (data: AppData) => void; onAdd: () => void; children: ReactNode;
}) {
  const apiFetch = useApiFetch();
  const { t, language, locale, setLanguage } = useLanguage();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(50);
  const searching = Boolean(query.trim());
  const results = searchMaterials(data, query);
  const openSearchResult = (setId: string, cardId?: string) => { setQuery(""); onSet(setId, cardId); };
  const [renaming, setRenaming] = useState(false);
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const folderButtonRef = useRef<HTMLButtonElement>(null);
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
      const response = await apiFetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { data: AppData; error?: string };
      if (!response.ok) throw new Error(result.error || "保存できませんでした。");
      onData(result.data);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); return false; }
    finally { setBusy(false); }
  };
  const navigate = (id: string | null) => { setQuery(""); setFolderFormOpen(false); setName(""); setRenaming(false); setMovingSet(null); setError(""); setMessage(""); onFolder(id); };
  const options = <><option value="">{t("すべての教材（直下）")}</option>{data.folders.map((f) => <option key={f.id} value={f.id}>{folderPath(data.folders, f.id).map((p) => p.name).join(" / ")}</option>)}</>;
  return <>
    <div className="page library-page">
      <nav className="folder-breadcrumb" aria-label={t("フォルダの場所")}><button onClick={() => navigate(null)}>{t("すべての教材")}</button>{path.map((f) => <span key={f.id}><span aria-hidden="true"> / </span><button onClick={() => navigate(f.id)}>{f.name}</button></span>)}{currentSet && <span aria-current="page"> / {currentSet.title}</span>}</nav>
      {(!currentSet || searching) && <div className="material-search"><label className="study-sr-only" htmlFor="material-search-input">{t("教材・カードを検索")}</label><div><input id="material-search-input" type="search" value={query} placeholder={t("教材名・質問・答えで検索")} onChange={(event) => { setQuery(event.target.value); setSearchLimit(50); }} />{searching && <button type="button" className="secondary" onClick={() => setQuery("")}>{t("クリア")}</button>}</div></div>}
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
      {message && <p role="status">{t(message)}</p>}
      {searching ? <section className="material-search-results" aria-label={t("検索結果")}>
        <p role="status">{t("教材{0}件・カード{1}枚", results.sets.length, results.cards.length)}</p>
        {results.sets.length > 0 && <><h2>{t("教材")}</h2><div className="search-hit-list">{results.sets.slice(0, searchLimit).map((set) => <button key={set.id} type="button" onClick={() => openSearchResult(set.id)}><strong><span aria-hidden="true">{setEmoji(set)} </span>{set.title}</strong><small>{folderPath(data.folders, set.folderId).map((f) => f.name).join(" / ") || t("すべての教材")}</small></button>)}</div></>}
        {results.cards.length > 0 && <><h2>{t("カード")}</h2><div className="search-hit-list">{results.cards.slice(0, searchLimit).map(({ card, set }) => <button key={card.id} type="button" onClick={() => openSearchResult(set.id, card.id)}><small>{set.title}</small><strong>{card.question}</strong><span>{card.answer}</span></button>)}</div></>}
        {!results.sets.length && !results.cards.length && <p className="muted">{t("一致する教材・カードがありません。")}</p>}
        {Math.max(results.sets.length, results.cards.length) > searchLimit && <button className="secondary wide" onClick={() => setSearchLimit((limit) => limit + 50)}>{t("さらに表示")}</button>}
      </section> : currentSet ? <div className="folder-toolbar"><button className="secondary" onClick={() => navigate(currentFolderId)}><IconLabel name="chevron-left" size={18}>{t("フォルダへ戻る")}</IconLabel></button><button className="secondary" onClick={() => { setMovingSet(currentSet.id); setDestination(currentSet.folderId || ""); }}>{t("別のフォルダへ移動")}</button></div> : <>
        <div className="library-heading">{folder && <h1>{folder.name}</h1>}<button className="primary" onClick={onAdd}><IconLabel name="plus-dark">{t("カードセットを追加")}</IconLabel></button></div>
        <div className="folder-controls">
          <button ref={folderButtonRef} type="button" className="secondary" disabled={busy} aria-expanded={folderFormOpen && !renaming} aria-controls="folder-create-form" onClick={() => { setFolderFormOpen(!folderFormOpen || renaming); setRenaming(false); setName(""); }}><IconLabel name="plus">{t("フォルダ")}</IconLabel></button>
          {folder && <button type="button" className="folder-text-button" disabled={busy} aria-expanded={folderFormOpen && renaming} aria-controls="folder-create-form" onClick={() => { setFolderFormOpen(true); setRenaming(true); setName(folder.name); }}>{t("このフォルダの名前を変更")}</button>}
        </div>
        {folderFormOpen && <form id="folder-create-form" className="folder-create" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: renaming ? "renameFolder" : "createFolder", folderId: currentFolderId, name: name.trim() })) { setName(""); setRenaming(false); setFolderFormOpen(false); folderButtonRef.current?.focus(); setMessage(renaming ? t("フォルダ名を変更しました。") : t("フォルダを作成しました。")); } }}>
          <label>{renaming ? t("フォルダ名を変更") : t("新しいフォルダ")}<input autoFocus required maxLength={120} placeholder={t("例：資格の勉強、日本史")} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button className="secondary" disabled={busy || !name.trim()}>{renaming ? t("名前を保存") : t("フォルダを作成")}</button>
          <button type="button" className="folder-text-button" disabled={busy} onClick={() => { setFolderFormOpen(false); setRenaming(false); setName(""); folderButtonRef.current?.focus(); }}>{t("キャンセル")}</button>
        </form>}
        <div className="folder-grid">{folders.map((f) => <button className="folder-tile" key={f.id} onClick={() => navigate(f.id)}><AssetIcon name="folder" size={30} /><strong>{f.name}</strong><small>{data.folders.filter((c) => c.parentId === f.id).length}{t("フォルダ ·")}{data.sets.filter((set) => set.folderId === f.id).length}{language === "en" ? " sets" : "セット"}</small><span className="folder-arrow"><AssetIcon name="chevron-right" size={18} /></span></button>)}</div>
        <div className="library-sets">{sets.map((set) => <article key={set.id}><button className="library-set-open" onClick={() => onSet(set.id)}><span aria-hidden="true">{setEmoji(set)}</span><div><strong>{set.title}</strong><small>{set.cards.filter((c) => !["アーカイブ", "削除済み"].includes(c.status)).length}{t("枚 ·")}{set.category}</small></div><AssetIcon name="chevron-right" size={18} /></button><button className="folder-text-button" onClick={() => { setMovingSet(set.id); setDestination(set.folderId || ""); }}>{t("移動")}</button></article>)}</div>
        {!sets.length && !folders.length && <p className="library-empty">{t("まだ教材がありません。カードセットを追加するか、フォルダを作って整理しましょう。")}</p>}
      </>}
      {movingSet && !searching && <form className="folder-move panel" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "moveSet", setId: movingSet, folderId: destination || null })) { setMovingSet(null); setMessage(t("カードセットを移動しました。")); if (currentSet) onFolder(destination || null); } }}><h2>{t("「")}{data.sets.find((set) => set.id === movingSet)?.title}{t("」の移動先")}</h2><label>{t("フォルダ")}<select value={destination} onChange={(e) => setDestination(e.target.value)}>{options}</select></label><div className="manager-actions"><button className="primary" disabled={busy}>{t("ここへ移動")}</button><button type="button" disabled={busy} onClick={() => setMovingSet(null)}>{t("キャンセル")}</button></div></form>}
    </div>
    {currentSet && !searching && children}
  </>;
}
