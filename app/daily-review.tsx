"use client";

import { useState } from "react";
import type { AppData } from "../lib/types";
import { studyDay } from "../lib/daily-review";
import { useLanguage } from "./language";

function Lock() {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="4" y="10" width="16" height="12" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M12 15v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

export function DailyReviewRail({ data, now, onStudy }: { data: AppData; now: Date; onStudy: (id: string) => void }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const plan = data.dailyReview;
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * 86_400_000));
  const done = new Set(plan.completedCardIds);
  const assigned = new Set(plan.cardIds);
  const sets = data.sets.map((set) => ({ set, cards: set.cards.filter((c) => assigned.has(c.id)) })).filter(({ cards }) => cards.length);
  const completedSets = sets.filter(({ cards }) => cards.every((c) => done.has(c.id))).length;
  return <section className="daily-review-rail" aria-label={t("連続学習記録")}>
    <div className="streak-heading"><h2>🔥 {t("連続学習")}</h2><strong>{t("{0}日", plan.streak)}</strong></div>
    <div className="streak-track">{days.map((date, i) => {
      const today = i === 6;
      const achieved = plan.achievedDays.includes(studyDay(date));
      const linked = achieved && i < 6 && plan.achievedDays.includes(studyDay(days[i + 1]));
      const number = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", day: "numeric" }).format(date).replace(/日$/, "");
      const label = today ? t("今日") : new Intl.DateTimeFormat(locale, { timeZone: "Asia/Tokyo", weekday: "short" }).format(date);
      return <div className={`streak-day ${today ? "is-today" : ""} ${achieved ? "is-achieved" : ""} ${linked ? "is-linked" : ""}`} key={studyDay(date)}>
        <span>{label}</span>
        {today ? <button className="streak-medal" aria-label={`${number} · ${t("今日の復習ToDoを開く")}`} aria-expanded={open} aria-controls="daily-review-popover" onClick={() => setOpen(!open)}><span>{number}</span><span className="streak-status" aria-hidden="true">{achieved ? "✓" : <Lock />}</span></button> : <span className="streak-medal" aria-label={`${number} · ${t(achieved ? "達成済み" : "未達成")}`}><span>{number}</span>{achieved && <span className="streak-status" aria-hidden="true">✓</span>}</span>}
      </div>;
    })}</div>
    <button type="button" className="today-todo-button" aria-expanded={open} aria-controls="daily-review-popover" onClick={() => setOpen(!open)}><span>{t("今日のToDo")}</span><span aria-hidden="true">{open ? "⌃" : "⌄"}</span></button>
    {open && <div id="daily-review-popover" className="daily-review-popover">
      <div className="section-row"><h3>{t("今日の復習ToDo")}</h3><span>{t("{0} / {1}セット完了", completedSets, sets.length)}</span></div>
      <p className="muted">{t("忘却曲線を参考にした復習間隔から、今日までに復習するカードを選んでいます。")}</p>
      {sets.length ? <ul className="daily-todos">{sets.map(({ set, cards }) => {
        const finished = cards.every((c) => done.has(c.id));
        return <li key={set.id} className={finished ? "is-complete" : ""}><span className="todo-check" role="checkbox" aria-readonly="true" aria-checked={finished} aria-label={set.title}>{finished ? "✓" : ""}</span><div><strong>{set.title}</strong><small>{t("{0} / {1}枚完了", cards.filter((c) => done.has(c.id)).length, cards.length)}</small></div>{finished ? <span className="todo-done">{t("完了")}</span> : <button className="secondary" onClick={() => onStudy(`__daily__:${set.id}`)}>{t("学習")}</button>}</li>;
      })}</ul> : <p>{t("今日の復習予定はありません。教材を追加して学習を始めましょう。")}</p>}
      {plan.completed ? <p className="daily-achieved" role="status">✓ {t("今日のストリーク達成！おつかれさま！")}</p> : sets.length > 0 && <><button className="primary wide" onClick={() => onStudy("__daily__")}>{t("復習を始める")}</button><p className="streak-hint">{t("すべてのToDoを完了すると、今日のストリーク達成です。")}</p></>}
    </div>}
  </section>;
}
