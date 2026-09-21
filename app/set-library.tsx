"use client";

import { useApiFetch } from "./account-context";

import { useLanguage } from "./language";
import { IconLabel } from "./asset-icon";
import { PatchIcon } from "./patch-ui";

import { useRef, useState, type ReactNode } from "react";
import type { AppData, Folder } from "../lib/types";
import { searchMaterials } from "../lib/material-search";
import { setEmoji } from "../lib/set-presentation";
import { widgetState } from "../lib/retention";

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

export function SetLibrary({ data, now, folderId, openSetId, onFolder, onSet, onStudy, onData, onAdd, children }: {
  data: AppData; now: Date; folderId: string | null; openSetId: string | null;
  onFolder: (id: string | null) => void; onSet: (id: string, cardId?: string) => void;
  onStudy: (id: string, startCardId?: string, batchSize?: number) => void;
  onData: (data: AppData) => void; onAdd: () => void; children: ReactNode;
}) {
  const apiFetch = useApiFetch();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(50);
  const [showAllDue, setShowAllDue] = useState(false);
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
  const root = currentFolderId === null;
  const folders = data.folders.filter((f) => f.parentId === currentFolderId);
  const sets = root ? data.sets : data.sets.filter((set) => set.folderId === currentFolderId);
  const activeCards = (set: AppData["sets"][number]) => set.cards.filter((card) => !["アーカイブ", "削除済み"].includes(card.status));
  const retention = data.retention;
  const stale = !!retention && widgetState(retention, now.getTime()) === "STALE";
  const legacyDone = new Set(data.dailyReview?.completedCardIds ?? []);
  const dueIds = new Set(stale ? [] : retention?.dueCardIds ?? (data.dailyReview?.cardIds ?? []).filter((id) => !legacyDone.has(id)));
  const duePatches = data.sets.map((set) => ({ set, cards: activeCards(set).filter((card) => dueIds.has(card.id)) })).filter(({ cards }) => cards.length);
  const visibleDuePatches = showAllDue ? duePatches : duePatches.slice(0, 3);
  const hiddenDuePatches = duePatches.length - visibleDuePatches.length;
  const completed = !stale && (retention?.completed ?? data.dailyReview?.completed ?? false);
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
  const folderForm = folderFormOpen && <form id="folder-create-form" className="folder-create" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: renaming ? "renameFolder" : "createFolder", folderId: currentFolderId, name: name.trim() })) { setName(""); setRenaming(false); setFolderFormOpen(false); folderButtonRef.current?.focus(); setMessage(renaming ? t("フォルダ名を変更しました。") : t("フォルダを作成しました。")); } }}>
    <label>{renaming ? t("フォルダ名を変更") : t("新しいフォルダ")}<input autoFocus required maxLength={120} placeholder={t("例：資格の勉強、日本史")} value={name} onChange={(e) => setName(e.target.value)} /></label>
    <button className="secondary" disabled={busy || !name.trim()}>{renaming ? t("名前を保存") : t("フォルダを作成")}</button>
    <button type="button" className="folder-text-button" disabled={busy} onClick={() => { setFolderFormOpen(false); setRenaming(false); setName(""); folderButtonRef.current?.focus(); }}>{t("キャンセル")}</button>
  </form>;
  const folderCards = (items: Folder[]) => <div className="folder-grid">{items.map((item) => <button className="folder-tile" key={item.id} onClick={() => navigate(item.id)}><span className="folder-icon"><PatchIcon name="folder" size={25} /></span><strong>{item.name}</strong><small>{t("Patch：{0}件", data.sets.filter((set) => set.folderId === item.id).length)}</small><span className="folder-arrow"><PatchIcon name="chevron" size={19} /></span></button>)}</div>;
  const patchRows = (items: AppData["sets"]) => <div className="library-sets">{items.map((set) => <article key={set.id}><button className="library-set-open" onClick={() => onSet(set.id)}><span className="library-patch-icon" aria-hidden="true"><PatchIcon name="book" size={24} /></span><div><strong>{set.title}</strong><small>{t("{0}枚", activeCards(set).length)}{set.category ? <> · {set.category}</> : null}</small></div><PatchIcon name="chevron" size={20} /></button><button className="folder-text-button library-set-move" onClick={() => { setMovingSet(set.id); setDestination(set.folderId || ""); }}>{t("移動")}</button></article>)}</div>;
  return <>
    <div className={`page library-page patch-library ${root && !currentSet ? "patch-library-root" : ""}`}>
      {(path.length > 0 || currentSet) && <nav className="folder-breadcrumb" aria-label={t("フォルダの場所")}><button onClick={() => navigate(null)}>{t("Patches")}</button>{path.map((f) => <span key={f.id}><span aria-hidden="true"> / </span><button onClick={() => navigate(f.id)}>{f.name}</button></span>)}{currentSet && <span aria-current="page"> / {currentSet.title}</span>}</nav>}
      {(!currentSet || searching) && <div className="material-search patch-library-search"><label className="study-sr-only" htmlFor="material-search-input">{t("教材・カードを検索")}</label><div><PatchIcon name="search" size={25} /><input id="material-search-input" type="search" value={query} placeholder={t("Patchを検索")} onChange={(event) => { setQuery(event.target.value); setSearchLimit(50); }} />{searching && <button type="button" className="secondary" onClick={() => setQuery("")}>{t("クリア")}</button>}</div></div>}
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
      {message && <p role="status">{t(message)}</p>}
      {searching ? <section className="material-search-results" aria-label={t("検索結果")}>
        <p role="status">{t("教材{0}件・カード{1}枚", results.sets.length, results.cards.length)}</p>
        {results.sets.length > 0 && <><h2>{t("教材")}</h2><div className="search-hit-list">{results.sets.slice(0, searchLimit).map((set) => <button key={set.id} type="button" onClick={() => openSearchResult(set.id)}><strong><span aria-hidden="true">{setEmoji(set)} </span>{set.title}</strong><small>{folderPath(data.folders, set.folderId).map((f) => f.name).join(" / ") || t("すべての教材")}</small></button>)}</div></>}
        {results.cards.length > 0 && <><h2>{t("カード")}</h2><div className="search-hit-list">{results.cards.slice(0, searchLimit).map(({ card, set }) => <button key={card.id} type="button" onClick={() => openSearchResult(set.id, card.id)}><small>{set.title}</small><strong>{card.question}</strong><span>{card.answer}</span></button>)}</div></>}
        {!results.sets.length && !results.cards.length && <p className="muted">{t("一致する教材・カードがありません。")}</p>}
        {Math.max(results.sets.length, results.cards.length) > searchLimit && <button className="secondary wide" onClick={() => setSearchLimit((limit) => limit + 50)}>{t("さらに表示")}</button>}
      </section> : currentSet ? <div className="folder-toolbar"><button className="secondary" onClick={() => navigate(currentFolderId)}><IconLabel name="chevron-left" size={18}>{t("フォルダへ戻る")}</IconLabel></button><button className="secondary" onClick={() => { setMovingSet(currentSet.id); setDestination(currentSet.folderId || ""); }}>{t("別のフォルダへ移動")}</button></div> : root ? <div className="patch-library-dashboard">
        <section className="patch-library-section today-patches" aria-labelledby="today-patches-heading">
          <div className="patch-library-section-heading"><div><h2 id="today-patches-heading">{t("今日のPatch")}</h2>{stale ? <p role="status">{t("学習記録を更新しています…")}</p> : duePatches.length ? <p>{t("{0}件のPatchで{1}枚復習できます", duePatches.length, dueIds.size)}</p> : completed ? <p>{t("今日の目標を達成しました。追加の学習は任意です。")}</p> : <p>{t("今は復習できるカードがありません。")}</p>}</div>{duePatches.length > 3 && <button type="button" className="patch-library-view-all" aria-expanded={showAllDue} onClick={() => setShowAllDue((value) => !value)}>{t(showAllDue ? "折りたたむ" : "すべて表示")}</button>}</div>
          {visibleDuePatches.length > 0 ? <div className="today-patch-list">{visibleDuePatches.map(({ set, cards }) => <button key={set.id} type="button" onClick={() => onStudy(`__daily__:${set.id}`)}><span className="today-patch-icon"><PatchIcon name="book" size={25} /></span><span><strong>{set.title}</strong><small>{t("{0}枚の復習", cards.length)}</small></span><span className="review-ready-chip">{t("復習可能")}</span><PatchIcon name="chevron" size={20} /></button>)}</div> : !stale && <div className={`today-patch-empty ${completed ? "is-complete" : ""}`}><PatchIcon name={completed ? "check" : "calendar"} size={28} /><strong>{t(completed ? "今日の目標は完了です" : "復習はありません")}</strong><span>{t(completed ? "さらに学ぶ場合は、下のPatchから選べます。" : "次の復習まで、保存したPatchを自由に学べます。")}</span></div>}
          {hiddenDuePatches > 0 && <button type="button" className="today-patch-more" onClick={() => setShowAllDue(true)}><span aria-hidden="true">•••</span>{t("ほか{0}件の復習", hiddenDuePatches)}</button>}
        </section>
        <section className="patch-library-section library-folders" aria-labelledby="patch-folders-heading">
          <div className="patch-library-section-heading"><h2 id="patch-folders-heading">{t("フォルダ")}</h2><div className="folder-controls"><button ref={folderButtonRef} type="button" className="secondary" disabled={busy} aria-label={t("新しいフォルダ")} aria-expanded={folderFormOpen && !renaming} aria-controls="folder-create-form" onClick={() => { setFolderFormOpen(!folderFormOpen || renaming); setRenaming(false); setName(""); }}><PatchIcon name="plus" size={22} /><span className="study-sr-only">{t("新しいフォルダ")}</span></button></div></div>
          {folderForm}
          {folders.length ? folderCards(folders) : <p className="library-section-empty">{t("フォルダはまだありません。")}</p>}
        </section>
        <section className="patch-library-section all-patches" aria-labelledby="all-patches-heading">
          <div className="patch-library-section-heading"><h2 id="all-patches-heading">{t("すべてのPatch")}</h2></div>
          {data.sets.length ? patchRows(data.sets) : <div className="library-empty"><p>{t("まだPatchがありません。教材を追加して最初のPatchを作りましょう。")}</p><button type="button" className="primary" onClick={onAdd}>{t("教材を追加")}</button></div>}
        </section>
      </div> : <>
        <div className="library-heading"><h1>{folder?.name}</h1></div>
        <div className="folder-controls"><button ref={folderButtonRef} type="button" className="secondary" disabled={busy} aria-expanded={folderFormOpen && !renaming} aria-controls="folder-create-form" onClick={() => { setFolderFormOpen(!folderFormOpen || renaming); setRenaming(false); setName(""); }}><span className="icon-label"><PatchIcon name="plus" size={18} /><span>{t("フォルダ")}</span></span></button><button type="button" className="folder-text-button" disabled={busy} aria-expanded={folderFormOpen && renaming} aria-controls="folder-create-form" onClick={() => { setFolderFormOpen(true); setRenaming(true); setName(folder?.name || ""); }}>{t("このフォルダの名前を変更")}</button></div>
        {folderForm}
        {folderCards(folders)}
        {patchRows(sets)}
        {!sets.length && !folders.length && <p className="library-empty">{t("まだ教材がありません。カードセットを追加するか、フォルダを作って整理しましょう。")}</p>}
      </>}
      {movingSet && !searching && <form className="folder-move panel" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "moveSet", setId: movingSet, folderId: destination || null })) { setMovingSet(null); setMessage(t("カードセットを移動しました。")); if (currentSet) onFolder(destination || null); } }}><h2>{t("「")}{data.sets.find((set) => set.id === movingSet)?.title}{t("」の移動先")}</h2><label>{t("フォルダ")}<select value={destination} onChange={(e) => setDestination(e.target.value)}>{options}</select></label><div className="manager-actions"><button className="primary" disabled={busy}>{t("ここへ移動")}</button><button type="button" disabled={busy} onClick={() => setMovingSet(null)}>{t("キャンセル")}</button></div></form>}
    </div>
    {currentSet && !searching && children}
  </>;
}
