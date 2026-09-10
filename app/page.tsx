"use client";

import { useLanguage, LanguageProvider, translate, type Language } from "./language";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./use-workspace";
import { EMPTY_IMPORT, EMPTY_SESSION, activateSession, reconcileWorkspace, reconcileSession, pendingStudyCount, startStudyBatch, nextStudyBatch, studyUndoCheckpoint, restoreStudyUndo, studyReturnTarget, resolveStudyReturn, type DraftCard, type DraftMaterial, type ImportDraft, type StudySession, type Workspace } from "../lib/workspace";
import { SetLibrary, folderPath } from "./set-library";
import { DocumentAttachments, type Attachment } from "./document-attachments";
import { Dropdown } from "./dropdown";
import { isLongTermDue, memoryMilestones } from "../lib/long-term-review";
import { setEmoji } from "../lib/set-presentation";
import { DailyReviewRail } from "./daily-review";
import { ReviewCelebration } from "./study-effects";
import { MaterialManager } from "./material-manager";
import { SettingsDialog } from "./settings-dialog";
import { StudyCardEditor } from "./study-card-editor";
import { AssetIcon, IconLabel } from "./asset-icon";
import type {
  AppData,
  Card,
  ChatMessage,
  GeneratedCard,
  GeneratedMaterial,
} from "../lib/types";
import { scheduleBinaryReview, advanceLessonQueue, type LessonVerdict } from "../lib/review";

type Screen = "home" | "import" | "generate" | "sets" | "study" | "records";

const navItems: { id: Screen; label: string }[] = [
  { id: "home", label: "ホーム" },
  { id: "sets", label: "セット" },
  { id: "import", label: "教材追加" },
  { id: "records", label: "記録" },
];

class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const body = await response.json() as T & { error?: string; code?: string };
  if (!response.ok) throw new ApiError(body.error || "通信に失敗しました。", body.code);
  return body;
}

function formatDate(value: Date, locale: string, kind: "full" | "short" | "time" | "review"): string {
  const formats: Record<string, Intl.DateTimeFormatOptions> = {
    full: { year: "numeric", month: "long", day: "numeric", weekday: "long" },
    short: { month: "short", day: "numeric" },
    time: { hour: "2-digit", minute: "2-digit" },
    review: { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" },
  };
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", ...formats[kind] }).format(value);
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const interval = window.setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

function currentTimeMs(): number {
  return Date.now();
}

function tokyoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

function dayKey(date: Date): string {
  const p = tokyoParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function relativeDate(value: string | null, now: Date, language: Language): string {
  const locale = language === "en" ? "en-US" : "ja-JP";
  if (!value) return translate(language, "未学習");
  const date = new Date(value);
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < 60000) return translate(language, "いま");
  if (Math.abs(diff) < 3600000) return new Intl.RelativeTimeFormat(locale).format(Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) / 60000)), "minute");
  if (dayKey(now) === dayKey(date)) return translate(language, "今日") + (diff >= 0 ? ` ${formatDate(date, locale, "time")}` : "");
  if (dayKey(new Date(now.getTime() + 86400000)) === dayKey(date)) return `${translate(language, "明日")} ${formatDate(date, locale, "time")}`;
  if (dayKey(new Date(now.getTime() - 86400000)) === dayKey(date)) return translate(language, "昨日");
  return formatDate(date, locale, "short");
}

function greeting(now: Date): string {
  const hour = tokyoParts(now).hour;
  if (hour < 11) return "おはよう";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

function isActiveCard(card: Card): boolean {
  return !["アーカイブ", "削除済み"].includes(card.status);
}

function isDue(card: Card, now: Date): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime() && isActiveCard(card);
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  const { t, language, locale, setLanguage } = useLanguage();
  return <button className="icon-button" aria-label={t(label)} onClick={onClick}>{children}</button>;
}

function Shell({ screen, setScreen, children, title }: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { t } = useLanguage();
  const mainRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [screen]);
  return (
    <div className={`app-shell ${screen === "study" ? "is-studying" : ""}`}>
      {screen !== "study" && <header className={`topbar${screen === "home" ? " topbar-home" : ""}`}>
        {title && <IconButton label={t("ホームへ戻る")} onClick={() => setScreen("home")}><span className="home-shortcut-emoji" aria-hidden="true">🏠</span></IconButton>}
        {title && <h1 className="screen-title">{t(title)}</h1>}
        <button type="button" className="settings-button" aria-label={t("設定")} aria-haspopup="dialog" onClick={() => settingsRef.current?.showModal()}>
          <AssetIcon name="settings" size={24} />
        </button>
      </header>}
      {screen !== "study" && <SettingsDialog dialogRef={settingsRef} />}
      <main ref={mainRef} tabIndex={-1}>{children}</main>
      {screen !== "study" && <nav className="bottom-nav" aria-label={t("メインナビゲーション")}>
        {navItems.map((item) => {
          const active = item.id === screen || (item.id === "import" && screen === "generate");
          return (
          <button
            key={item.id}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            onClick={() => { if (!active) setScreen(item.id); }}
          >
            <span className="nav-icon nav-image" aria-hidden="true"><img src={`/nav-icons/${item.id}.png`} width={1254} height={1254} alt="" /></span>
            <span>{t(item.label)}</span>
          </button>
          );
        })}
      </nav>}
    </div>
  );
}

