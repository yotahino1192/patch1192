"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AppData,
  Card,
  ChatMessage,
  GeneratedMaterial,
} from "../lib/types";
import { advanceLessonQueue, type LessonVerdict } from "../lib/review";

type Screen = "home" | "import" | "generate" | "sets" | "study" | "ai" | "records";
type DraftMaterial = GeneratedMaterial & { sourceContent: string };

const navItems: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "⌂" },
  { id: "sets", label: "セット", icon: "▱" },
  { id: "study", label: "学習", icon: "▤" },
  { id: "ai", label: "AI", icon: "✦" },
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
  return (
    <div className="app-shell">
      <header className="topbar">
        {title ? <IconButton label="ホームへ戻る" onClick={() => setScreen("home")}>‹</IconButton> : <span className="wordmark">Loop</span>}
        {title && <h1 className="screen-title">{title}</h1>}
        <IconButton label="通知">♢<span className="notification-dot" /></IconButton>
      </header>
      <main>{children}</main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={screen === item.id ? "active" : ""}
            aria-current={screen === item.id ? "page" : undefined}
            onClick={() => setScreen(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Home({ data, now, startStudy, setScreen, selectSet }: {
  data: AppData;
  now: Date;
  startStudy: (setId?: string) => void;
  setScreen: (screen: Screen) => void;
  selectSet: (id: string) => void;
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

      <button className="floating-add" onClick={() => setScreen("import")}><span>＋</span> 新しい教材を追加</button>
    </div>
  );
}

function ImportScreen({ onGenerate }: { onGenerate: (text: string, detail: string, style: string, count: number) => Promise<void> }) {
  const [source, setSource] = useState("ChatGPT");
  const [detail, setDetail] = useState("標準");
  const [style, setStyle] = useState("一問一答");
  const [count, setCount] = useState(6);
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
    try { await onGenerate(text.trim(), detail, style, count); }
    catch (e) { setError(e instanceof Error ? e.message : "解析できませんでした。"); }
    finally { setBusy(false); }
  };
  return (
    <div className="page import-page">
      <div className="page-heading"><div><h1>インポート</h1><p>あらゆる情報を、覚えられる知識に変換。</p></div><span className="help" title="文章を貼り付けてAIでカードに変換します">?</span></div>
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
      <OptionGroup label="カードの形式" values={["一問一答", "理解重視", "用語中心"]} value={style} setValue={setStyle} />
      <div className="count-setting"><label htmlFor="card-count">生成する枚数</label><input id="card-count" type="range" min={3} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} /><strong>{count}枚</strong></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary wide" onClick={submit} disabled={busy || text.trim().length < 80} aria-busy={busy}>{busy ? "AIが要点を整理しています…" : "✦ AIで解析する"}</button>
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
  const updateCard = (index: number, key: "question" | "answer", value: string) => {
    const cards = draft.cards.map((card, i) => i === index ? { ...card, [key]: value } : card);
    setDraft({ ...draft, cards });
  };
  const save = async () => {
    if (draft.cards.some((card) => !card.question.trim() || !card.answer.trim())) {
      setError("空の質問または回答があります。");
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
        <div className="section-row"><h2>生成されたカード（{draft.cards.length}枚）</h2><button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onRegenerate(); } catch (e) { setError(e instanceof Error ? e.message : "再生成できませんでした。"); } finally { setBusy(false); } }}>↻ 再生成</button></div>
        <div className="edit-card-list">
          {draft.cards.map((card, index) => (
            <article key={index}>
              <div className="number">{index + 1}</div>
              <label>質問<input value={card.question} onChange={(e) => updateCard(index, "question", e.target.value)} /></label>
              <label>答え<textarea value={card.answer} onChange={(e) => updateCard(index, "answer", e.target.value)} /></label>
              <button className="delete" onClick={() => setDraft({ ...draft, cards: draft.cards.filter((_, i) => i !== index) })}>削除</button>
            </article>
          ))}
        </div>
      </section>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="sticky-actions">
        <button className="secondary" onClick={() => setDraft({ ...draft, cards: [...draft.cards, { question: "", answer: "", difficulty: 2 }] })}>＋ カードを追加</button>
        <button className="primary" onClick={save} disabled={busy || !draft.cards.length}>{busy ? "保存中…" : "✓ このセットを保存"}</button>
      </div>
    </div>
  );
}

