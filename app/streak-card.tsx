"use client";

import type { AppData } from "../lib/types";
import { widgetState } from "../lib/retention";
import { studyDay } from "../lib/daily-review";
import { useLanguage } from "./language";
import { PatchIcon } from "./patch-ui";

export function StreakCard({ data, now, onToday, expanded = false }: { data: AppData; now: Date; onToday?: () => void; expanded?: boolean }) {
  const { t, locale } = useLanguage();
  const snapshot = data.retention;
  const stale = !!snapshot && widgetState(snapshot, now.getTime()) === "STALE";
  const state = stale ? "stale" : snapshot?.broken ? "broken" : snapshot?.hot ? "hot" : "normal";
  const streak = snapshot?.streak ?? data.dailyReview.streak;
  const hot = state === "hot";
  // Day labels present the server snapshot. Achievement checks are never inferred from streak length.
  const anchor = new Date(snapshot?.generatedAt ?? now.getTime());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return { date, achieved: !stale && (snapshot ? (snapshot.achievedDays?.includes(snapshot.day - (6 - index)) ?? (index === 6 && snapshot.completed)) : data.dailyReview.achievedDays.includes(studyDay(date))) };
  });
  return <div className={`patch-streak patch-ui patch-streak-${state}`} data-streak={state}>
    <div className="patch-streak-heading"><h2 className="patch-streak-count">{stale ? t("連続学習") : t("{0}日連続", streak)}</h2>{hot && <span className="patch-streak-icon" aria-label={t("ホットストリーク")}><PatchIcon name="flame" size={25} /></span>}</div>
    {(stale || state === "broken") && <p className="patch-streak-message">{t(stale ? "学習記録を更新しています…" : "また今日から、一緒に始めよう。")}</p>}
    <div className="patch-streak-week">{days.map(({ date, achieved }, index) => {
      const today = index === 6;
      const label = today ? t("今日") : new Intl.DateTimeFormat(locale, { timeZone: snapshot?.timezone || "Asia/Tokyo", weekday: "short" }).format(date);
      const status = t(achieved ? "達成済み" : "未達成");
      const mark = achieved ? <PatchIcon name="check" size={22} /> : null;
      return <div key={index} className={`patch-streak-day ${achieved ? "is-achieved" : ""} ${today ? "is-today" : ""}`}><span>{label}</span>{today && onToday ? <button type="button" aria-label={`${label} · ${t("今日の復習ToDoを開く")} · ${status}`} aria-expanded={expanded} aria-controls="daily-todo-content" onClick={onToday}>{mark}</button> : <span className="patch-day-check" aria-label={`${label} · ${status}`}>{mark}</span>}</div>;
    })}</div>
  </div>;
}