function Home({ data, now, startStudy, setScreen, selectSet, resumeDraft, resumableSessions, onResume, onSample }: {
  data: AppData;
  now: Date;
  startStudy: (setId?: string, startCardId?: string, batchSize?: number) => void;
  setScreen: (screen: Screen) => void;
  selectSet: (id: string) => void;
  resumeDraft?: () => void;
  resumableSessions: StudySession[];
  onResume: (session: StudySession) => void;
  onSample: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const planPending = new Set(data.dailyReview.cardIds.filter((id) => !data.dailyReview.completedCardIds.includes(id)));
  const memorySets = data.sets.map((set) => ({ set, cards: set.cards.filter((card) => isLongTermDue(card, now)) })).filter(({ cards }) => cards.length);
  return (
    <div className="page home-page">
      <section className="hero companion-greeting" aria-label={t("キャラクターからのあいさつ")}>
        <img className="home-landscape" src="/home-landscape.png" width={1672} height={941} alt="" fetchPriority="high" aria-hidden="true" />
        <div className="companion-bubble">
          <h1>{t(greeting(now))}{t("、Yota")}</h1>
          <p>{!data.sets.length ? t("まずはサンプルで、一緒に学んでみよう！") : planPending.size ? t("今日は{0}枚、一緒に復習しよう！", planPending.size) : data.dailyReview.completed ? t("今日の復習はできたね。おつかれさま！") : t("次の復習までひと休み。新しい文章からも学べるよ！")}</p>
        </div>
      </section>

      {!data.sets.length ? <section className="panel first-lesson">
        <h2>{t("最初の学習を始めよう")}</h2>
        <button className="primary wide" disabled={sampleBusy} onClick={async () => { setSampleBusy(true); setSampleError(""); try { await onSample(); } catch (e) { setSampleError(e instanceof Error ? e.message : t("サンプルを準備できませんでした。")); } finally { setSampleBusy(false); } }}>{sampleBusy ? t("準備しています…") : t("サンプルで学習 · 3枚")}</button>
        <button className="secondary wide" onClick={() => setScreen("import")}>{t("自分の文章から作る")}</button>
        {sampleError && <p role="alert" className="inline-error">{t(sampleError)}</p>}
      </section> : null}
      <DailyReviewRail data={data} now={now} onStudy={startStudy} />
      {resumableSessions.length > 0 && <section className="home-resume-list" aria-label={t("今日の学習")}>
        {resumableSessions.map((session) => <button key={session.id} className="resume-study" onClick={() => onResume(session)}><span><strong>{t("続きから学習 · 残り{0}枚", pendingStudyCount(session))}</strong><small>{data.sets.find((set) => set.id === session.setId)?.title || t("復習")}</small></span><b aria-hidden="true">➡️</b></button>)}
      </section>}

      <section className="long-term-review">
        <div className="section-row"><h2>{t("久しぶりに思い出す")}</h2></div>
        {memorySets.length ? <div className="recommend-card-grid">{memorySets.map(({ set, cards }, index) => <button key={set.id} className={`recommend-card ${["blue-set", "green-set", "violet-set"][index % 3]}`} onClick={() => startStudy(`__memory__:${set.id}`)}>
          <strong>{set.title}</strong><span className="recommend-number">{t("{0}枚", cards.length)}</span><small>{t("間隔をあけて、長期記憶を確認しましょう。")}</small><span className="recommend-link">{t("復習を始める")} <b aria-hidden="true">➡️</b></span>
        </button>)}</div> : <div className="memory-empty"><img src="/review-empty.png" width={1454} height={1080} alt="" /><div><strong>{t("今は復習待ちのカードはありません")}</strong><p>{t("次の復習まで少し休憩しましょう。")}</p></div></div>}
      </section>

      {resumeDraft && <button className="resume-draft" onClick={resumeDraft}>{t("下書きの続きから")}<span>➡️</span></button>}
      {data.sets.length > 0 && <button className="floating-add" onClick={() => setScreen("import")}><IconLabel name="plus" size={22}>{t("新しい教材を追加")}</IconLabel></button>}
    </div>
  );
}

function DestinationPicker({ data, value, onChange, disabled = false }: { data: AppData; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useLanguage();
  return <div className="destination-picker"><Dropdown label={t("保存先")} value={value} onChange={onChange} disabled={disabled} options={[
    { value: "root", label: t("すべての教材") },
    ...data.folders.map((folder) => ({ value: `folder:${folder.id}`, label: t("フォルダ：{0}", folderPath(data.folders, folder.id).map((f) => f.name).join(" / ")) })),
    ...data.sets.map((set) => ({ value: `set:${set.id}`, label: t("セットに追加：{0}", [...folderPath(data.folders, set.folderId).map((f) => f.name), set.title].join(" / ")) })),
  ]} /><p className="attachment-hint">{t(value.startsWith("set:") ? "選んだセットにカードを追加します。" : "選んだ場所に新しいセットを作成します。")}</p></div>;
}

function ImportScreen({ onGenerate, data, destination, setDestination, importDraft, setImportDraft }: { onGenerate: (text: string, detail: string, style: string) => Promise<void>; data: AppData; destination: string; setDestination: (value: string) => void; importDraft: ImportDraft; setImportDraft: React.Dispatch<React.SetStateAction<ImportDraft>> }) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [showImportHelp, setShowImportHelp] = useState(false);
  const { detail, style, text, attachments } = importDraft;
  const setDetail = (detail: string) => setImportDraft((draft) => ({ ...draft, detail }));
  const setStyle = (style: string) => setImportDraft((draft) => ({ ...draft, style }));
  const setText = (text: string) => setImportDraft((draft) => ({ ...draft, text }));
  const setAttachments = (attachments: Attachment[]) => setImportDraft((draft) => ({ ...draft, attachments }));
  const [reading, setReading] = useState(false);
  const source = [text.trim(), ...attachments.map((file) => file.text)].filter(Boolean).join("\n\n");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (source.length < 80 || source.length > 30000) {
      setError("文章と添付資料の合計を80〜30,000文字にしてください。");
      return;
    }
    setBusy(true);
    setError("");
    try { await onGenerate(source, detail, style); }
    catch (e) { setError(e instanceof Error ? e.message : "解析できませんでした。"); }
    finally { setBusy(false); }
  };
  return (
    <div className="page import-page">
      <div className="page-heading import-heading"><h1>{t("教材を追加")}</h1><button type="button" className="help info-button" aria-label={t("教材追加の説明")} aria-expanded={showImportHelp} aria-controls="import-help" onClick={() => setShowImportHelp(!showImportHelp)}><AssetIcon name="info" size={22} /></button></div>
      {showImportHelp && <div className="inline-help" id="import-help"><p>{t("文章を貼り付けると、AIが学びやすいカードへ整理します。")}</p><p>{t("文章の貼り付けと資料の添付を組み合わせて使えます。画像だけのPDFや旧形式の.doc・.pptには対応していません。URLの自動取り込みはできません。")}</p></div>}
      <textarea aria-label={t("教材にする文章")} disabled={busy || reading} id="source-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("ここに文章を貼り付けてください…\n例）ChatGPTとの会話、記事の本文、授業ノートなど")} maxLength={30000} />
      <DocumentAttachments files={attachments} onChange={setAttachments} onBusy={setReading} disabled={busy} />
      <p className={`counter ${source.length > 30000 ? "over-limit" : ""}`}>{source.length.toLocaleString()} / 30,000 {attachments.length > 0 && t("（添付資料を含む）")}</p>
      {source.length > 30000 && <p className="inline-error" role="alert">{t("文章と添付資料の合計を80〜30,000文字にしてください。")}</p>}
      <OptionGroup label={t("情報の粒度")} values={["要点のみ", "標準", "詳しく"]} value={detail} setValue={setDetail} help={t("要点のみ：重要なポイントに絞ります。標準：要点と関連知識をバランスよく。詳しく：細かな内容までカードにします。")} />
      <fieldset className="format-group">
        <legend>{t("学習形式")}</legend>
        <div className="format-grid">
          {[
            ["一問一答", "💬", "質問を見て、答えを思い出す"],
            ["4択問題", "🔢", "4つの選択肢から正解を選ぶ"],
          ].map(([name, icon, description]) => (
            <button
              type="button"
              key={t(name)}
              aria-pressed={style === name}
              className={`format-option ${style === name ? "selected" : ""}`}
              onClick={() => setStyle(name)}
            >
              <span aria-hidden="true">{icon}</span>
              <strong>{t(name)}</strong>
              <small>{t(description)}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <DestinationPicker data={data} value={destination} onChange={setDestination} disabled={busy || reading} />
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
      <button className="primary wide" onClick={submit} disabled={busy || reading || source.length < 80 || source.length > 30000} aria-busy={busy}>{busy ? t("教材を分析して、カード枚数を決めています…") : <IconLabel name="sparkles">{t("AIでカードを作る")}</IconLabel>}</button>
    </div>
  );
}

function OptionGroup({ label, values, value, setValue, help }: { label: string; values: string[]; value: string; setValue: (value: string) => void; help?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return <fieldset className="option-group"><legend>{t(label)} {help && <button type="button" className="info-button" aria-label={t("情報の粒度の説明")} aria-expanded={open} aria-controls="detail-help" onClick={() => setOpen(!open)}><AssetIcon name="info" size={22} /></button>}</legend>{open && <p className="inline-help" id="detail-help">{help}</p>}<div>{values.map((v) => <button type="button" key={v} aria-pressed={v === value} className={v === value ? "selected" : ""} onClick={() => setValue(v)}>{t(v)}</button>)}</div></fieldset>;
}

function Generate({ draft, setDraft, onSave, onRegenerate, data, destination, setDestination }: {
  data: AppData; destination: string; setDestination: (value: string) => void;
  draft: DraftMaterial | null;
  setDraft: (draft: DraftMaterial) => void;
  onSave: () => Promise<void>;
  onRegenerate: () => Promise<void>;
}) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!draft) return <div className="page empty-panel"><h1>{t("生成する教材がありません")}</h1><p>{t("「新しい教材を追加」から文章を取り込んでください。")}</p></div>;
  const selectedCards = draft.cards.filter((card) => card.selected);
  const allSelected = selectedCards.length === draft.cards.length;
  const updateCard = (draftId: string, key: "question" | "answer", value: string) => {
    const cards = draft.cards.map((card) => card.draftId === draftId ? { ...card, [key]: value } : card);
    setDraft({ ...draft, cards });
  };
  const updateChoice = (draftId: string, choiceIndex: number, value: string) => {
    const cards = draft.cards.map((card) => card.draftId === draftId
      ? { ...card, choices: card.choices.map((choice, index) => index === choiceIndex ? value : choice) }
      : card);
    setDraft({ ...draft, cards });
  };
  const toggleCard = (draftId: string) => setDraft({
    ...draft,
    cards: draft.cards.map((card) => card.draftId === draftId ? { ...card, selected: !card.selected } : card),
  });
  const toggleAll = () => setDraft({ ...draft, cards: draft.cards.map((card) => ({ ...card, selected: !allSelected })) });
  const save = async () => {
    if (!selectedCards.length) {
      setError("登録するカードを1枚以上選択してください。");
      return;
    }
    if (selectedCards.some((card) => !card.question.trim() || !card.answer.trim())) {
      setError("空の質問または回答があります。");
      return;
    }
    if (selectedCards.some((card) => card.format === "multiple_choice" &&
      (card.choices.length !== 4 || card.choices.some((choice) => !choice.trim()) || new Set(card.choices.map((choice) => choice.trim())).size !== 4 || !card.choices.map((choice) => choice.trim()).includes(card.answer.trim())))) {
      setError("4択問題は、正解を含む重複のない4つの選択肢にしてください。");
      return;
    }
    setBusy(true); setError("");
    try { await onSave(); } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  };
  return (
    <div className="page generation-page">
      <div className="success-banner"><AssetIcon name="check" size={40} /><div><h2>{t("解析完了")}</h2><p>{t("要点とカード候補を生成しました。保存前に編集できます。")}</p></div></div>
      <section className="panel">
        <label className="field-label" htmlFor="draft-title">{t("セット名")}</label>
        <input id="draft-title" className="title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <h2>{t("抽出された要点")}</h2>
        <ul>{draft.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul>
      </section>
      <section>
        <div className="section-row"><h2>{t("AIが")}{draft.cards.length}{t("枚を提案しました")}</h2><button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onRegenerate(); } catch (e) { setError(e instanceof Error ? e.message : t("再生成できませんでした。")); } finally { setBusy(false); } }}><IconLabel name="refresh">{t("再生成")}</IconLabel></button></div>
        <div className="candidate-toolbar"><strong>{selectedCards.length}{t("枚を選択中")}</strong><span>{t("カードごとに登録する・しないを選べます")}</span><button type="button" onClick={toggleAll}>{allSelected ? t("すべて解除") : t("すべて選択")}</button></div>
        <div className="edit-card-list">
          {draft.cards.map((card, index) => (
            <article key={card.draftId} className={card.selected ? "is-selected" : "is-excluded"}>
              <div className="number">{index + 1}</div>
              <button type="button" className="candidate-toggle" aria-pressed={card.selected} onClick={() => toggleCard(card.draftId)}>{card.selected ? <IconLabel name="check">{t("登録する")}</IconLabel> : t("登録しない")}</button>
              <span className="format-badge">{card.format === "multiple_choice" ? t("4択問題") : card.format === "self_explain" ? t("自分で解説") : t("一問一答")}</span>
              <label>{t("質問")}<input disabled={!card.selected} value={card.question} onChange={(e) => updateCard(card.draftId, "question", e.target.value)} /></label>
              <label>{t("答え")}<textarea disabled={!card.selected} value={card.answer} onChange={(e) => updateCard(card.draftId, "answer", e.target.value)} /></label>
              {card.format === "multiple_choice" && <div className="choice-editor"><strong>{t("選択肢")}</strong>{card.choices.map((choice, choiceIndex) => <label key={`${card.draftId}-choice-${choiceIndex}`}><span>{choiceIndex + 1}</span><input disabled={!card.selected} value={choice} onChange={(e) => updateChoice(card.draftId, choiceIndex, e.target.value)} /></label>)}</div>}
            </article>
          ))}
        </div>
      </section>
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
      <DestinationPicker data={data} value={destination} onChange={setDestination} disabled={busy} />
      <div className="sticky-actions">
        <button className="secondary" onClick={() => setDraft({ ...draft, cards: [...draft.cards, { draftId: crypto.randomUUID(), selected: true, question: "", answer: "", difficulty: 2, format: "qa", choices: [] }] })}><IconLabel name="plus">{t("カードを追加")}</IconLabel></button>
        <button className="primary" onClick={save} disabled={busy || !selectedCards.length}>{busy ? t("保存中…") : <IconLabel name="check">{t("選択した{0}枚を登録", selectedCards.length)}</IconLabel>}</button>
      </div>
    </div>
  );
}