function SetDetail({ data, selectedSetId, selectSet, startStudy, now }: {
  data: AppData;
  selectedSetId: string | null;
  selectSet: (id: string) => void;
  startStudy: (setId: string) => void;
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
      <div className="set-selector" aria-label="カードセットを選択">{data.sets.map((item) => <button className={item.id === set.id ? "selected" : ""} key={item.id} onClick={() => selectSet(item.id)}>{item.title}</button>)}</div>
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
          {set.cards.map((card, index) => <button key={card.id} onClick={() => startStudy(set.id)}><span>{index + 1}</span><div><strong>{card.question}</strong><small>{card.answer}</small></div><i>{card.status}</i><em>{relativeDate(card.dueAt, now)}　›</em></button>)}
        </div>
      </section>
      <button className="primary wide" onClick={() => startStudy(set.id)}>▤ このセットを学習<small>{set.cards.filter((card) => isDue(card, now)).length || set.cards.length}枚のカードから開始</small></button>
    </div>
  );
}

function Study({ data, queue, flipped, setFlipped, setQueue, sessionDone, setSessionDone, sessionSetId, sessionTotal, sessionMistakes, setSessionMistakes, startStudy, setData, openAi, backToSets, goHome, now }: {
  data: AppData;
  queue: string[];
  flipped: boolean;
  setFlipped: (value: boolean) => void;
  setQueue: (value: string[]) => void;
  sessionDone: boolean;
  setSessionDone: (value: boolean) => void;
  sessionSetId: string | null;
  sessionTotal: number;
  sessionMistakes: number;
  setSessionMistakes: React.Dispatch<React.SetStateAction<number>>;
  startStudy: (setId?: string) => void;
  setData: (data: AppData) => void;
  openAi: (cardId: string) => void;
  backToSets: () => void;
  goHome: () => void;
  now: Date;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragX, setDragX] = useState(0);
  const [gestureMessage, setGestureMessage] = useState("カードをタップして回答を確認してください。");
  const shownAt = useRef(0);
  const busyRef = useRef(false);
  const dragOrigin = useRef<{ x: number; y: number; moved: boolean; horizontal: boolean } | null>(null);
  const suppressClick = useRef(false);
  const card = data.sets.flatMap((set) => set.cards).find((item) => item.id === queue[0]);
  const set = data.sets.find((item) => item.id === card?.setId) || data.sets.find((item) => item.id === sessionSetId);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [card?.id]);

  const submitVerdict = async (verdict: LessonVerdict) => {
    if (!card || !flipped || busy) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError("");
    try {
      const result = await api<{ data: AppData }>("/api/data", {
        method: "POST",
        body: JSON.stringify({ action: "reviewCard", cardId: card.id, rating: verdict === "correct" ? "good" : "again", responseMs: Date.now() - shownAt.current }),
      });
      setData(result.data);
      const nextQueue = advanceLessonQueue(queue, verdict);
      setQueue(nextQueue);
      if (verdict === "incorrect") {
        setSessionMistakes((count) => count + 1);
        setGestureMessage("不正解。カードを列の後ろへ戻しました。");
      } else {
        setGestureMessage(nextQueue.length ? `正解。残り${nextQueue.length}枚です。` : "すべてのカードに正解しました。");
      }
      setFlipped(false);
      shownAt.current = Date.now();
      if (verdict === "correct" && nextQueue.length === 0) setSessionDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "評価を保存できませんでした。"); }
    finally {
      busyRef.current = false;
      setBusy(false);
      setDragX(0);
    }
  };

  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, moved: false, horizontal: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = dragOrigin.current;
    if (!origin || busy) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) origin.moved = true;
    if (!origin.horizontal && Math.abs(dx) > Math.abs(dy) + 8) origin.horizontal = true;
    if (origin.horizontal && flipped) setDragX(Math.max(-180, Math.min(180, dx)));
  };
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
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
      setGestureMessage("まずカードをタップして回答を確認してください。");
    }
  };
  const cancelDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    suppressClick.current = Boolean(dragOrigin.current?.moved);
    dragOrigin.current = null;
    setDragX(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const toggleCard = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (busy) return;
    const next = !flipped;
    setFlipped(next);
    setGestureMessage(next ? "左へ不正解、右へ正解としてスワイプします。" : "カードをタップして回答を確認してください。");
  };

  if (sessionDone) return (
    <div className="page session-complete">
      <span>✓</span><p className="completion-label">COMPLETE</p><h1>レッスンが終了しました</h1>
      <p>{sessionTotal}枚すべてに正解しました。学習記録と復習スケジュールを更新しました。</p>
      <div className="lesson-result"><div><small>定着したカード</small><strong>{sessionTotal}枚</strong></div><div><small>もう一度</small><strong>{sessionMistakes}回</strong></div></div>
      {set?.nextReviewAt && <div className="completion-review"><span>◷ 次のおすすめ復習</span><strong>{relativeDate(set.nextReviewAt, now)}</strong><small>{tokyoReviewTime.format(new Date(set.nextReviewAt))}<br />忘却曲線を参考にした復習タイミングです。</small></div>}
      <div className="completion-actions"><button className="primary" onClick={goHome}>ホームで確認</button>{set && <button className="secondary" onClick={() => startStudy(set.id)}>もう一度学習</button>}</div>
    </div>
  );
  if (!queue.length || !card || !set) return <div className="page empty-panel"><h1>学習するカードがありません</h1><p>カードセットを作るか、セット画面から学習を開始してください。</p></div>;
  const completed = Math.max(0, sessionTotal - queue.length);
  const progress = sessionTotal ? Math.round((completed / sessionTotal) * 100) : 0;
  return (
    <div className="page study-page">
      <div className="study-header"><button aria-label="セットへ戻る" onClick={backToSets}>‹</button><h1>{set.category} / {set.title}</h1><button aria-label="その他">•••</button></div>
      <div className="study-progress" role="progressbar" aria-valuemin={0} aria-valuemax={sessionTotal} aria-valuenow={completed}><span style={{ width: `${progress}%` }} /><b>残り {queue.length}枚</b></div>
      <button
        className={`flashcard ${flipped ? "flipped" : ""} ${dragX > 8 ? "swiping-right" : ""} ${dragX < -8 ? "swiping-left" : ""}`}
        style={{ transform: `translateX(${dragX}px) rotate(${Math.max(-4, Math.min(4, dragX / 35))}deg)` }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onClick={toggleCard}
        onKeyDown={(event) => {
          if (!flipped || busy) return;
          if (event.key === "ArrowLeft") { event.preventDefault(); void submitVerdict("incorrect"); }
          if (event.key === "ArrowRight") { event.preventDefault(); void submitVerdict("correct"); }
        }}
        aria-pressed={flipped}
        aria-label={flipped ? "回答。左へスワイプで不正解、右へスワイプで正解" : "質問。タップして回答を表示"}
      >
        <span className="swipe-stamp wrong">不正解</span><span className="swipe-stamp correct">正解</span>
        <span className="chip blue">{flipped ? "✦ 回答" : "✦ 質問"}</span>
        <strong aria-live="polite">{flipped ? card.answer : card.question}</strong>
        <small>{flipped ? "← 不正解　｜　正解 →" : "タップで回答を表示"}</small>
      </button>
      <p className="gesture-message" aria-live="polite">{busy ? "学習記録を保存しています…" : gestureMessage}</p>
      <div className="swipe-actions" aria-label="回答を評価">
        <button className="incorrect" disabled={!flipped || busy} onClick={() => submitVerdict("incorrect")}><b>←</b><span><strong>不正解</strong><small>後ろでもう一度</small></span></button>
        <button className="correct" disabled={!flipped || busy} onClick={() => submitVerdict("correct")}><span><strong>正解</strong><small>このカードは完了</small></span><b>→</b></button>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="study-tools"><button onClick={() => openAi(card.id)}>✦ このカードをAIに聞く</button></div>
    </div>
  );
}

