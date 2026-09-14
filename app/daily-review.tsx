"use client";

import { useState } from "react";
import type { AppData } from "../lib/types";
import { StreakCard } from "./streak-card";
import { widgetState } from "../lib/retention";
import { useLanguage } from "./language";
import { AssetIcon, IconLabel } from "./asset-icon";

export function DailyReviewRail({ data, now, onStudy }: { data: AppData; now: Date; onStudy: (id: string, startCardId?: string, batchSize?: number) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const retention=data.retention;
  const plan = retention ? {...data.dailyReview,cardIds:retention.dueCardIds,completedCardIds:[],completed:retention.completed,streak:retention.streak} : data.dailyReview;
  const stale = !!retention && widgetState(retention, now.getTime()) === "STALE";
  const done = new Set(plan.completedCardIds);
  const assigned = new Set(plan.cardIds);
  const sets = data.sets.map((set) => ({ set, cards: set.cards.filter((c) => assigned.has(c.id)) })).filter(({ cards }) => cards.length);
  const remaining = plan.cardIds.filter((id) => !done.has(id)).length;
  return <section className="daily-review-rail" aria-label={t("連続学習記録")}>
    <StreakCard data={data} now={now} onToday={() => setOpen(!open)} expanded={open} />
    <div className="daily-todo">
      <button type="button" className="today-todo-button" aria-expanded={open} aria-controls="daily-todo-content" onClick={() => setOpen(!open)}><span>{t("今日のToDo")}{!stale && <small> · {t("今日の復習：{0}枚", retention?.dueCount ?? remaining)}</small>}</span><AssetIcon name={open ? "chevron-up" : "chevron-down"} size={16} /></button>
      {open && <div id="daily-todo-content" className="daily-todo-content">
        {stale ? <p role="status">{t("学習記録を更新しています…")}</p> : sets.length ? <ul className="daily-todos">{sets.map(({ set, cards }) => {
          const finished = cards.every((c) => done.has(c.id));
          return <li key={set.id} className={finished ? "is-complete" : ""}><span className="todo-check" role="checkbox" aria-readonly="true" aria-checked={finished} aria-label={set.title}>{finished ? <AssetIcon name="check" size={24} /> : "⬜"}</span><div><strong>{set.title}</strong><small>{t("{0} / {1}枚完了", cards.filter((c) => done.has(c.id)).length, cards.length)}</small></div>{finished ? <span className="todo-done">{t("完了")}</span> : <button className="secondary" onClick={() => onStudy(`__daily__:${set.id}`)}>{t("学習")}</button>}</li>;
        })}</ul> : <p>{t("今日の復習予定はありません。")}</p>}
        {!stale && remaining > 0 && <div className="daily-todo-actions">
          <button className="primary wide" onClick={() => onStudy("__daily__")}>{t("今日の復習を始める · 残り{0}枚", remaining)}</button>
          {remaining > 5 && <button className="secondary small-batch-start" onClick={() => onStudy("__daily__", undefined, 5)}>{t("まず5枚だけ学習")}</button>}
        </div>}
        {!stale && (plan.completed ? <p className="daily-achieved" role="status"><IconLabel name="check">{t("今日のストリーク達成！おつかれさま！")}</IconLabel></p> : sets.length > 0 && <p className="streak-hint">{t("約5〜10分のStudy Setを1つ完了すると、今日のStreak達成です。")}</p>)}
      </div>}
    </div>
  </section>;
}