function SetDetail({ data, selectedSetId, selectSet, startStudy, now, onData, focusedCardId }: {
  data: AppData;
  selectedSetId: string | null;
  focusedCardId?: string | null;
  selectSet: (id: string) => void;
  startStudy: (setId: string, startCardId?: string, batchSize?: number) => void;
  now: Date;
  onData: (data: AppData) => void;
}) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [managing, setManaging] = useState(false);
  useEffect(() => { if (focusedCardId) document.getElementById(`set-card-${focusedCardId}`)?.focus(); }, [focusedCardId]);
  const set = data.sets.find((item) => item.id === selectedSetId) || data.sets[0];
  if (!set) return <div className="page empty-panel"><h1>{t("カードセットがありません")}</h1><p>{t("文章を取り込んで、最初のセットを作りましょう。")}</p></div>;
  const activeCards = set.cards.filter(isActiveCard);
  const counts = {
    due: activeCards.filter((card) => card.status === "復習待ち").length,
    learning: activeCards.filter((card) => card.status === "定着中").length,
    weak: activeCards.filter((card) => card.status === "苦手").length,
    new: activeCards.filter((card) => card.status === "未学習").length,
  };
  if (managing) return <div className="page set-page">
    <div className="set-view-toolbar"><h1>{t("教材を編集")}</h1><button className="secondary" onClick={() => setManaging(false)}>{t("閲覧に戻る")}</button></div>
    <MaterialManager key={set.id} set={set} onData={onData} />
  </div>;
  return (
    <div className="page set-page">
      <div className="set-view-toolbar"><span /><button className="secondary" onClick={() => setManaging(true)}>{t("カードセットを編集")}</button></div>
      <section className="set-hero"><span className="big-icon" aria-hidden="true">{setEmoji(set)}</span><div><p>{set.category}</p><h1>{set.title}</h1><span>{set.summary}</span></div></section>
      <div className="set-meta">
        <div><span className="set-meta-icon" aria-hidden="true"><img src="/set-meta-icons/cards.png" width={1254} height={1254} alt="" /></span><span><small>{t("カード数")}</small><strong>{t("{0}枚", activeCards.length)}</strong></span></div>
        <div><span className="set-meta-icon" aria-hidden="true"><img src="/set-meta-icons/last-studied.png" width={1254} height={1254} alt="" /></span><span><small>{t("最終学習日")}</small><strong>{relativeDate(set.lastStudiedAt, now, language)}</strong></span></div>
        <div><span className="set-meta-icon" aria-hidden="true"><img src="/set-meta-icons/next-review.png" width={1254} height={1254} alt="" /></span><span><small>{t("次の復習日")}</small><strong>{relativeDate(set.nextReviewAt, now, language)}</strong></span></div>
      </div>
      <button className="primary wide" disabled={!activeCards.length} onClick={() => startStudy(set.id)}>{t("このセットを学習")}</button>
      <section className="memory-panel">
        <div className="section-row"><h2>{t("記憶の状態")}</h2></div>
        <div className="memory-grid">
          {[["復習待ち", counts.due, "🕒"], ["定着中", counts.learning, "🌱"], ["苦手", counts.weak, "💪"], ["未学習", counts.new, "📖"]].map((m) => <div key={m[0] as string}><span aria-hidden="true">{m[2]}</span><small>{t(String(m[0]))}</small><strong>{m[1]}<i>{t("枚")}</i></strong></div>)}
        </div>
      </section>
      <section>
        <div className="section-row"><h2>{t("カード一覧")}</h2><span className="muted">{activeCards.length}{t("枚")}</span></div>
        <div className="topic-list">
          {activeCards.map((card, index) => <button id={`set-card-${card.id}`} key={card.id} onClick={() => startStudy(set.id, card.id)}><span>{index + 1}</span><div><strong>{card.question}</strong><small>{card.answer}</small></div><i>{t(card.status)}</i><em>{relativeDate(card.dueAt, now, language)}　➡️</em></button>)}
        </div>
      </section>

    </div>
  );
}