function AiDive({ data, contextCardId, setData, createCards, backToStudy }: {
  data: AppData;
  contextCardId: string | null;
  setData: (data: AppData) => void;
  createCards: (text: string) => Promise<void>;
  backToStudy: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState("かんたん");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const card = data.sets.flatMap((set) => set.cards).find((item) => item.id === contextCardId);
  const set = data.sets.find((item) => item.id === card?.setId);
  const messages = data.chatMessages.filter((message) => contextCardId ? message.cardId === contextCardId : !message.cardId);
  const send = async () => {
    const content = question.trim();
    if (!content || busy) return;
    const userMessage: ChatMessage = { id: `pending-${crypto.randomUUID()}`, setId: set?.id || null, cardId: card?.id || null, role: "user", content, createdAt: new Date().toISOString() };
    setData({ ...data, chatMessages: [...data.chatMessages, userMessage] });
    setQuestion(""); setBusy(true); setError("");
    try {
      const result = await api<{ answer: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          question: content, depth, setId: set?.id, cardId: card?.id,
          cardQuestion: card?.question, cardAnswer: card?.answer,
          sourceContent: set?.sourceContent, category: set?.category,
          history: messages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
        }),
      });
      const assistant: ChatMessage = { id: `answer-${crypto.randomUUID()}`, setId: set?.id || null, cardId: card?.id || null, role: "assistant", content: result.answer, createdAt: new Date().toISOString() };
      setData({ ...data, chatMessages: [...data.chatMessages, userMessage, assistant] });
    } catch (e) {
      setData(data);
      setQuestion(content);
      setError(e instanceof Error ? e.message : "AIに質問できませんでした。");
    } finally { setBusy(false); }
  };
  const transcript = messages.map((message) => `${message.role === "user" ? "質問" : "回答"}: ${message.content}`).join("\n\n");
  return (
    <div className="page ai-page">
      <div className="study-header">{card ? <button aria-label="学習へ戻る" onClick={backToStudy}>‹</button> : <span />}<h1>AI深掘り</h1><button aria-label="その他">•••</button></div>
      <div className="context-chip">✦ {card && set ? `${set.title} / ${card.question}` : "自由質問"}</div>
      {!messages.length && (
        <section className="ai-empty">
          <span>✦</span>
          <h2>知りたいことを質問してください</h2>
          <p>{card ? "このカードの質問・回答・元資料を引き継いで答えます。" : "学習中の疑問を、AIチューターに相談できます。"}</p>
        </section>
      )}
      <div className="chat-thread" aria-live="polite">
        {messages.map((message) => message.role === "user"
          ? <div className="user-bubble" key={message.id}>{message.content}</div>
          : <article className="ai-answer" key={message.id}><span className="ai-spark">✦</span><div className="answer-text">{message.content}</div></article>)}
        {busy && <article className="ai-answer ai-thinking"><span className="ai-spark">✦</span><p>回答を考えています…</p></article>}
      </div>
      {!messages.length && <><p className="suggest-label">質問の例</p><div className="suggestions">{["もっと簡単に説明して", "具体例を教えて", "なぜ重要なの？"].map((s) => <button key={s} onClick={() => setQuestion(s)}>{s}</button>)}</div></>}
      <OptionGroup label="説明の深さ" values={["一言", "かんたん", "標準", "詳しく"]} value={depth} setValue={setDepth} />
      {messages.some((message) => message.role === "assistant") && <button className="primary wide" disabled={busy} onClick={() => createCards(transcript)}>✦ この対話からカードを作る</button>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="chat-input"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }} placeholder="質問を入力…" aria-label="AIへの質問" /><button onClick={send} disabled={busy || !question.trim()} aria-label="質問を送信">↑</button></div>
    </div>
  );
}

