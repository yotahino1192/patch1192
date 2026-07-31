"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AppData,
  Card,
  ChatMessage,
  GeneratedCard,
  GeneratedMaterial,
} from "../lib/types";
import { advanceLessonQueue, type LessonVerdict } from "../lib/review";

type Screen = "home" | "import" | "generate" | "sets" | "study" | "records";
type DraftCard = GeneratedCard & { draftId: string; selected: boolean };
type DraftMaterial = Omit<GeneratedMaterial, "cards"> & { sourceContent: string; cards: DraftCard[] };

const navItems: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "⌂" },
  { id: "sets", label: "セット", icon: "▱" },
  { id: "study", label: "学習", icon: "▤" },
  { id: "import", label: "教材追加", icon: "＋" },
  { id: "records", label: "記録", icon: "◎" },
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

const tokyoDateTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const tokyoShort = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "short",
  day: "numeric",
});
const tokyoTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
});
const tokyoReviewTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

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

function relativeDate(value: string | null, now: Date): string {
  if (!value) return "未学習";
  const date = new Date(value);
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < 60000) return "いま";
  if (diff > 0 && diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}分後`;
  if (diff < 0 && diff > -3600000) return `${Math.max(1, Math.round(-diff / 60000))}分前`;
  const today = dayKey(now);
  const target = dayKey(date);
  if (today === target) return diff >= 0 ? `今日 ${tokyoTime.format(date)}` : "今日";
  const tomorrow = dayKey(new Date(now.getTime() + 86400000));
  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  if (target === tomorrow) return `明日 ${tokyoTime.format(date)}`;
  if (target === yesterday) return "昨日";
  return tokyoShort.format(date);
}

function greeting(now: Date): string {
  const hour = tokyoParts(now).hour;
  if (hour < 11) return "おはよう";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

function isDue(card: Card, now: Date): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime() && card.status !== "アーカイブ";
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}>{children}</button>;
}

function Shell({ screen, setScreen, children, title }: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  children: React.ReactNode;
  title?: string;
}) {
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [screen]);
  return (
    <div className="app-shell">
      <header className="topbar">
        {title ? <IconButton label="ホームへ戻る" onClick={() => setScreen("home")}>‹</IconButton> : <span className="wordmark">Loop</span>}
        {title && <h1 className="screen-title">{title}</h1>}
        <span className="notification-indicator" aria-label="新しい通知はありません">♢</span>
      </header>
      <main ref={mainRef} tabIndex={-1}>{children}</main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        {navItems.map((item) => {
          const active = item.id === screen || (item.id === "import" && screen === "generate");
          return (
          <button
            key={item.id}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            onClick={() => { if (!active) setScreen(item.id); }}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
          );
        })}
      </nav>
    </div>
  );
}

function Home({ data, now, startStudy, setScreen, selectSet, resumeDraft }: {
  data: AppData;
  now: Date;
  startStudy: (setId?: string) => void;
  setScreen: (screen: Screen) => void;
  selectSet: (id: string) => void;
  resumeDraft?: () => void;
}) {
  const allCards = data.sets.flatMap((set) => set.cards);
  const activeCards = allCards.filter((card) => card.status !== "アーカイブ");
  const dueCards = activeCards.filter((card) => isDue(card, now)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const todayReviews = data.reviews.filter((review) => dayKey(new Date(review.reviewedAt)) === dayKey(now));
  const todayCorrect = new Set(todayReviews.filter((review) => ["good", "easy"].includes(review.rating)).map((review) => review.cardId));
  const nextCard = dueCards[0] || activeCards.filter((card) => !isDue(card, now)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  const nextSet = data.sets.find((set) => set.id === nextCard?.setId);
  const focus = dueCards[0] || allCards[0];
  const focusSet = data.sets.find((set) => set.id === focus?.setId);
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="spark" aria-hidden="true">✦</div>
        <div>
          <time className="eyebrow" dateTime={now.toISOString()}>{tokyoDateTime.format(now)}</time>
          <h1>{greeting(now)}、Yota</h1>
          <p>今日も知識のループを回して、理解を深めよう。</p>
        </div>
      </section>

      <section className={`review-card ${dueCards.length ? "is-due" : "is-planned"}`}>
        <div className="review-clock" aria-hidden="true">{dueCards.length ? "↻" : "◷"}</div>
        <div className="review-copy">
          <p className="accent-label">{dueCards.length ? "今が復習タイミング" : "次のおすすめ復習"}</p>
          <h2>{dueCards.length ? `${dueCards.length}枚を復習しましょう` : nextCard ? relativeDate(nextCard.dueAt, now) : "復習予定はありません"}</h2>
          <p className="muted">{nextCard && nextSet ? `${nextSet.title} ・ ${tokyoReviewTime.format(new Date(nextCard.dueAt))}` : "新しい教材を追加して学習を始めましょう"}</p>
          {todayCorrect.size > 0 && <p className="today-result">✓ 今日は{todayCorrect.size}枚を正解しました</p>}
        </div>
        <button className="review-cta" onClick={() => {
          if (dueCards.length) startStudy(nextSet?.id);
          else if (nextSet) { selectSet(nextSet.id); setScreen("sets"); }
        }} disabled={!nextCard}>{dueCards.length ? "復習する" : "確認する"}</button>
        <div className="spacing-guide">
          <span>忘れる前の復習ペース</span>
          <strong>1日 → 3日 → 7日 → 14日 → 30日…</strong>
          <small>エビングハウスの忘却曲線を参考に、学習履歴から調整します。</small>
        </div>
      </section>

      {focus && focusSet && (
        <section className="focus-card">
          <div className="section-row"><h2>今日のフォーカス</h2><span className="muted">{focus.status}</span></div>
          <button className="focus-content" onClick={() => startStudy(focusSet.id)}>
            <span className="chip blue">✦ 理解を深める</span>
            <strong>{focus.question}</strong>
            <span><i>{focusSet.category}</i> 思考レベル：{"★".repeat(focus.difficulty)}{"☆".repeat(3 - focus.difficulty)}</span>
            <b>›</b>
          </button>
        </section>
      )}

      <section>
        <div className="section-row"><h2>最近のセット</h2><button onClick={() => setScreen("sets")}>すべて見る</button></div>
        <div className="set-grid">
          {data.sets.slice(0, 3).map((set, index) => (
            <button key={set.id} className={`set-tile ${["blue-set", "green-set", "violet-set"][index % 3]}`} onClick={() => { selectSet(set.id); setScreen("sets"); }}>
              <span aria-hidden="true">{["⌘", "⌂", "⌁"][index % 3]}</span>
              <strong>{set.title}</strong>
              <small>{set.cards.length}枚のカード</small>
              <em>最終学習：{relativeDate(set.lastStudiedAt, now)}　●</em>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-row"><h2>おすすめの次の学習</h2></div>
        <div className="recommend-list">
          {data.sets.slice(0, 4).map((set) => {
            const due = set.cards.filter((card) => isDue(card, now)).length;
            return <button key={set.id} onClick={() => startStudy(set.id)}><span>↻</span><strong>{set.title}</strong><i>{set.category}</i><em>{due ? `残り ${due}枚` : "自由学習"}　›</em></button>;
          })}
        </div>
      </section>

      {resumeDraft && <button className="resume-draft" onClick={resumeDraft}>編集中のカード候補に戻る <span>›</span></button>}
      <button className="floating-add" onClick={() => setScreen("import")}><span>＋</span> 新しい教材を追加</button>
    </div>
  );
}

function ImportScreen({ onGenerate }: { onGenerate: (text: string, detail: string, style: string) => Promise<void> }) {
  const [source, setSource] = useState("ChatGPT");
  const [detail, setDetail] = useState("標準");
  const [style, setStyle] = useState("一問一答");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (text.trim().length < 80) {
      setError("カードを作るには80文字以上の文章を貼り付けてください。");
      return;
    }
    setBusy(true);
    setError("");
    try { await onGenerate(text.trim(), detail, style); }
    catch (e) { setError(e instanceof Error ? e.message : "解析できませんでした。"); }
    finally { setBusy(false); }
  };
  return (
    <div className="page import-page">
      <div className="page-heading"><div><h1>教材を追加</h1><p>文章を貼り付けると、AIが学びやすいカードへ整理します。</p></div><span className="help" title="文章を貼り付けてAIでカードに変換します">?</span></div>
      <h2>情報のソースを選ぶ</h2>
      <div className="source-grid" role="radiogroup" aria-label="情報のソース">
        {[["ChatGPT", "✺", "ChatGPTの会話"], ["Web記事", "◎", "Web記事"], ["ノート", "▤", "ノート"], ["その他", "▧", "その他の文章"]].map(([id, icon, label]) =>
          <button key={id} role="radio" aria-checked={source === id} className={source === id ? "selected" : ""} onClick={() => setSource(id)}><span>{icon}</span>{label}</button>)}
      </div>
      <label className="field-label" htmlFor="source-text">内容を貼り付ける</label>
      <textarea id="source-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="ここに文章を貼り付けてください…&#10;例）ChatGPTとの会話、記事の本文、授業ノートなど" maxLength={30000} />
      <p className="counter">{text.length.toLocaleString()} / 30,000</p>
      <h2>取り込み設定</h2>
      <OptionGroup label="情報の粒度" values={["要点のみ", "標準", "詳しく"]} value={detail} setValue={setDetail} />
      <fieldset className="format-group">
        <legend>学習形式</legend>
        <div className="format-grid">
          {[
            ["一問一答", "Q", "質問を見て、答えを思い出す"],
            ["4択問題", "4", "4つの選択肢から正解を選ぶ"],
            ["自分で解説", "話", "自分の言葉で説明して理解を確認"],
          ].map(([name, icon, description]) => (
            <button
              type="button"
              key={name}
              aria-pressed={style === name}
              className={`format-option ${style === name ? "selected" : ""}`}
              onClick={() => setStyle(name)}
            >
              <span>{icon}</span>
              <strong>{name}</strong>
              <small>{description}</small>
              {name === "自分で解説" && <em>準備中</em>}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="auto-count-note"><span>✦</span><div><strong>カード枚数はAIが自動で決定</strong><small>教材の長さと論点数を分析し、必要十分な枚数を提案します。</small></div></div>
      {style === "自分で解説" && <p className="coming-soon-note">「自分で解説」は近日対応予定です。導線を先に用意しています。</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary wide" onClick={submit} disabled={busy || text.trim().length < 80 || style === "自分で解説"} aria-busy={busy}>{busy ? "教材を分析して、カード枚数を決めています…" : style === "自分で解説" ? "自分で解説は準備中です" : "✦ AIでカードを作る"}</button>
      <p className="secure">♙ APIキーはサーバー側で安全に管理されます</p>
    </div>
  );
}

function OptionGroup({ label, values, value, setValue }: { label: string; values: string[]; value: string; setValue: (value: string) => void }) {
  return <fieldset className="option-group"><legend>{label}</legend><div>{values.map((v) => <button type="button" key={v} aria-pressed={v === value} className={v === value ? "selected" : ""} onClick={() => setValue(v)}>{v}</button>)}</div></fieldset>;
}

function Generate({ draft, setDraft, onSave, onRegenerate }: {
  draft: DraftMaterial | null;
  setDraft: (draft: DraftMaterial) => void;
  onSave: () => Promise<void>;
  onRegenerate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!draft) return <div className="page empty-panel"><h1>生成する教材がありません</h1><p>「新しい教材を追加」から文章を取り込んでください。</p></div>;
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
      <div className="success-banner"><span>✓</span><div><h2>解析完了</h2><p>要点とカード候補を生成しました。保存前に編集できます。</p></div><b>✦</b></div>
      <section className="panel">
        <label className="field-label" htmlFor="draft-title">セット名</label>
        <input id="draft-title" className="title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <h2>抽出された要点</h2>
        <ul>{draft.keyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul>
      </section>
      <section>
        <div className="section-row"><h2>AIが{draft.cards.length}枚を提案しました</h2><button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onRegenerate(); } catch (e) { setError(e instanceof Error ? e.message : "再生成できませんでした。"); } finally { setBusy(false); } }}>↻ 再生成</button></div>
        <div className="candidate-toolbar"><strong>{selectedCards.length}枚を選択中</strong><span>カードごとに登録する・しないを選べます</span><button type="button" onClick={toggleAll}>{allSelected ? "すべて解除" : "すべて選択"}</button></div>
        <div className="edit-card-list">
          {draft.cards.map((card, index) => (
            <article key={card.draftId} className={card.selected ? "is-selected" : "is-excluded"}>
              <div className="number">{index + 1}</div>
              <button type="button" className="candidate-toggle" aria-pressed={card.selected} onClick={() => toggleCard(card.draftId)}>{card.selected ? "✓ 登録する" : "登録しない"}</button>
              <span className="format-badge">{card.format === "multiple_choice" ? "4択問題" : card.format === "self_explain" ? "自分で解説" : "一問一答"}</span>
              <label>質問<input disabled={!card.selected} value={card.question} onChange={(e) => updateCard(card.draftId, "question", e.target.value)} /></label>
              <label>答え<textarea disabled={!card.selected} value={card.answer} onChange={(e) => updateCard(card.draftId, "answer", e.target.value)} /></label>
              {card.format === "multiple_choice" && <div className="choice-editor"><strong>選択肢</strong>{card.choices.map((choice, choiceIndex) => <label key={`${card.draftId}-choice-${choiceIndex}`}><span>{choiceIndex + 1}</span><input disabled={!card.selected} value={choice} onChange={(e) => updateChoice(card.draftId, choiceIndex, e.target.value)} /></label>)}</div>}
            </article>
          ))}
        </div>
      </section>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="sticky-actions">
        <button className="secondary" onClick={() => setDraft({ ...draft, cards: [...draft.cards, { draftId: crypto.randomUUID(), selected: true, question: "", answer: "", difficulty: 2, format: "qa", choices: [] }] })}>＋ カードを追加</button>
        <button className="primary" onClick={save} disabled={busy || !selectedCards.length}>{busy ? "保存中…" : `✓ 選択した${selectedCards.length}枚を登録`}</button>
      </div>
    </div>
  );
}

function SetDetail({ data, selectedSetId, selectSet, startStudy, now }: {
  data: AppData;
  selectedSetId: string | null;
  selectSet: (id: string) => void;
  startStudy: (setId: string, startCardId?: string) => void;
  now: Date;
}) {
  const set = data.sets.find((item) => item.id === selectedSetId) || data.sets[0];
  if (!set) return <div className="page empty-panel"><h1>カードセットがありません</h1><p>文章を取り込んで、最初のセットを作りましょう。</p></div>;
  const counts = {
    due: set.cards.filter((card) => isDue(card, now) && card.status !== "苦手").length,
    learning: set.cards.filter((card) => card.status === "定着中").length,
    weak: set.cards.filter((card) => card.status === "苦手").length,
    new: set.cards.filter((card) => card.status === "未学習").length,
  };
  return (
    <div className="page set-page">
      <div className="set-selector" aria-label="カードセットを選択">{data.sets.map((item) => <button aria-pressed={item.id === set.id} className={item.id === set.id ? "selected" : ""} key={item.id} onClick={() => selectSet(item.id)}>{item.title}</button>)}</div>
      <section className="set-hero"><span className="big-icon">⌘</span><div><p>{set.category}</p><h1>{set.title}</h1><span>{set.summary}</span></div><b>LOOP</b></section>
      <div className="set-meta"><span>▧ {set.cards.length}枚のカード</span><span>▣ 最終学習：{relativeDate(set.lastStudiedAt, now)}</span><span>◷ 次の復習：{relativeDate(set.nextReviewAt, now)}</span></div>
      <section className="memory-panel">
        <div className="section-row"><h2>記憶の状態</h2><span className="muted">自動更新</span></div>
        <div className="memory-grid">
          {[["復習待ち", counts.due, "blue-dot"], ["定着中", counts.learning, "green-dot"], ["苦手", counts.weak, "orange-dot"], ["未学習", counts.new, "gray-dot"]].map((m) => <div key={m[0] as string}><span className={m[2] as string}>●</span><small>{m[0]}</small><strong>{m[1]}<i>枚</i></strong></div>)}
        </div>
        <p className="memory-tip">✦ <strong>{counts.due + counts.new + counts.weak ? "今復習すると定着しやすいタイミングです" : "次の復習日まで定着を待ちましょう"}</strong><br /><span>学習履歴にもとづくスケジュールです。</span></p>
      </section>
      <section>
        <div className="section-row"><h2>カード一覧</h2><span className="muted">{set.cards.length}枚</span></div>
        <div className="topic-list">
          {set.cards.map((card, index) => <button key={card.id} onClick={() => startStudy(set.id, card.id)}><span>{index + 1}</span><div><strong>{card.question}</strong><small>{card.answer}</small></div><i>{card.status}</i><em>{relativeDate(card.dueAt, now)}　›</em></button>)}
        </div>
      </section>
      <button className="primary wide" onClick={() => startStudy(set.id)}>▤ このセットを学習<small>{set.cards.filter((card) => isDue(card, now)).length || set.cards.length}枚のカードから開始</small></button>
    </div>
  );
}

function Study({ data, queue, flipped, setFlipped, setQueue, sessionDone, setSessionDone, sessionSetId, sessionId, sessionTotal, sessionMistakes, setSessionMistakes, startStudy, setData, backToSets, goHome, now }: {
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
  startStudy: (setId?: string) => void;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  backToSets: () => void;
  goHome: () => void;
  now: Date;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragX, setDragX] = useState(0);
  const [gestureMessage, setGestureMessage] = useState("カードをタップして回答を確認してください。");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
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
        body: JSON.stringify({ text: transcript, detail: "要点のみ", style: "一問一答", mode: "lesson_summary" }),
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
    if (!question || aiBusy || !card || !set) return;
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
      setAiBusy(false);
    }
  };

  const openAiExplanation = () => {
    setAiOpen(true);
    if (!cardMessages.length) void askAi("このカードの答えを、理由と具体例を含めてわかりやすく解説してください。");
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
      const result = await api<{ data: AppData }>("/api/data", {
        method: "POST",
        body: JSON.stringify({
          action: "reviewCard",
          sessionId,
          cardId: card.id,
          rating: resolvedVerdict === "correct" ? "good" : "again",
          responseMs: currentTimeMs() - shownAt.current,
        }),
      });
      setData(result.data);
      const nextQueue = advanceLessonQueue(queue, resolvedVerdict);
      setQueue(nextQueue);
      if (resolvedVerdict === "incorrect") {
        setSessionMistakes((count) => count + 1);
        setGestureMessage("もう一度学ぶカードとして、列の後ろへ戻しました。");
      } else {
        setGestureMessage(nextQueue.length ? `このカードは完了。残り${nextQueue.length}枚です。` : "すべてのカードが完了しました。");
      }
      setFlipped(false);
      setSelectedChoice(null);
      setAiOpen(false);
      setAiInput("");
      shownAt.current = currentTimeMs();
      if (resolvedVerdict === "correct" && nextQueue.length === 0) {
        setSessionDone(true);
        void summarizeAiHistory(sessionAiMessages);
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
    if (busy || aiBusy || (card?.format === "multiple_choice" && selectedChoice)) return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, moved: false, horizontal: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const origin = dragOrigin.current;
    if (!origin || busy || aiBusy) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) origin.moved = true;
    if (!origin.horizontal && Math.abs(dx) > Math.abs(dy) + 8) origin.horizontal = true;
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
    setGestureMessage(next ? "左で「もう一度」、右で「できた」としてスワイプします。" : "カードをタップして回答を確認してください。");
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

  if (sessionDone) {
    const selectedSummaryCount = summaryCards.filter((item) => item.selected).length;
    return (
      <div className="page session-complete">
        <span>✓</span><p className="completion-label">COMPLETE</p><h1>レッスンが終了しました</h1>
        <p>{sessionTotal}枚すべてを完了しました。学習記録と復習スケジュールを更新しました。</p>
        <div className="lesson-result"><div><small>完了したカード</small><strong>{sessionTotal}枚</strong></div><div><small>もう一度</small><strong>{sessionMistakes}回</strong></div></div>
        {set?.nextReviewAt && <div className="completion-review"><span>◷ 次のおすすめ復習</span><strong>{relativeDate(set.nextReviewAt, now)}</strong><small>{tokyoReviewTime.format(new Date(set.nextReviewAt))}<br />エビングハウスの忘却曲線を参考にした復習タイミングです。</small></div>}
        {sessionAiMessages.length > 0 && (
          <section className="lesson-ai-recap">
            <div className="recap-heading"><span>✦</span><div><h2>このレッスンでAIと深掘りしたこと</h2><p>質問と解説は学習履歴へ自動保存されています。</p></div></div>
            <div className="recap-thread">{sessionAiMessages.map((message) => <article key={message.id} className={message.role}><small>{message.role === "user" ? "あなた" : "AI解説"}</small><p>{message.content}</p></article>)}</div>
            <div className="ai-summary-block">
              <h3>AIによる学びの要約</h3>
              {summaryBusy && !summaryCards.length && <p className="summary-status">解説を要約し、新しいカード候補を作っています…</p>}
              {summaryKeyPoints.length > 0 && <ul>{summaryKeyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul>}
              {summaryCards.length > 0 && <div className="summary-card-list">{summaryCards.map((item) => <button key={item.draftId} type="button" aria-pressed={item.selected} className={item.selected ? "selected" : ""} onClick={() => setSummaryCards((cards) => cards.map((cardItem) => cardItem.draftId === item.draftId ? { ...cardItem, selected: !cardItem.selected } : cardItem))}><span>{item.selected ? "✓ 追加する" : "追加しない"}</span><strong>{item.question}</strong><small>{item.answer}</small></button>)}</div>}
              {summaryCards.length > 0 && <button className="primary wide" disabled={summaryBusy || summarySaved || !selectedSummaryCount} onClick={addSummaryCards}>{summarySaved ? "✓ 新しいカードを追加しました" : `選択した${selectedSummaryCount}枚をこのセットへ追加`}</button>}
              {summaryError && <div className="summary-retry"><p className="inline-error" role="alert">{summaryError}</p><button type="button" className="secondary" onClick={retrySummary}>要約を再試行</button></div>}
            </div>
          </section>
        )}
        <div className="completion-actions"><button className="primary" onClick={goHome}>ホームで確認</button>{set && <button className="secondary" onClick={() => startStudy(set.id)}>もう一度学習</button>}</div>
      </div>
    );
  }
  if (!queue.length || !card || !set) return <div className="page empty-panel"><h1>学習するカードがありません</h1><p>カードセットを作るか、セット画面から学習を開始してください。</p></div>;
  const completed = Math.max(0, sessionTotal - queue.length);
  const progress = sessionTotal ? Math.round((completed / sessionTotal) * 100) : 0;
  return (
    <div className="page study-page">
      <div className="study-header"><button aria-label="セットへ戻る" onClick={backToSets}>‹</button><h1>{set.category} / {set.title}</h1><span /></div>
      <div className="study-progress" role="progressbar" aria-valuemin={0} aria-valuemax={sessionTotal} aria-valuenow={completed}><span style={{ width: `${progress}%` }} /><b>残り {queue.length}枚</b></div>
      <article
        className={`flashcard ${flipped ? "flipped" : ""} ${dragX > 8 ? "swiping-right" : ""} ${dragX < -8 ? "swiping-left" : ""}`}
        style={{ transform: `translateX(${dragX}px) rotate(${Math.max(-4, Math.min(4, dragX / 35))}deg)` }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onKeyDown={(event) => {
          if (!flipped || busy || aiBusy || (card.format === "multiple_choice" && selectedChoice)) return;
          if (event.key === "ArrowLeft") { event.preventDefault(); void submitVerdict("incorrect"); }
          if (event.key === "ArrowRight") { event.preventDefault(); void submitVerdict("correct"); }
        }}
      >
        <button ref={flashcardTapRef} className="flashcard-tap" type="button" onClick={toggleCard} aria-pressed={flipped} aria-label={flipped ? "回答を表示中" : card.format === "multiple_choice" ? "質問。選択肢から回答" : "質問。タップして回答を表示"}>
          <span className="chip blue">{flipped ? "✦ 回答" : card.format === "multiple_choice" ? "4択問題" : "✦ 質問"}</span>
          <strong aria-live="polite">{flipped ? card.answer : card.question}</strong>
          <small>{flipped ? "左右にスワイプして学習結果を記録" : card.format === "multiple_choice" ? "答えを1つ選んでください" : "タップで回答を表示"}</small>
        </button>
        {!flipped && card.format === "multiple_choice" && <div className="study-choice-grid">{card.choices.map((choice) => <button key={choice} type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setSelectedChoice(choice); setFlipped(true); setGestureMessage("答えを確認し、「選択結果を記録」で次へ進みます。"); }}>{choice}</button>)}</div>}
        {flipped && selectedChoice && <p role="status" aria-live="polite" className={`choice-feedback ${selectedChoice === card.answer ? "is-correct" : "is-incorrect"}`}>選んだ答え：{selectedChoice}。{selectedChoice === card.answer ? "正解です。" : `正解は「${card.answer}」です。`}</p>}
        {flipped && <button type="button" className="card-ai-button" onPointerDown={(event) => event.stopPropagation()} onClick={openAiExplanation}>✦ AIに解説してもらう</button>}
      </article>
      <p className="gesture-message" aria-live="polite">{busy ? "学習記録を保存しています…" : aiBusy ? "AIが解説を作成しています…" : gestureMessage}</p>
      {aiOpen && (
        <section className="inline-ai-panel">
          <div className="inline-ai-header"><div><span>✦</span><h2>AI解説</h2><small>このカードの文脈を引き継いでいます</small></div><button type="button" aria-label="AI解説を閉じる" disabled={aiBusy} onClick={() => setAiOpen(false)}>×</button></div>
          <div className="chat-thread" aria-live="polite">
            {cardMessages.map((message) => message.role === "user" ? <div className="user-bubble" key={message.id}>{message.content}</div> : <article className="ai-answer" key={message.id}><span className="ai-spark">✦</span><div className="answer-text">{message.content}</div></article>)}
            {aiBusy && <article className="ai-answer ai-thinking"><span className="ai-spark">✦</span><p>解説を考えています…</p></article>}
          </div>
          {cardMessages.length > 0 && <div className="suggestions">{["もっと簡単に", "具体例を教えて", "なぜ重要？"].map((suggestion) => <button type="button" key={suggestion} onClick={() => setAiInput(suggestion)}>{suggestion}</button>)}</div>}
          {aiError && <p className="inline-error" role="alert">{aiError}</p>}
          <div className="chat-input"><input value={aiInput} onChange={(event) => setAiInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) void askAi(aiInput); }} placeholder="追加で質問する…" aria-label="AIへの追加質問" /><button type="button" onClick={() => askAi(aiInput)} disabled={aiBusy || !aiInput.trim()} aria-label="質問を送信">↑</button></div>
          <p className="auto-save-note">会話はこのレッスンの学習履歴へ自動保存されます。</p>
        </section>
      )}
      {card.format === "multiple_choice" && selectedChoice ? (
        <button className="primary wide record-choice" disabled={busy || aiBusy} onClick={() => submitVerdict(selectedChoice === card.answer ? "correct" : "incorrect")}>{selectedChoice === card.answer ? "✓ 選択結果を記録して次へ" : "↻ 選択結果を記録して後でもう一度"}</button>
      ) : (
        <div className="swipe-actions compact" aria-label="スワイプ操作の代替ボタン">
          <button className="incorrect" disabled={!flipped || busy || aiBusy} onClick={() => submitVerdict("incorrect")}><b>←</b><span><strong>後でもう一度</strong><small>列の後ろへ戻す</small></span></button>
          <button className="correct" disabled={!flipped || busy || aiBusy} onClick={() => submitVerdict("correct")}><span><strong>このカードを完了</strong><small>次のカードへ</small></span><b>→</b></button>
        </div>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  );
}

function Records({ data, now, startStudy }: { data: AppData; now: Date; startStudy: (setId: string, startCardId?: string) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => new Date(now.getTime() - (6 - index) * 86400000));
  const dayData = days.map((date) => {
    const reviews = data.reviews.filter((review) => dayKey(new Date(review.reviewedAt)) === dayKey(date));
    const minutes = Math.round(reviews.reduce((sum, review) => sum + review.responseMs, 0) / 60000);
    return { date, count: reviews.length, minutes };
  });
  const weekReviews = dayData.reduce((sum, day) => sum + day.count, 0);
  const positive = data.reviews.filter((review) => ["good", "easy"].includes(review.rating)).length;
  const accuracy = data.reviews.length ? Math.round((positive / data.reviews.length) * 100) : 0;
  const activeDays = new Set(data.reviews.map((review) => dayKey(new Date(review.reviewedAt))));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (!activeDays.has(dayKey(new Date(now.getTime() - i * 86400000)))) break;
    streak++;
  }
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
      <div className="page-heading"><div><h1>学習の記録</h1><p>学習すると、ここへ自動的に記録されます。</p></div></div>
      <section className="chart-panel">
        <div className="section-row"><h2>直近7日間</h2><p>合計 <strong>{weekReviews}枚</strong></p></div>
        <div className="bar-chart">{dayData.map((day) => <div key={dayKey(day.date)}><span style={{ height: `${Math.max(8, day.count * 18)}px` }}><i>{day.count}枚</i></span><b>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" }).format(day.date)}</b></div>)}</div>
      </section>
      <div className="stats-grid">{[["🔥", "連続学習", `${streak}日`, "今日まで"], ["▣", "今週の学習", `${weekReviews}枚`, `全期間 ${data.reviews.length}枚`], ["◎", "定着評価", `${accuracy}%`, "わかった＋覚えた"]].map((s) => <article key={s[1]}><span>{s[0]}</span><small>{s[1]}</small><strong>{s[2]}</strong><em>{s[3]}</em></article>)}</div>
      <section><div className="section-row"><h2>復習リマインド</h2><span className="muted">現在時刻で更新</span></div><div className="reminder-list">{data.sets.slice(0, 5).map((set) => { const due = set.cards.filter((card) => isDue(card, now)).length; return <button key={set.id} onClick={() => startStudy(set.id)}><span>◷</span><div><strong>{due ? `${due}枚のカードが復習待ち` : `${set.title}の次回復習`}</strong><small>{set.title}</small></div><em>{relativeDate(set.nextReviewAt, now)}　›</em></button>; })}</div></section>
      <section><div className="section-row"><h2>AI解説の学習履歴</h2><span className="muted">自動保存</span></div><div className="ai-history-list">{aiHistory.length ? aiHistory.map(({ message, question, card: historyCard, setTitle }) => <article key={message.id}><div><span>✦</span><small>{setTitle} ・ {relativeDate(message.createdAt, now)}</small></div><strong>{historyCard?.question || question}</strong><p className="history-question">あなた：{question}</p><p>{message.content}</p></article>) : <p className="list-empty">学習中にAIへ質問すると、解説がここへ保存されます。</p>}</div></section>
      <section><div className="section-row"><h2>苦手カード</h2><span className="muted">{weak.length}枚</span></div><div className="weak-list">{weak.length ? weak.slice(0, 8).map(({ card, set }) => <button key={card.id} onClick={() => startStudy(set.id, card.id)}><i>{set.category}</i><strong>{card.question}</strong><span>復習 {card.reviewCount}回　›</span></button>) : <p className="list-empty">苦手カードはまだありません。</p>}</div></section>
    </div>
  );
}

export default function App() {
  const now = useClock();
  const [screen, setScreen] = useState<Screen>("home");
  const [data, setData] = useState<AppData | null>(null);
  const [loadingError, setLoadingError] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftMaterial | null>(null);
  const [lastGeneration, setLastGeneration] = useState<{ text: string; detail: string; style: string } | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionSetId, setSessionSetId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [sessionKey, setSessionKey] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState(0);

  const reload = async () => {
    try {
      const loaded = await api<AppData>("/api/data");
      setData(loaded);
      setSelectedSetId((current) => current || loaded.sets[0]?.id || null);
      setLoadingError("");
    } catch (e) { setLoadingError(e instanceof Error ? e.message : "データを読み込めませんでした。"); }
  };
  useEffect(() => {
    let active = true;
    api<AppData>("/api/data").then((loaded) => {
      if (!active) return;
      setData(loaded);
      setSelectedSetId((current) => current || loaded.sets[0]?.id || null);
      setLoadingError("");
    }).catch((error) => {
      if (active) setLoadingError(error instanceof Error ? error.message : "データを読み込めませんでした。");
    });
    return () => { active = false; };
  }, []);

  const generate = async (text: string, detail: string, style: string) => {
    const material = await api<GeneratedMaterial>("/api/ai/cards", {
      method: "POST",
      body: JSON.stringify({ text, detail, style }),
    });
    setDraft({
      ...material,
      sourceContent: text,
      cards: material.cards.map((card) => ({ ...card, draftId: crypto.randomUUID(), selected: true })),
    });
    setLastGeneration({ text, detail, style });
    setScreen("generate");
  };

  const startStudy = (setId?: string, startCardId?: string) => {
    if (!data) return;
    const target = data.sets.find((set) => set.id === setId) || data.sets.find((set) => set.id === selectedSetId) || data.sets[0];
    if (!target) { setScreen("study"); return; }
    const due = target.cards.filter((card) => isDue(card, now)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const scheduledCards = due.length ? due : target.cards;
    const requestedCard = startCardId ? target.cards.find((card) => card.id === startCardId) : undefined;
    const cards = requestedCard ? [requestedCard, ...scheduledCards.filter((card) => card.id !== requestedCard.id)] : scheduledCards;
    setSelectedSetId(target.id);
    setQueue(cards.map((card) => card.id));
    setFlipped(false);
    setSessionDone(false);
    setSessionSetId(target.id);
    setSessionId(`lesson_${crypto.randomUUID()}`);
    setSessionKey((value) => value + 1);
    setSessionTotal(cards.length);
    setSessionMistakes(0);
    setScreen("study");
  };

  const navigate = (next: Screen) => {
    if (next === "study" && !queue.length) startStudy();
    else setScreen(next);
  };

  if (!data) return <Shell screen={screen} setScreen={navigate}><div className="page loading-state" aria-live="polite">{loadingError ? <><h1>読み込めませんでした</h1><p>{loadingError}</p><button className="primary" onClick={reload}>再読み込み</button></> : <><span>✦</span><p>学習データを準備しています…</p></>}</div></Shell>;

  const saveDraft = async () => {
    if (!draft) return;
    const selectedCards = draft.cards.filter((card) => card.selected).map(({ question, answer, difficulty, format, choices }) => ({ question, answer, difficulty, format, choices }));
    const result = await api<{ setId: string; data: AppData }>("/api/data", {
      method: "POST",
      body: JSON.stringify({
        action: "saveSet",
        material: {
          title: draft.title,
          category: draft.category,
          summary: draft.summary,
          keyPoints: draft.keyPoints,
          sourceContent: draft.sourceContent,
          cards: selectedCards,
        },
      }),
    });
    setData(result.data);
    setSelectedSetId(result.setId);
    setDraft(null);
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
  if (screen === "home") content = <Home data={data} now={now} startStudy={startStudy} setScreen={navigate} selectSet={setSelectedSetId} resumeDraft={draft ? () => setScreen("generate") : undefined} />;
  else if (screen === "import") content = <ImportScreen onGenerate={generate} />;
  else if (screen === "generate") { content = <Generate draft={draft} setDraft={setDraft} onSave={saveDraft} onRegenerate={async () => { if (lastGeneration) await generate(lastGeneration.text, lastGeneration.detail, lastGeneration.style); }} />; title = "カードの確認"; }
  else if (screen === "sets") { content = <SetDetail data={data} selectedSetId={selectedSetId} selectSet={setSelectedSetId} startStudy={startStudy} now={now} />; title = "カードセット"; }
  else if (screen === "study") content = <Study key={sessionKey} data={data} queue={queue} flipped={flipped} setFlipped={setFlipped} setQueue={setQueue} sessionDone={sessionDone} setSessionDone={setSessionDone} sessionSetId={sessionSetId} sessionId={sessionId} sessionTotal={sessionTotal} sessionMistakes={sessionMistakes} setSessionMistakes={setSessionMistakes} startStudy={startStudy} setData={updateData} backToSets={() => setScreen("sets")} goHome={() => setScreen("home")} now={now} />;
  else content = <Records data={data} now={now} startStudy={startStudy} />;
  return <Shell screen={screen} setScreen={navigate} title={title}>{content}</Shell>;
}
