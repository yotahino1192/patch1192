"use client";

import { useState } from "react";
import type { AppData } from "../lib/types";
import { studyDay } from "../lib/daily-review";
import { useLanguage } from "./language";
import { AssetIcon, IconLabel } from "./asset-icon";

export function DailyReviewRail({ data, now, onStudy }: { data: AppData; now: Date; onStudy: (id: string, startCardId?: string, batchSize?: number) => void }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const retention=data.retention;
  const plan = retention ? {...data.dailyReview,cardIds:retention.dueCardIds,completedCardIds:[],completed:retention.completed,streak:retention.streak} : data.dailyReview;
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * 86_400_000));
  const done = new Set(plan.completedCardIds);
  const assigned = new Set(plan.cardIds);
  const sets = data.sets.map((set) => ({ set, cards: set.cards.filter((c) => assigned.has(c.id)) })).filter(({ cards }) => cards.length);
  const remaining = plan.cardIds.filter((id) => !done.has(id)).length;
  const achievedDays = days.map((date,i) => retention ? (retention.achievedDays?.includes(retention.day-(6-i)) ?? (i===6&&retention.completed)) : plan.achievedDays.includes(studyDay(date)));
  return <section className="daily-review-rail" aria-label={t("連続学習記録")}>
    <div className="streak-heading" data-streak={retention?.hot?"hot":"normal"}><h2><IconLabel name="streak" size={24}>{t("連続学習")}</IconLabel></h2><strong>{t("{0}日", plan.streak)}</strong></div>
    <p>{retention?.hot && <strong>Hot Streak · </strong>}今日の復習：{retention?.dueCount ?? remaining}枚</p>
    <div className="streak-track">{days.map((date, i) => {
      const today = i === 6;
      const achieved = achievedDays[i];
      let linkedDays = 0;
      if (achieved && !achievedDays[i - 1]) {
        while (achievedDays[i + linkedDays + 1]) linkedDays++;
      }
      const number = new Intl.DateTimeFormat(locale, { timeZone: retention?.timezone || "Asia/Tokyo", day: "numeric" }).format(date).replace(/日$/, "");
      const label = today ? t("今日") : new Intl.DateTimeFormat(locale, { timeZone: retention?.timezone || "Asia/Tokyo", weekday: "short" }).format(date);
      return <div className={`streak-day ${today ? "is-today" : ""} ${achieved ? "is-achieved" : ""}`} key={studyDay(date)}>
        <span>{label}</span>
        {linkedDays > 0 && <span className="streak-highlight" style={{ width: `calc(${linkedDays * 100}% + var(--streak-highlight-size))` }} aria-hidden="true"><span className="streak-sparkle"><AssetIcon name="sparkles" size={14} /></span></span>}
        {today ? <button className="streak-medal" aria-label={`${number} · ${t("今日の復習ToDoを開く")}`} aria-expanded={open} aria-controls="daily-todo-content" onClick={() => setOpen(!open)}><span>{number}</span><span className="streak-status" aria-hidden="true"><AssetIcon name={achieved ? "check" : "lock"} size={20} /></span></button> : <span className="streak-medal" aria-label={`${number} · ${t(achieved ? "達成済み" : "未達成")}`}><span>{number}</span>{achieved && <span className="streak-status" aria-hidden="true"><AssetIcon name="check" size={20} /></span>}</span>}
      </div>;
    })}</div>
    <div className="daily-todo">
      <button type="button" className="today-todo-button" aria-expanded={open} aria-controls="daily-todo-content" onClick={() => setOpen(!open)}><span>{t("今日のToDo")}</span><AssetIcon name={open ? "chevron-up" : "chevron-down"} size={16} /></button>
      {open && <div id="daily-todo-content" className="daily-todo-content">
        {sets.length ? <ul className="daily-todos">{sets.map(({ set, cards }) => {
          const finished = cards.every((c) => done.has(c.id));
          return <li key={set.id} className={finished ? "is-complete" : ""}><span className="todo-check" role="checkbox" aria-readonly="true" aria-checked={finished} aria-label={set.title}>{finished ? <AssetIcon name="check" size={24} /> : "⬜"}</span><div><strong>{set.title}</strong><small>{t("{0} / {1}枚完了", cards.filter((c) => done.has(c.id)).length, cards.length)}</small></div>{finished ? <span className="todo-done">{t("完了")}</span> : <button className="secondary" onClick={() => onStudy(`__daily__:${set.id}`)}>{t("学習")}</button>}</li>;
        })}</ul> : <p>{t("今日の復習予定はありません。教材を追加して学習を始めましょう。")}</p>}
        {remaining > 0 && <div className="daily-todo-actions">
          <button className="primary wide" onClick={() => onStudy("__daily__")}>{t("今日の復習を始める · 残り{0}枚", remaining)}</button>
          {remaining > 5 && <button className="secondary small-batch-start" onClick={() => onStudy("__daily__", undefined, 5)}>{t("まず5枚だけ学習")}</button>}
        </div>}
        {plan.completed ? <p className="daily-achieved" role="status"><IconLabel name="check">{t("今日のストリーク達成！おつかれさま！")}</IconLabel></p> : sets.length > 0 && <p className="streak-hint">{t("約5〜10分のStudy Setを1つ完了すると、今日のStreak達成です。")}</p>}
      </div>}
    </div>
  </section>;
}