function Records({ data, now }: { data: AppData; now: Date }) {
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
  return (
    <div className="page records-page">
      <div className="page-heading"><div><h1>学習の記録</h1><p>学習すると、ここへ自動的に記録されます。</p></div></div>
      <section className="chart-panel">
        <div className="section-row"><h2>直近7日間</h2><p>合計 <strong>{weekReviews}枚</strong></p></div>
        <div className="bar-chart">{dayData.map((day) => <div key={dayKey(day.date)}><span style={{ height: `${Math.max(8, day.count * 18)}px` }}><i>{day.count}枚</i></span><b>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" }).format(day.date)}</b></div>)}</div>
      </section>
      <div className="stats-grid">{[["🔥", "連続学習", `${streak}日`, "今日まで"], ["▣", "今週の学習", `${weekReviews}枚`, `全期間 ${data.reviews.length}枚`], ["◎", "定着評価", `${accuracy}%`, "わかった＋覚えた"]].map((s) => <article key={s[1]}><span>{s[0]}</span><small>{s[1]}</small><strong>{s[2]}</strong><em>{s[3]}</em></article>)}</div>
      <section><div className="section-row"><h2>復習リマインド</h2><span className="muted">現在時刻で更新</span></div><div className="reminder-list">{data.sets.slice(0, 5).map((set) => { const due = set.cards.filter((card) => isDue(card, now)).length; return <button key={set.id}><span>◷</span><div><strong>{due ? `${due}枚のカードが復習待ち` : `${set.title}の次回復習`}</strong><small>{set.title}</small></div><em>{relativeDate(set.nextReviewAt, now)}　›</em></button>; })}</div></section>
      <section><div className="section-row"><h2>苦手カード</h2><span className="muted">{weak.length}枚</span></div><div className="weak-list">{weak.length ? weak.slice(0, 8).map(({ card, set }) => <button key={card.id}><i>{set.category}</i><strong>{card.question}</strong><span>復習 {card.reviewCount}回　›</span></button>) : <p className="list-empty">苦手カードはまだありません。</p>}</div></section>
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
  const [lastGeneration, setLastGeneration] = useState<{ text: string; detail: string; style: string; count: number } | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionSetId, setSessionSetId] = useState<string | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState(0);
  const [contextCardId, setContextCardId] = useState<string | null>(null);

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

  const generate = async (text: string, detail: string, style: string, count: number) => {
    const material = await api<GeneratedMaterial>("/api/ai/cards", {
      method: "POST",
      body: JSON.stringify({ text, detail, style, count }),
    });
    setDraft({ ...material, sourceContent: text });
    setLastGeneration({ text, detail, style, count });
    setScreen("generate");
  };

  const startStudy = (setId?: string) => {
    if (!data) return;
    const target = data.sets.find((set) => set.id === setId) || data.sets.find((set) => set.id === selectedSetId) || data.sets[0];
    if (!target) { setScreen("study"); return; }
    const due = target.cards.filter((card) => isDue(card, now)).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    const cards = due.length ? due : target.cards;
    setSelectedSetId(target.id);
    setQueue(cards.map((card) => card.id));
    setFlipped(false);
    setSessionDone(false);
    setSessionSetId(target.id);
    setSessionTotal(cards.length);
    setSessionMistakes(0);
    setContextCardId(cards[0]?.id || null);
    setScreen("study");
  };

  const navigate = (next: Screen) => {
    if (next === "study" && !queue.length) startStudy();
    else {
      if (next === "ai" && !contextCardId) {
        const current = data?.sets.find((set) => set.id === selectedSetId)?.cards[0];
        setContextCardId(current?.id || null);
      }
      setScreen(next);
    }
  };

  if (!data) return <Shell screen={screen} setScreen={navigate}><div className="page loading-state" aria-live="polite">{loadingError ? <><h1>読み込めませんでした</h1><p>{loadingError}</p><button className="primary" onClick={reload}>再読み込み</button></> : <><span>✦</span><p>学習データを準備しています…</p></>}</div></Shell>;

  const saveDraft = async () => {
    if (!draft) return;
    const result = await api<{ setId: string; data: AppData }>("/api/data", {
      method: "POST",
      body: JSON.stringify({ action: "saveSet", material: draft }),
    });
    setData(result.data);
    setSelectedSetId(result.setId);
    setDraft(null);
    setScreen("sets");
  };

  const createCardsFromChat = async (text: string) => {
    await generate(text, "標準", "理解重視", 3);
  };

  let content: React.ReactNode;
  let title: string | undefined;
  if (screen === "home") content = <Home data={data} now={now} startStudy={startStudy} setScreen={navigate} selectSet={setSelectedSetId} />;
  else if (screen === "import") content = <ImportScreen onGenerate={generate} />;
  else if (screen === "generate") { content = <Generate draft={draft} setDraft={setDraft} onSave={saveDraft} onRegenerate={async () => { if (lastGeneration) await generate(lastGeneration.text, lastGeneration.detail, lastGeneration.style, lastGeneration.count); }} />; title = "要点化とカード生成"; }
  else if (screen === "sets") { content = <SetDetail data={data} selectedSetId={selectedSetId} selectSet={setSelectedSetId} startStudy={startStudy} now={now} />; title = "カードセット"; }
  else if (screen === "study") content = <Study data={data} queue={queue} flipped={flipped} setFlipped={setFlipped} setQueue={setQueue} sessionDone={sessionDone} setSessionDone={setSessionDone} sessionSetId={sessionSetId} sessionTotal={sessionTotal} sessionMistakes={sessionMistakes} setSessionMistakes={setSessionMistakes} startStudy={startStudy} setData={setData} openAi={(cardId) => { setContextCardId(cardId); setScreen("ai"); }} backToSets={() => setScreen("sets")} goHome={() => setScreen("home")} now={now} />;
  else if (screen === "ai") content = <AiDive data={data} contextCardId={contextCardId} setData={setData} createCards={createCardsFromChat} backToStudy={() => setScreen("study")} />;
  else content = <Records data={data} now={now} />;
  return <Shell screen={screen} setScreen={navigate} title={title}>{content}</Shell>;
}
