"use client";

import { useMemo, useState } from "react";

type Screen = "home" | "import" | "generate" | "sets" | "study" | "ai" | "records";

type Card = {
  id: number;
  question: string;
  answer: string;
  status: "復習待ち" | "定着中" | "苦手";
};

const initialCards: Card[] = [
  { id: 1, question: "スピノザにおける実体とは？", answer: "それ自体で存在し、それ自体によって理解されるもの。", status: "復習待ち" },
  { id: 2, question: "スピノザは実体を何と同一視したか？", answer: "神、または自然（デウス・シヴェ・ナトゥーラ）と同一視した。", status: "定着中" },
  { id: 3, question: "スピノザによれば、実体の性質は？", answer: "実体は無限であり、無数の属性を持つ。", status: "苦手" },
];

const navItems: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "⌂" },
  { id: "sets", label: "セット", icon: "▱" },
  { id: "study", label: "学習", icon: "▤" },
  { id: "ai", label: "AI", icon: "✦" },
  { id: "records", label: "記録", icon: "◎" },
];

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
        {title ? <IconButton label="戻る" onClick={() => setScreen("home")}>‹</IconButton> : <span className="wordmark">Loop</span>}
        {title && <h1 className="screen-title">{title}</h1>}
        <IconButton label="通知">♢<span className="notification-dot" /></IconButton>
      </header>
      <main>{children}</main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        {navItems.map((item) => (
          <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Home({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="spark">✦</div>
        <div>
          <p className="eyebrow">2026年7月31日・金曜日</p>
          <h1>おはよう、Yota</h1>
          <p>今日も知識のループを回して、理解を深めよう。</p>
        </div>
      </section>

      <section className="review-card">
        <div className="progress-ring"><strong>68</strong><span>%</span><small>完了</small></div>
        <div className="review-copy">
          <p className="accent-label">↻ 今日の復習</p>
          <h2>12枚のカードが<br />復習を待っています</h2>
          <p className="muted">◷ 所要時間の目安：15分</p>
        </div>
        <button className="circle-arrow" onClick={() => setScreen("study")} aria-label="今日の復習を始める">›</button>
      </section>

      <section className="focus-card">
        <div className="section-row"><h2>今日のフォーカス</h2><button>変更</button></div>
        <button className="focus-content" onClick={() => setScreen("study")}>
          <span className="chip blue">✦ 理解を深める</span>
          <strong>スピノザにおける実体とは？</strong>
          <span><i>哲学</i> 思考レベル：★★☆</span>
          <b>›</b>
        </button>
      </section>

      <section>
        <div className="section-row"><h2>最近のセット</h2><button onClick={() => setScreen("sets")}>すべて見る</button></div>
        <div className="set-grid">
          {[
            ["⌘", "哲学", "48枚", "昨日", "blue-set"],
            ["⌂", "歴史", "36枚", "2日前", "green-set"],
            ["⌁", "生物", "52枚", "3日前", "violet-set"],
          ].map(([icon, name, count, date, cls]) => (
            <button key={name} className={`set-tile ${cls}`} onClick={() => setScreen("sets")}>
              <span>{icon}</span><strong>{name}</strong><small>{count}のカード</small><em>最終学習：{date}　●</em>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-row"><h2>おすすめの次の学習</h2></div>
        <div className="recommend-list">
          {[
            ["↻", "カントの認識論の要点", "哲学", "残り 8枚"],
            ["⌛", "明治維新の主な出来事", "歴史", "残り 12枚"],
            ["♧", "光合成のプロセス", "生物", "残り 15枚"],
          ].map((item) => <button key={item[1]} onClick={() => setScreen("study")}><span>{item[0]}</span><strong>{item[1]}</strong><i>{item[2]}</i><em>{item[3]}　›</em></button>)}
        </div>
      </section>

      <button className="floating-add" onClick={() => setScreen("import")}><span>＋</span> 新しい教材を追加</button>
    </div>
  );
}

function ImportScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [source, setSource] = useState("ChatGPT");
  const [detail, setDetail] = useState("標準");
  const [style, setStyle] = useState("一問一答");
  const [text, setText] = useState("");
  return (
    <div className="page import-page">
      <div className="page-heading"><div><h1>インポート</h1><p>あらゆる情報を、覚えられる知識に変換。</p></div><span className="help">?</span></div>
      <h2>情報のソースを選ぶ</h2>
      <div className="source-grid">
        {[
          ["ChatGPT", "✺", "ChatGPTの会話"],
          ["PDF / Word", "▧", "PDF / Word"],
          ["Web記事", "◎", "Web記事"],
          ["ノート", "▤", "ノート"],
        ].map(([id, icon, label]) => <button key={id} className={source === id ? "selected" : ""} onClick={() => setSource(id)}><span>{icon}</span>{label}</button>)}
      </div>
      <label className="field-label" htmlFor="source-text">内容を貼り付ける</label>
      <textarea id="source-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="ここにテキストを貼り付けてください…&#10;例）ChatGPTとの会話、記事の本文、メモなど" maxLength={20000} />
      <p className="counter">{text.length.toLocaleString()} / 20,000</p>
      <h2>取り込み設定</h2>
      <OptionGroup label="情報の粒度" values={["要点のみ", "標準", "詳しく"]} value={detail} setValue={setDetail} />
      <OptionGroup label="カードの形式" values={["一問一答", "理解重視", "用語中心"]} value={style} setValue={setStyle} />
      <button className="primary wide" onClick={() => setScreen("generate")}>✦ AIで解析する</button>
      <p className="secure">♙ データは安全に処理されます</p>
    </div>
  );
}

function OptionGroup({ label, values, value, setValue }: { label: string; values: string[]; value: string; setValue: (value: string) => void }) {
  return <div className="option-group"><p>{label}</p><div>{values.map((v) => <button key={v} className={v === value ? "selected" : ""} onClick={() => setValue(v)}>{v}</button>)}</div></div>;
}

function Generate({ cards, setCards, setScreen }: { cards: Card[]; setCards: (cards: Card[]) => void; setScreen: (screen: Screen) => void }) {
  const update = (id: number, key: "question" | "answer", value: string) => setCards(cards.map((c) => c.id === id ? { ...c, [key]: value } : c));
  return (
    <div className="page generation-page">
      <div className="success-banner"><span>✓</span><div><h2>解析完了</h2><p>要点を抽出し、カードを生成しました。</p></div><b>✦</b></div>
      <section className="panel">
        <h2>抽出された要点</h2>
        <ul>
          <li>実体とは、自らのうちに存在し、自らによって理解されるもの。</li>
          <li>スピノザは、実体は神または自然であるとする。</li>
          <li>実体は無限であり、無数の属性をもつ。</li>
        </ul>
      </section>
      <section>
        <div className="section-row"><h2>生成されたカード（{cards.length}枚）</h2><button onClick={() => setCards(initialCards)}>↻ 再生成</button></div>
        <div className="edit-card-list">
          {cards.map((card, index) => (
            <article key={card.id}>
              <div className="number">{index + 1}</div>
              <label>質問<input value={card.question} onChange={(e) => update(card.id, "question", e.target.value)} /></label>
              <label>答え<textarea value={card.answer} onChange={(e) => update(card.id, "answer", e.target.value)} /></label>
              <button className="delete" onClick={() => setCards(cards.filter((c) => c.id !== card.id))}>削除</button>
            </article>
          ))}
        </div>
      </section>
      <div className="sticky-actions"><button className="secondary" onClick={() => setCards([...cards, { id: Date.now(), question: "新しい質問", answer: "新しい答え", status: "復習待ち" }])}>＋ カードを追加</button><button className="primary" onClick={() => setScreen("sets")}>✓ このセットを保存</button></div>
    </div>
  );
}

function SetDetail({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <div className="page set-page">
      <section className="set-hero">
        <span className="big-icon">⌘</span><div><p>哲学</p><h1>スピノザ</h1><span>理性によって自由を目指す思想</span></div><b>SPINOZA</b>
      </section>
      <div className="set-meta"><span>▧ 48枚のカード</span><span>▣ 最終学習：昨日</span><span>◷ 次の復習：今日</span></div>
      <section className="memory-panel">
        <div className="section-row"><h2>記憶の状態</h2><button>詳細を見る</button></div>
        <div className="memory-grid">
          {[["復習待ち", "12", "blue-dot"], ["定着中", "24", "green-dot"], ["苦手", "6", "orange-dot"], ["アーカイブ", "6", "gray-dot"]].map((m) => <div key={m[0]}><span className={m[2]}>●</span><small>{m[0]}</small><strong>{m[1]}<i>枚</i></strong></div>)}
        </div>
        <p className="memory-tip">✦ <strong>今復習すると定着しやすいタイミングです</strong><br /><span>学習履歴にもとづく予測です。</span></p>
      </section>
      <section>
        <div className="section-row"><h2>カード一覧</h2><button>↕ 並び替え</button></div>
        <div className="topic-list">
          {[["1", "実体", "スピノザ哲学の根本概念", "復習待ち", "5枚"], ["2", "属性", "実体の本質を表す概念", "定着中", "8枚"], ["3", "様態", "実体の表れとしての個別的存在", "苦手", "3枚"], ["4", "自由", "理性に基づく自由の概念", "復習待ち", "2枚"]].map((row) => <button key={row[0]} onClick={() => setScreen("study")}><span>{row[0]}</span><div><strong>{row[1]}</strong><small>{row[2]}</small></div><i>{row[3]}</i><em>{row[4]}　›</em></button>)}
        </div>
      </section>
      <button className="primary wide" onClick={() => setScreen("study")}>▤ このセットを学習　<small>12枚の復習待ちカードから開始</small></button>
    </div>
  );
}

function Study({ cards, setScreen }: { cards: Card[]; setScreen: (screen: Screen) => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index % Math.max(cards.length, 1)] || initialCards[0];
  const next = () => { setIndex((index + 1) % Math.max(cards.length, 1)); setFlipped(false); };
  return (
    <div className="page study-page">
      <div className="study-header"><button onClick={() => setScreen("sets")}>‹</button><h1>哲学 / スピノザ</h1><button>•••</button></div>
      <div className="study-progress"><span style={{ width: `${((index + 1) / Math.max(cards.length, 1)) * 100}%` }} /><b>{index + 1} / {cards.length}</b></div>
      <button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)}>
        <span className="chip blue">{flipped ? "✦ 回答" : "✦ 理解を深める"}</span>
        <strong>{flipped ? card.answer : card.question}</strong>
        <small>{flipped ? "もう一度タップして質問へ" : "☝ タップで回答を表示"}</small>
      </button>
      <div className="rating-grid">
        <button onClick={next}><b className="red">↻</b><strong>もう一度</strong><small>復習する</small></button>
        <button onClick={next}><b>?</b><strong>むずかしい</strong><small>理解が不十分</small></button>
        <button onClick={next}><b className="teal">✓</b><strong>わかった</strong><small>次のカードへ</small></button>
        <button onClick={next}><b className="blue-text">★</b><strong>覚えた</strong><small>定着しました</small></button>
      </div>
      <div className="study-tools"><button onClick={() => setScreen("ai")}>✦ AIに聞く</button><button>▧ メモを追加</button></div>
    </div>
  );
}

function AiDive({ setScreen }: { setScreen: (screen: Screen) => void }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const send = () => { if (question.trim()) { setMessages([...messages, question]); setQuestion(""); } };
  return (
    <div className="page ai-page">
      <div className="study-header"><button onClick={() => setScreen("study")}>‹</button><h1>AI深掘り</h1><button>•••</button></div>
      <div className="context-chip">✦ スピノザ / 実体</div>
      <div className="user-bubble">これって中学生でもわかるように説明して</div>
      <article className="ai-answer">
        <span className="ai-spark">✦</span>
        <p>もちろん！スピノザの「実体」について、できるだけシンプルに説明するね。</p>
        <h3><i>♧</i> 世界はひとつだけ</h3><p>スピノザは「この世界には、本当の意味で存在するものはひとつだけ」だと考えました。それを「実体」と呼びます。</p>
        <h3><i>≋</i> それが神＝自然</h3><p>そのひとつの実体は、「神」や「自然」と同じもの。神は遠くにいる特別な存在ではなく、この世界のすべてそのものです。</p>
        <h3><i>∞</i> すべてはつながっている</h3><p>人も動物も木も星も、この実体のあらわれです。だから世界のすべてはつながっています。</p>
      </article>
      {messages.map((m, i) => <div className="user-bubble small-bubble" key={i}>{m}</div>)}
      <p className="suggest-label">もっと知りたい？</p>
      <div className="suggestions">{["具体例がほしい", "デカルトとの違い", "なぜ重要？"].map((s) => <button key={s} onClick={() => setQuestion(s)}>{s}</button>)}</div>
      <OptionGroup label="説明の深さ" values={["一言", "かんたん", "標準", "詳しく"]} value="かんたん" setValue={() => {}} />
      <button className="primary wide" onClick={() => setScreen("generate")}>✦ この内容からカードを作る</button>
      <div className="chat-input"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="質問を入力…" /><button onClick={send}>↑</button></div>
    </div>
  );
}

function Records() {
  const total = useMemo(() => [35, 75, 40, 60, 50, 70, 22].reduce((a, b) => a + b, 0), []);
  return (
    <div className="page records-page">
      <div className="page-heading"><div><h1>学習の記録</h1><p>あなたの学習の推移をチェックしましょう。</p></div></div>
      <section className="chart-panel">
        <div className="section-row"><h2>今週の学習時間</h2><p>合計 <strong>{Math.floor(total / 60)}時間 {total % 60}分</strong></p></div>
        <div className="bar-chart">{[["月",35],["火",75],["水",40],["木",60],["金",50],["土",70],["日",22]].map(([d,v]) => <div key={d as string}><span style={{ height: `${Number(v) * 1.45}px` }}><i>{v}分</i></span><b>{d}</b></div>)}</div>
      </section>
      <div className="stats-grid">{[["🔥","連続学習","12日","ベスト：18日"],["▣","今週の学習","86枚","先週：72枚"],["◎","正答率","78%","先週：72%"]].map((s) => <article key={s[1]}><span>{s[0]}</span><small>{s[1]}</small><strong>{s[2]}</strong><em>{s[3]}</em></article>)}</div>
      <section><div className="section-row"><h2>復習リマインド</h2><button>すべて見る</button></div><div className="reminder-list">{[["◷","12枚のカードが復習待ち","今日の復習を続けましょう","15分後"],["◴","明日復習するカード","スピノザにおける実体とは？","明日 9:00"],["◶","3日後に復習","光合成のプロセス など","8月3日"]].map((r)=><button key={r[1]}><span>{r[0]}</span><div><strong>{r[1]}</strong><small>{r[2]}</small></div><em>{r[3]}　›</em></button>)}</div></section>
      <section><div className="section-row"><h2>苦手カード</h2><button>すべて見る</button></div><div className="weak-list">{[["哲学","スピノザにおける実体とは？","45%"],["歴史","フランス革命の三部会とは？","52%"],["科学","ニュートンの運動の法則 第2法則","48%"]].map((r)=><button key={r[1]}><i>{r[0]}</i><strong>{r[1]}</strong><span>正答率 {r[2]}　━　›</span></button>)}</div></section>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [cards, setCards] = useState<Card[]>(initialCards);
  let content: React.ReactNode;
  let title: string | undefined;
  if (screen === "home") content = <Home setScreen={setScreen} />;
  else if (screen === "import") content = <ImportScreen setScreen={setScreen} />;
  else if (screen === "generate") { content = <Generate cards={cards} setCards={setCards} setScreen={setScreen} />; title = "要点化とカード生成"; }
  else if (screen === "sets") { content = <SetDetail setScreen={setScreen} />; title = "哲学"; }
  else if (screen === "study") content = <Study cards={cards} setScreen={setScreen} />;
  else if (screen === "ai") content = <AiDive setScreen={setScreen} />;
  else content = <Records />;
  return <Shell screen={screen} setScreen={setScreen} title={title}>{content}</Shell>;
}