function Study({ session, updateSession, data, queue, flipped, setFlipped, setQueue, sessionDone, setSessionDone, sessionSetId, sessionId, sessionTotal, sessionMistakes, setSessionMistakes, startStudy, setData, backToSets, goHome, onPause, now }: {
  session: StudySession;
  updateSession: React.Dispatch<React.SetStateAction<StudySession>>;
  data: AppData;
  queue: string[];
  flipped: boolean;
  setFlipped: (value: boolean) => void;
  setQueue: (value: string[]) => void;
  sessionDone: boolean;
  setSessionDone: (value: boolean) => void;
  sessionSetId: string | null;
  sessionId: string;
  sessionTotal: number;
  sessionMistakes: number;
  setSessionMistakes: React.Dispatch<React.SetStateAction<number>>;
  startStudy: (setId?: string, startCardId?: string, batchSize?: number) => void;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  backToSets: () => void;
  goHome: () => void;
  onPause: () => void;
  now: Date;
}) {
  const { t, language, locale, setLanguage } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragX, setDragX] = useState(0);
  const [gestureMessage, setGestureMessage] = useState("");
  const [correctFeedback, setCorrectFeedback] = useState(false);
  const [dailyCelebration, setDailyCelebration] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const { selectedChoice, aiOpen, aiInput, aiCompose } = session;
  const setSelectedChoice = (selectedChoice: string | null) => updateSession((s) => ({ ...s, selectedChoice }));
  const setAiOpen = (aiOpen: boolean) => updateSession((s) => ({ ...s, aiOpen }));
  const setAiInput = (aiInput: string) => updateSession((s) => ({ ...s, aiInput }));
  const setAiCompose = (aiCompose: boolean) => updateSession((s) => ({ ...s, aiCompose }));
  const aiRequestPending = useRef(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [sessionAiMessages, setSessionAiMessages] = useState<ChatMessage[]>(() => data.chatMessages.filter((message) => message.sessionId === sessionId));
  const [summaryCards, setSummaryCards] = useState<DraftCard[]>([]);
  const [summaryKeyPoints, setSummaryKeyPoints] = useState<string[]>([]);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summarySaved, setSummarySaved] = useState(false);
  const shownAt = useRef(0);
  const busyRef = useRef(false);
  const summaryStarted = useRef(false);
  const dragOrigin = useRef<{ x: number; y: number; moved: boolean; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  const flashcardTapRef = useRef<HTMLButtonElement>(null);
  const card = data.sets.flatMap((item) => item.cards).find((item) => item.id === queue[0]);
  const set = data.sets.find((item) => item.id === card?.setId) || data.sets.find((item) => item.id === sessionSetId);
  const cardMessages = sessionAiMessages.filter((message) => message.cardId === card?.id);

  useEffect(() => {
    shownAt.current = currentTimeMs();
  }, [card?.id]);
  useEffect(() => {
    if (flipped && selectedChoice) flashcardTapRef.current?.focus();
  }, [flipped, selectedChoice]);

  const summarizeAiHistory = async (messages: ChatMessage[]) => {
    if (!messages.length || summaryStarted.current) return;
    summaryStarted.current = true;
    setSummaryBusy(true);
    setSummaryError("");
    const instruction = "このレッスン中にAIと深掘りした内容を、新しく学んだ知識として要約してください。";
    const conversation = messages.map((message) => `${message.role === "user" ? "学習者" : "AIチューター"}: ${message.content}`).join("\n\n");
    const transcript = `${instruction}\n\n${conversation.slice(-28500)}`;
    try {
      const material = await api<GeneratedMaterial>("/api/ai/cards", {
        method: "POST",
        body: JSON.stringify({ text: transcript, detail: "要点のみ", style: "一問一答", mode: "lesson_summary", language }),
      });
      setSummaryKeyPoints(material.keyPoints);
      setSummaryCards(material.cards.map((item) => ({ ...item, draftId: crypto.randomUUID(), selected: true })));
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "AI解説を要約できませんでした。");
    } finally {
      setSummaryBusy(false);
    }
  };

  const askAi = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || aiBusy || aiRequestPending.current || busyRef.current || !card || !set) return;
    aiRequestPending.current = true;
    setAiCompose(true);
    const createdAt = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `pending-${crypto.randomUUID()}`,
      setId: set.id,
      cardId: card.id,
      sessionId,
      role: "user",
      content: question,
      createdAt,
    };
    setSessionAiMessages((current) => [...current, userMessage]);
    setData((current) => ({ ...current, chatMessages: [...current.chatMessages, userMessage] }));
    setAiInput("");
    setAiBusy(true);
    setAiError("");
    try {
      const result = await api<{ answer: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          question,
          depth: "かんたん",
          language,
          setId: set.id,
          cardId: card.id,
        }),
      });
      const assistant: ChatMessage = {
        id: `answer-${crypto.randomUUID()}`,
        setId: set.id,
        cardId: card.id,
        sessionId,
        role: "assistant",
        content: result.answer,
        createdAt: new Date().toISOString(),
      };
      setSessionAiMessages((current) => [...current, assistant]);
      setData((current) => ({ ...current, chatMessages: [...current.chatMessages, assistant] }));
    } catch (e) {
      setSessionAiMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setData((current) => ({ ...current, chatMessages: current.chatMessages.filter((message) => message.id !== userMessage.id) }));
      setAiInput(question);
      setAiError(e instanceof Error ? e.message : "AIに質問できませんでした。");
    } finally {
      aiRequestPending.current = false;
      setAiBusy(false);
    }
  };

  const openAiExplanation = () => {
    setAiOpen(true);
    setAiCompose(Boolean(aiInput.trim()));
  };

  const submitVerdict = async (verdict: LessonVerdict) => {
    if (!card || !flipped || busy || aiBusy || busyRef.current) return;
    const resolvedVerdict: LessonVerdict = card.format === "multiple_choice" && selectedChoice
      ? selectedChoice === card.answer ? "correct" : "incorrect"
      : verdict;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ data: AppData; reviewId: string }>("/api/data", {
        method: "POST",
        body: JSON.stringify({
          action: "reviewCard",
          sessionId,
          cardId: card.id,
          rating: resolvedVerdict === "correct" ? "good" : "again",
          responseMs: currentTimeMs() - shownAt.current,
        }),
      });
      updateSession((current) => ({ ...current, undo: studyUndoCheckpoint(session, result.reviewId) }));
      setData(result.data);
      if (!mounted.current) return;
      if (resolvedVerdict === "correct") {
        setDragX(0);
        setCorrectFeedback(true);
        await new Promise((resolve) => window.setTimeout(resolve, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 620));
        if (!mounted.current) return;
        setCorrectFeedback(false);
      }
      if (!data.dailyReview.completed && result.data.dailyReview.completed && result.data.dailyReview.cardIds.length > 0) {
        setDailyCelebration(true);
      }
      const nextQueue = advanceLessonQueue(queue, resolvedVerdict);
      setQueue(nextQueue);
      if (resolvedVerdict === "incorrect") {
        setSessionMistakes((count) => count + 1);
        setGestureMessage("もう一度学ぶカードとして、列の後ろへ戻しました。");
      } else {
        setGestureMessage(nextQueue.length ? t("このカードは完了。残り{0}枚です。", nextQueue.length) : "すべてのカードが完了しました。");
      }
      setFlipped(false);
      setSelectedChoice(null);
      setAiOpen(false);
      setAiInput("");
      shownAt.current = currentTimeMs();
      if (resolvedVerdict === "correct" && nextQueue.length === 0) {
        if (session.remaining?.length) updateSession((current) => ({ ...current, batchDone: true }));
        else { setSessionDone(true); void summarizeAiHistory(sessionAiMessages); }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "評価を保存できませんでした。");
    } finally {
      busyRef.current = false;
      setBusy(false);
      setDragX(0);
    }
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (busy || aiBusy || (card?.format === "multiple_choice" && selectedChoice)) return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, moved: false, horizontal: false };
    suppressClick.current = false;
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const origin = dragOrigin.current;
    if (!origin || busy || aiBusy) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) origin.moved = true;
    if (!origin.horizontal && Math.abs(dx) > Math.abs(dy) + 8) {
      origin.horizontal = true;
      // Capture only a confirmed swipe so taps still click the inner button.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (origin.horizontal && flipped) setDragX(Math.max(-180, Math.min(180, dx)));
  };
  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    suppressClick.current = origin.moved;
    dragOrigin.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragX(0);
    if (origin.horizontal && flipped && Math.abs(dx) >= 80) {
      void submitVerdict(dx > 0 ? "correct" : "incorrect");
    } else if (origin.moved && !flipped) {
      setGestureMessage("まず回答を表示してください。");
    }
  };
  const cancelDrag = (event: React.PointerEvent<HTMLElement>) => {
    suppressClick.current = Boolean(dragOrigin.current?.moved);
    dragOrigin.current = null;
    setDragX(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const toggleCard = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (busy || aiBusy) return;
    if (!flipped && card?.format === "multiple_choice") {
      setGestureMessage("4つの選択肢から答えを選んでください。");
      return;
    }
    const next = !flipped;
    setFlipped(next);
    setSelectedChoice(null);
    setAiOpen(false);
    setGestureMessage("");
  };

  const addSummaryCards = async () => {
    if (!set) return;
    const selected = summaryCards.filter((item) => item.selected);
    if (!selected.length) return;
    setSummaryBusy(true);
    setSummaryError("");
    try {
      const result = await api<{ data: AppData }>("/api/data", {
        method: "POST",
        body: JSON.stringify({
          action: "addCardsToSet",
          setId: set.id,
          cards: selected.map(({ question, answer, difficulty, format, choices }) => ({ question, answer, difficulty, format, choices })),
        }),
      });
      setData(result.data);
      setSummarySaved(true);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "カードを追加できませんでした。");
    } finally {
      setSummaryBusy(false);
    }
  };

  const retrySummary = () => {
    summaryStarted.current = false;
    void summarizeAiHistory(sessionAiMessages);
  };

  const undoLastReview = async () => {
    if (!session.undo || busyRef.current || aiBusy) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const result = await api<{ data: AppData }>("/api/data", { method: "POST", body: JSON.stringify({ action: "undoReview", sessionId, reviewId: session.undo.reviewId }) });
      setData(result.data);
      updateSession((current) => restoreStudyUndo(current));
      setCorrectFeedback(false); setDailyCelebration(false); setGestureMessage(t("一つ前のカードに戻りました。"));
      shownAt.current = currentTimeMs();
    } catch (e) { setError(e instanceof Error ? e.message : "評価を取り消せませんでした。"); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const undoButton = session.undo && <button type="button" className="undo-review-button" disabled={busy || aiBusy} onClick={undoLastReview}>{t("一つ前のカードに戻る")}</button>;
  if (session.editDraft && card) return <StudyCardEditor draft={session.editDraft} format={card.format} onChange={(editDraft) => updateSession((current) => ({ ...current, editDraft }))} onPause={onPause} onCancel={() => updateSession((current) => ({ ...current, editDraft: null }))} onSaved={(updated) => { setData(updated); updateSession((current) => ({ ...current, editDraft: null, flipped: false, selectedChoice: null })); }} />;
  if (session.batchDone && session.remaining?.length) return <div className="page batch-complete">
    {dailyCelebration && <ReviewCelebration onDismiss={() => setDailyCelebration(false)} />}
    <span className="batch-medal"><AssetIcon name="check" size={64} /></span><h1>{t("{0}枚、おつかれさま！", session.batchTotal || 5)}</h1><p>{t("残り{0}枚。続けるか、ここでひと休みできます。", session.remaining.length)}</p>
    <button className="primary wide" onClick={() => updateSession((current) => nextStudyBatch(current))} disabled={busy}>{t("次の{0}枚へ", Math.min(5, session.remaining.length))}</button>
    <button className="secondary wide" onClick={onPause} disabled={busy}>{t("今日はここまで")}</button>
    {undoButton}{error && <p className="inline-error" role="alert">{t(error)}</p>}
  </div>;
  if (sessionDone) {
    const selectedSummaryCount = summaryCards.filter((item) => item.selected).length;
    return (
      <div className="page session-complete">
        {dailyCelebration && <ReviewCelebration onDismiss={() => setDailyCelebration(false)} />}
        <span><AssetIcon name="check" size={64} /></span><p className="completion-label">COMPLETE</p><h1>{t("レッスンが終了しました")}</h1>
        <div className="lesson-result"><div><small>{t("完了したカード")}</small><strong>{sessionTotal}{t("枚")}</strong></div><div><small>{t("もう一度")}</small><strong>{sessionMistakes}{t("回")}</strong></div></div>
        {set?.nextReviewAt && <div className="completion-review"><span>{t("🕒 次のおすすめ復習")}</span><strong>{relativeDate(set.nextReviewAt, now, language)}</strong><small>{formatDate(new Date(set.nextReviewAt), locale, "review")}<br />{t("エビングハウスの忘却曲線を参考にした復習タイミングです。")}</small></div>}
        {sessionAiMessages.length > 0 && (
          <section className="lesson-ai-recap">
            <details className="recap-conversation">
            <summary className="recap-heading"><AssetIcon name="sparkles" /><h2>{t("このレッスンでAIと深掘りしたこと")}</h2><span className="recap-chevron-closed"><AssetIcon name="chevron-down" size={16} /></span><span className="recap-chevron-open"><AssetIcon name="chevron-up" size={16} /></span></summary>
            <div className="recap-thread">{sessionAiMessages.map((message) => <article key={message.id} className={message.role}><small>{message.role === "user" ? t("あなた") : t("AI解説")}</small><p>{message.content}</p></article>)}</div>
            </details>
            <div className="ai-summary-block">
              <h3>{t("AIによる学びの要約")}</h3>
              {summaryBusy && !summaryCards.length && <p className="summary-status">{t("解説を要約し、新しいカード候補を作っています…")}</p>}
              {summaryKeyPoints.length > 0 && <ul>{summaryKeyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul>}
              {summaryCards.length > 0 && <div className="summary-card-list">{summaryCards.map((item) => <button key={item.draftId} type="button" aria-pressed={item.selected} className={item.selected ? "selected" : ""} onClick={() => setSummaryCards((cards) => cards.map((cardItem) => cardItem.draftId === item.draftId ? { ...cardItem, selected: !cardItem.selected } : cardItem))}><span>{item.selected ? <IconLabel name="check">{t("追加する")}</IconLabel> : t("追加しない")}</span><strong>{item.question}</strong><small>{item.answer}</small></button>)}</div>}
              {summaryCards.length > 0 && <button className="primary wide" disabled={summaryBusy || summarySaved || !selectedSummaryCount} onClick={addSummaryCards}>{summarySaved ? <IconLabel name="check">{t("新しいカードを追加しました")}</IconLabel> : t("選択した{0}枚をこのセットへ追加", selectedSummaryCount)}</button>}
              {summaryError && <div className="summary-retry"><p className="inline-error" role="alert">{t(summaryError)}</p><button type="button" className="secondary" onClick={retrySummary}>{t("要約を再試行")}</button></div>}
            </div>
          </section>
        )}
        {undoButton}{error && <p className="inline-error" role="alert">{t(error)}</p>}
        <div className="completion-actions"><button className="primary" onClick={goHome}>{t("ホームで確認")}</button>{set && <button className="secondary" onClick={() => startStudy(set.id)}>{t("もう一度学習")}</button>}</div>
      </div>
    );
  }
  if (!queue.length || !card || !set) return <div className="page empty-panel"><h1>{t("学習するカードがありません")}</h1><p>{t("カードセットを作るか、セット画面から学習を開始してください。")}</p><button className="primary" onClick={goHome}>{t("ホームで確認")}</button></div>;
  const progressTotal = session.batchSize ? session.batchTotal || sessionTotal : sessionTotal;
  const completed = Math.max(0, progressTotal - queue.length);
  const progress = progressTotal ? Math.round((completed / progressTotal) * 100) : 0;
  return (
    <div className="page study-page">
      {dailyCelebration && <ReviewCelebration onDismiss={() => setDailyCelebration(false)} />}
      <div className="study-header"><button className="secondary pause-study" disabled={busy || aiBusy} onClick={onPause}>{t("中断する")}</button><h1>{set.title}</h1><span /></div>
      <div className="study-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progressTotal} aria-valuenow={completed}><span style={{ width: `${progress}%` }} /><b>{t("残り")}{queue.length}{t("枚")}</b></div>
      <div className="study-tools">{undoButton}<button type="button" className="edit-study-button" disabled={busy || aiBusy} onClick={() => updateSession((current) => ({ ...current, editDraft: { cardId: card.id, question: card.question, answer: card.answer, choices: [...card.choices] } }))}>{t("このカードを修正")}</button></div>
      <article
        key={`flashcard:${card.id}`}
        className={`flashcard ${correctFeedback || (flipped && selectedChoice === card.answer) ? "answer-correct" : ""} ${flipped ? "flipped" : ""} ${dragX > 8 ? "swiping-right" : ""} ${dragX < -8 ? "swiping-left" : ""}`}
        style={{ transform: `translateX(${dragX}px) rotate(${Math.max(-4, Math.min(4, dragX / 35))}deg)` }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onPointerLeave={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) cancelDrag(event);
        }}
        onKeyDown={(event) => {
          if (!flipped || busy || aiBusy || (card.format === "multiple_choice" && selectedChoice)) return;
          if (event.key === "ArrowLeft") { event.preventDefault(); void submitVerdict("incorrect"); }
          if (event.key === "ArrowRight") { event.preventDefault(); void submitVerdict("correct"); }
        }}
      >
        <button ref={flashcardTapRef} className="flashcard-tap" type="button" onClick={toggleCard} aria-pressed={flipped} aria-label={flipped ? t("回答を表示中") : card.format === "multiple_choice" ? t("質問。選択肢から回答") : t("質問。タップして回答を表示")}>
          <span key={`${card.id}:${flipped ? "answer" : "question"}`} className={`flashcard-content ${flipped ? "showing-answer" : "showing-question"} ${(flipped ? card.answer : card.question).length > 120 ? "long-content" : ""}`}>
            <span className="chip blue">{flipped ? t("回答") : card.format === "multiple_choice" ? t("4択問題") : t("質問")}</span>
            <strong aria-live="polite">{flipped ? card.answer : card.question}</strong>
            {!flipped && <small className={card.format !== "multiple_choice" ? "card-tap-hint" : undefined}>{card.format === "multiple_choice" ? t("答えを1つ選んでください") : t("タップで回答を表示")}</small>}
          </span>
        </button>
        {(correctFeedback || (flipped && selectedChoice === card.answer)) && <span className="correct-check" role="status" aria-label={t("正解です。")}><AssetIcon name="check" size={46} /></span>}
        {!flipped && card.format === "multiple_choice" && <div className="study-choice-grid">{card.choices.map((choice) => <button key={choice} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setSelectedChoice(choice); setFlipped(true); setGestureMessage(t("答えを確認し、「選択結果を記録」で次へ進みます。")); }}>{choice}</button>)}</div>}
        {flipped && selectedChoice && <p role="status" aria-live="polite" className={`choice-feedback ${selectedChoice === card.answer ? "is-correct" : "is-incorrect"}`}>{t("選んだ答え：")}{selectedChoice}{t("。")}{selectedChoice === card.answer ? t("正解です。") : t("正解は「{0}」です。", card.answer)}</p>}
        {flipped && <button type="button" className="card-ai-button" disabled={busy || aiBusy} onPointerDown={(event) => event.stopPropagation()} onClick={openAiExplanation}><IconLabel name="sparkles">{t("AIに解説してもらう")}</IconLabel></button>}
      </article>
      <p className="study-sr-only" role="status">{busy ? t("学習記録を保存しています…") : aiBusy ? t("AIが解説を作成しています…") : t(gestureMessage)}</p>
      {aiOpen && (
        <section className="inline-ai-panel">
          <div className="inline-ai-header"><div><span><AssetIcon name="sparkles" /></span><h2>{t("AI解説")}</h2></div><button type="button" aria-label={t("AI解説を閉じる")} disabled={aiBusy} onClick={() => setAiOpen(false)}><AssetIcon name="close" size={20} /></button></div>
          {!cardMessages.length && !aiBusy && <div className="ai-start-options">
            <button type="button" className="primary" disabled={busy} onClick={() => void askAi(t("このカードの答えを、理由と具体例を含めてわかりやすく解説してください。"))}>{t("解説してもらう")}</button>
            <button type="button" className="secondary" aria-pressed={aiCompose} onClick={() => setAiCompose(true)}>{t("自分で質問する")}</button>
          </div>}
          <div className="chat-thread" aria-live="polite">
            {cardMessages.map((message) => message.role === "user" ? <div className="user-bubble" key={message.id}>{message.content}</div> : <article className="ai-answer" key={message.id}><span className="ai-spark"><AssetIcon name="sparkles" size={24} /></span><div className="answer-text">{message.content}</div></article>)}
            {aiBusy && <article className="ai-answer ai-thinking"><span className="ai-spark"><AssetIcon name="sparkles" size={24} /></span><p>{t("解説を考えています…")}</p></article>}
          </div>
          {cardMessages.length > 0 && <div className="suggestions">{["もっと簡単に", "具体例を教えて", "なぜ重要？"].map((suggestion) => <button type="button" key={t(suggestion)} onClick={() => setAiInput(t(suggestion))}>{t(suggestion)}</button>)}</div>}
          {aiError && <p className="inline-error" role="alert">{t(aiError)}</p>}
          {(aiCompose || cardMessages.length > 0) && <div className="chat-input"><input autoFocus value={aiInput} onChange={(event) => setAiInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void askAi(aiInput); }} placeholder={t(cardMessages.length ? "追加で質問する…" : "質問を入力する…")} aria-label={t(cardMessages.length ? "AIへの追加質問" : "AIへの質問")} /><button type="button" onClick={() => askAi(aiInput)} disabled={aiBusy || !aiInput.trim()} aria-label={t("質問を送信")}>⬆️</button></div>}
        </section>
      )}
      {card.format === "multiple_choice" && selectedChoice ? (
        <button className="primary wide record-choice" disabled={busy || aiBusy} onClick={() => submitVerdict(selectedChoice === card.answer ? "correct" : "incorrect")}>{selectedChoice === card.answer ? <IconLabel name="check">{t("選択結果を記録して次へ")}</IconLabel> : <IconLabel name="refresh">{t("選択結果を記録して後でもう一度")}</IconLabel>}</button>
      ) : (
        <div className="swipe-actions compact" aria-label={t("スワイプ操作の代替ボタン")}>
          <button className="incorrect" disabled={!flipped || busy || aiBusy} onClick={() => submitVerdict("incorrect")}><b>⬅️</b><span><strong>{t("まだ覚えていない")}</strong></span></button>
          <button className="correct" disabled={!flipped || busy || aiBusy} onClick={() => submitVerdict("correct")}><span><strong>{t("覚えていた")}</strong></span><b>➡️</b></button>
        </div>
      )}

      {flipped && <details key={`source:${card.id}`} className="source-details"><summary>{t("元の文章を確認")}</summary><p>{set.sourceContent}</p></details>}
      {error && <p className="inline-error" role="alert">{t(error)}</p>}
    </div>
  );
}

function Records({ data, now, startStudy }: { data: AppData; now: Date; startStudy: (setId: string, startCardId?: string) => void }) {
  const { t, language, locale } = useLanguage();
  const days = Array.from({ length: 7 }, (_, index) => new Date(now.getTime() - (6 - index) * 86400000));
  const dayData = days.map((date) => {
    const day = dayKey(date);
    const count = data.recordActivity
      ? data.recordActivity.find((entry) => entry.day === day)?.cards || 0
      : new Set(data.reviews.filter((review) => ["good", "easy"].includes(review.rating) && dayKey(new Date(review.reviewedAt)) === day).map((review) => review.cardId)).size;
    return { date, count };
  });
  const maxDailyReviews = Math.max(1, ...dayData.map((day) => day.count));
  const weekReviews = dayData.reduce((sum, day) => sum + day.count, 0);
  const milestones = memoryMilestones(data.sets);
  const streak = data.dailyReview.streak;
  const weak = data.sets.flatMap((set) => set.cards.map((card) => ({ card, set }))).filter(({ card }) => card.status === "苦手");
  const aiHistory = data.chatMessages.reduce<Array<{ message: ChatMessage; question: string; card: Card | undefined; setTitle: string }>>((history, message, index) => {
    if (message.role !== "assistant") return history;
    const previous = data.chatMessages[index - 1];
    const historyCard = data.sets.flatMap((item) => item.cards).find((item) => item.id === message.cardId);
    const historySet = data.sets.find((item) => item.id === message.setId || item.id === historyCard?.setId);
    history.push({
      message,
      question: previous?.role === "user" && previous.sessionId === message.sessionId && previous.cardId === message.cardId ? previous.content : "AIに解説してもらう",
      card: historyCard,
      setTitle: historySet?.title || "教材",
    });
    return history;
  }, []).reverse().slice(0, 8);
  return (
    <div className="page records-page">
      <div className="page-heading"><div><h1>{t("学習の記録")}</h1></div></div>
      <section className="chart-panel">
        <div className="section-row"><div><h2>{t("記憶し直したカード数")}</h2><small className="muted">{t("直近7日間")}</small></div><p>{t("合計")}<strong>{weekReviews}{t("枚")}</strong></p></div>
        <div className="bar-chart">{dayData.map((day) => <div key={dayKey(day.date)}><span style={{ height: `${day.count === 0 ? 2 : Math.max(4, day.count / maxDailyReviews * 90)}px` }}><i>{day.count}{language === "ja" && t("枚")}</i></span><b>{new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", weekday: "short" }).format(day.date)}</b></div>)}</div>
      </section>
      <div className="record-stats">
        {[["streak", "連続学習", t("{0}日", streak)], ["cards", "直近7日間の学習", t("{0}枚", weekReviews)], ["recall", "長期記憶したカード数", t("{0}枚", milestones.longTerm)], ["cards", "もう少しで長期記憶に到達するカード数", t("{0}枚", milestones.nearLongTerm)], ["accuracy", "学習し切ったセット数", t("{0}セット", milestones.completedSets)]].map(([icon, label, value], index) => (
          <article key={label} className={index < 2 ? "record-stat-summary" : "record-stat-memory"}>
            <span className="record-stat-icon" aria-hidden="true"><img src={`/record-icons/${icon}.png`} width={1254} height={1254} alt="" loading="lazy" /></span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section><div className="section-row"><h2>{t("復習リマインド")}</h2></div><div className="reminder-list">{data.sets.slice(0, 5).map((set) => { const due = set.cards.filter((card) => isDue(card, now)).length; return <button key={set.id} onClick={() => startStudy(set.id)}><AssetIcon name="clock" size={26} /><div><strong>{due ? t("{0}枚のカードが復習待ち", due) : t("{0}の次回復習", set.title)}</strong><small>{set.title}</small></div><em>{relativeDate(set.nextReviewAt, now, language)}　➡️</em></button>; })}</div></section>
      <details className="ai-history-disclosure"><summary>{t("AI解説の学習履歴")}</summary><div className="ai-history-list">{aiHistory.length ? aiHistory.map(({ message, question, card: historyCard, setTitle }) => <details key={message.id}><summary><span><span><AssetIcon name="sparkles" /></span><small>{setTitle}{t("・")}{relativeDate(message.createdAt, now, language)}</small></span><strong>{historyCard?.question || question}</strong></summary><p className="history-question">{t("あなた：")}{question}</p><p>{message.content}</p></details>) : <p className="list-empty">{t("学習中にAIへ質問すると、解説がここへ保存されます。")}</p>}</div></details>
      <section><div className="section-row"><h2>{t("苦手カード")}</h2><span className="muted">{weak.length}{t("枚")}</span></div><div className="weak-list">{weak.length ? weak.slice(0, 8).map(({ card, set }) => <button key={card.id} onClick={() => startStudy(set.id, card.id)}><i>{set.category}</i><strong>{card.question}</strong><span>{t("復習")}{card.reviewCount}{t("回　➡️")}</span></button>) : <p className="list-empty">{t("苦手カードはまだありません。")}</p>}</div></section>
    </div>
  );
}

function App() {
  const { t, language, locale, setLanguage } = useLanguage();
  const now = useClock();
  const activeDay = dayKey(now);
  const [screen, setScreen] = useState<Screen>("home");
  const [data, setData] = useState<AppData | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [setDetailOpen, setSetDetailOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const { workspace, setWorkspace, workspaceReady, saveError } = useWorkspace();
  const { destination, draft, lastGeneration, importDraft } = workspace;
  const session = workspace.session || EMPTY_SESSION;
  const { queue, flipped, done: sessionDone, setId: sessionSetId, id: sessionId, total: sessionTotal, mistakes: sessionMistakes } = session;
  function updateField<K extends keyof Workspace>(key: K, value: React.SetStateAction<Workspace[K]>) {
    setWorkspace((w) => ({ ...w, [key]: typeof value === "function" ? (value as (current: Workspace[K]) => Workspace[K])(w[key]) : value }));
  }
  const setDestination = (value: string) => updateField("destination", value);
  const setDraft = (value: DraftMaterial | null) => updateField("draft", value);
  const setImportDraft: React.Dispatch<React.SetStateAction<ImportDraft>> = (value) => updateField("importDraft", value);
  const updateSession: React.Dispatch<React.SetStateAction<StudySession>> = (value) => setWorkspace((w) => {
    if (!w.session || w.session.id !== sessionId) return w;
    return { ...w, session: typeof value === "function" ? value(w.session) : value };
  });
  const setQueue = (queue: string[]) => updateSession((s) => ({ ...s, queue }));
  const setFlipped = (flipped: boolean) => updateSession((s) => ({ ...s, flipped }));
  const setSessionDone = (done: boolean) => updateSession((s) => ({ ...s, done }));
  const setSessionMistakes: React.Dispatch<React.SetStateAction<number>> = (value) => updateSession((s) => ({ ...s, mistakes: typeof value === "function" ? value(s.mistakes) : value }));
  const resumeStudy = (saved: StudySession) => {
    if (!data) return;
    const restored = { ...reconcileSession(saved, data), returnTo: studyReturnTarget(screen, saved.setId, saved.returnTo) };
    setWorkspace((w) => activateSession(w, restored));
    setSelectedSetId(restored.setId);
    setScreen("study");
  };
  const pauseStudy = () => {
    if (!data) return;
    const target = resolveStudyReturn(session, data);
    if (target.screen === "sets") {
      setSelectedSetId(target.setId);
      setFolderId(data.sets.find((set) => set.id === target.setId)?.folderId || null);
      setFocusedCardId(null);
      setSetDetailOpen(true);
    }
    setScreen(target.screen);
  };

  const reload = async () => {
    try {
      const loaded = await api<AppData>("/api/data");
      setWorkspace((w) => reconcileWorkspace(w, loaded));
      setData(loaded);
      setSelectedSetId((current) => current || loaded.sets[0]?.id || null);
      setLoadingError("");
    } catch (e) { setLoadingError(e instanceof Error ? e.message : "データを読み込めませんでした。"); }
  };
  useEffect(() => {
    if (!workspaceReady) return;
    let active = true;
    api<AppData>("/api/data").then((loaded) => {
      if (!active) return;
      setWorkspace((w) => reconcileWorkspace(w, loaded));
      setData(loaded);
      setSelectedSetId((current) => current || loaded.sets[0]?.id || null);
      setLoadingError("");
    }).catch((error) => {
      if (active) setLoadingError(error instanceof Error ? error.message : "データを読み込めませんでした。");
    });
    return () => { active = false; };
  }, [activeDay, workspaceReady, setWorkspace]);

  const generate = async (text: string, detail: string, style: string) => {
    const material = await api<GeneratedMaterial>("/api/ai/cards", {
      method: "POST",
      body: JSON.stringify({ text, detail, style, language }),
    });
    setDraft({
      ...material,
      sourceContent: text,
      cards: material.cards.map((card) => ({ ...card, draftId: crypto.randomUUID(), selected: true })),
    });
    updateField("lastGeneration", { text, detail, style });
    setScreen("generate");
  };

  const startStudy = (setId?: string, startCardId?: string, batchSize?: number) => {
    if (!data) return;
    const memorySetId = setId?.startsWith("__memory__:") ? setId.slice("__memory__:".length) : undefined;
    const daily = setId?.startsWith("__daily__") || setId === "__due__";
    const dailySetId = setId?.startsWith("__daily__:") ? setId.slice("__daily__:".length) : undefined;
    const dailyPending = new Set(data.dailyReview.cardIds.filter((id) => !data.dailyReview.completedCardIds.includes(id)));
    const target = data.sets.find((set) => set.id === (memorySetId || dailySetId || setId)) || data.sets.find((set) => set.id === selectedSetId) || data.sets[0];
    if (!target) { setScreen("sets"); return; }
    const scope = setId || target.id;
    const previous = [workspace.session, ...workspace.pausedSessions].find((saved) => saved && saved.scope === scope && !saved.done && pendingStudyCount(saved));
    if (!startCardId && previous) { resumeStudy(batchSize && !previous.batchSize ? startStudyBatch(previous, batchSize) : previous); return; }
    const due = target.cards.filter((card) => isDue(card, now)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const scheduledCards = memorySetId ? target.cards.filter((card) => isLongTermDue(card, now)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()) : daily ? data.sets.filter((set) => !dailySetId || set.id === dailySetId).flatMap((set) => set.cards).filter((card) => isActiveCard(card) && dailyPending.has(card.id)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()) : due.length ? due : target.cards.filter(isActiveCard);
    const requestedCard = startCardId ? target.cards.find((card) => card.id === startCardId && isActiveCard(card)) : undefined;
    const cards = requestedCard ? [requestedCard, ...scheduledCards.filter((card) => card.id !== requestedCard.id)] : scheduledCards;
    setSelectedSetId(target.id);
    const nextSession = { ...EMPTY_SESSION, id: `lesson_${crypto.randomUUID()}`, scope, setId: target.id, queue: cards.map((card) => card.id), total: cards.length, returnTo: studyReturnTarget(screen, target.id, session.returnTo) };
    setWorkspace((w) => activateSession(w, batchSize ? startStudyBatch(nextSession, batchSize) : nextSession));
    setScreen("study");
  };

  const navigate = (next: Screen) => {
    if (next === "sets") setSetDetailOpen(false);
    setScreen(next);
  };

  if (!data || !workspaceReady) return <Shell screen={screen} setScreen={navigate}><div className="page loading-state" aria-live="polite">{loadingError ? <><h1>{t("読み込めませんでした")}</h1><p>{t(loadingError)}</p><button className="primary" onClick={reload}>{t("再読み込み")}</button></> : <><span><AssetIcon name="sparkles" /></span><p>{t("学習データを準備しています…")}</p></>}</div></Shell>;

  const saveDraft = async () => {
    if (!draft) return;
    const selectedCards = draft.cards.filter((card) => card.selected).map(({ question, answer, difficulty, format, choices }) => ({ question, answer, difficulty, format, choices }));
    const targetSetId = destination.startsWith("set:") ? destination.slice(4) : null;
    const targetFolderId = destination.startsWith("folder:") ? destination.slice(7) : null;
    const result = await api<{ setId?: string; data: AppData }>("/api/data", {
      method: "POST",
      body: JSON.stringify(targetSetId ? {
        action: "addCardsToSet", setId: targetSetId, cards: selectedCards, sourceContent: draft.sourceContent, sourceTitle: draft.title,
      } : {
        action: "saveSet",
        material: { folderId: targetFolderId, title: draft.title, category: draft.category, summary: draft.summary, keyPoints: draft.keyPoints, sourceContent: draft.sourceContent, cards: selectedCards },
      }),
    });
    const savedSetId = targetSetId || result.setId || null;
    setData(result.data);
    setSelectedSetId(savedSetId);
    setFolderId(result.data.sets.find((set) => set.id === savedSetId)?.folderId || null);
    setSetDetailOpen(true);
    setWorkspace((w) => ({ ...w, draft: null, importDraft: EMPTY_IMPORT, lastGeneration: null }));
    setScreen("sets");
  };
  const updateData: React.Dispatch<React.SetStateAction<AppData>> = (value) => {
    setData((current) => {
      if (!current) return current;
      return typeof value === "function" ? value(current) : value;
    });
  };

  let content: React.ReactNode;
  let title: string | undefined;
  if (screen === "home") content = <Home data={data} now={now} startStudy={startStudy} setScreen={setScreen} selectSet={(id) => { setSelectedSetId(id); setSetDetailOpen(true); }} resumableSessions={[session, ...workspace.pausedSessions].filter((s) => s.id && !s.done && pendingStudyCount(s))} onResume={resumeStudy} onSample={async () => {
      const result = await api<{ data: AppData }>("/api/data", { method: "POST", body: JSON.stringify({ action: "sample", language }) });
      const sample = result.data.sets[0];
      setData(result.data);
      if (sample) {
        setSelectedSetId(sample.id);
        const cards = sample.cards.filter(isActiveCard);
        setWorkspace((w) => activateSession(w, { ...EMPTY_SESSION, id: `lesson_${crypto.randomUUID()}`, scope: sample.id, setId: sample.id, queue: cards.map((c) => c.id), total: cards.length, returnTo: { screen: "home" } }));
        setScreen("study");
      }
    }} resumeDraft={draft || importDraft.text || importDraft.attachments.length ? () => setScreen(draft ? "generate" : "import") : undefined} />;
  else if (screen === "import") content = <ImportScreen importDraft={importDraft} setImportDraft={setImportDraft} onGenerate={generate} data={data} destination={destination} setDestination={setDestination} />;
  else if (screen === "generate") { content = <Generate data={data} destination={destination} setDestination={setDestination} draft={draft} setDraft={setDraft} onSave={saveDraft} onRegenerate={async () => { if (lastGeneration) await generate(lastGeneration.text, lastGeneration.detail, lastGeneration.style); }} />; title = "カードの確認"; }
  else if (screen === "sets") { content = <SetLibrary data={data} folderId={folderId} openSetId={setDetailOpen ? selectedSetId : null} onFolder={(id) => { setFolderId(id); setSetDetailOpen(false); }} onSet={(id, cardId) => { setSelectedSetId(id); setFocusedCardId(cardId || null); setSetDetailOpen(true); }} onData={(updated) => { setData(updated); setWorkspace((w) => reconcileWorkspace(w, updated)); }} onAdd={() => { setDestination(folderId ? `folder:${folderId}` : "root"); setScreen("import"); }}>
      <SetDetail key={selectedSetId} focusedCardId={focusedCardId} data={data} selectedSetId={selectedSetId} selectSet={setSelectedSetId} startStudy={startStudy} now={now} onData={(updated) => { setData(updated); setWorkspace((w) => reconcileWorkspace(w, updated)); }} />
    </SetLibrary>; title = "カードセット"; }
  else if (screen === "study") content = <Study key={sessionId} session={session} updateSession={updateSession} data={data} queue={queue} flipped={flipped} setFlipped={setFlipped} setQueue={setQueue} sessionDone={sessionDone} setSessionDone={setSessionDone} sessionSetId={sessionSetId} sessionId={sessionId} sessionTotal={sessionTotal} sessionMistakes={sessionMistakes} setSessionMistakes={setSessionMistakes} startStudy={startStudy} setData={updateData} backToSets={() => { setSetDetailOpen(true); setScreen("sets"); }} goHome={() => setScreen("home")} onPause={pauseStudy} now={now} />;
  else content = <Records data={data} now={now} startStudy={(id) => { if (id) setSelectedSetId(id); setSetDetailOpen(true); setScreen("sets"); }} />;
  return <Shell screen={screen} setScreen={navigate} title={title}>{saveError && <p className="workspace-save-error" role="alert">{t("このブラウザーに途中の内容を保存できません。再読み込みすると下書きや学習の続きが失われる場合があります。")}</p>}{content}</Shell>;
}

export default function LocalizedApp() {
  return <LanguageProvider><App /></LanguageProvider>;
}
