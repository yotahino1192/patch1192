"use client";

import type { AppData } from "../lib/types";
import { widgetState } from "../lib/retention";
import { useLanguage } from "./language";
import { Mascot, PatchIcon } from "./patch-ui";

export function LessonCompletion({ data, now, cards, mistakes }: { data: AppData; now: Date; cards: number; mistakes: number }) {
  const { t } = useLanguage();
  const name = data.profile?.displayName?.trim();
  const snapshot = data.retention;
  const fresh = snapshot && widgetState(snapshot, now.getTime()) !== "STALE";
  return <>
    <Mascot pose="celebrate" />
    <h1>{t("レッスンが終了しました")}</h1>
    <p className="patch-success-message">{name ? t("よくできました、{0}！", name) : t("よくできました！")}</p>
    <div className="patch-results"><div><span><PatchIcon name="book" size={30} /></span><strong>{cards}</strong><small>{t("完了したカード")}</small></div><div><span><PatchIcon name="refresh" size={30} /></span><strong>{mistakes}</strong><small>{t("もう一度の回数")}</small></div></div>
    {fresh && <div className={`patch-completion-streak ${snapshot.hot ? "is-hot" : ""}`}><span><PatchIcon name={snapshot.hot ? "flame" : "calendar"} size={43} /></span><div><strong>{t("連続学習 · {0}日", snapshot.streak)}</strong><p>{t(snapshot.completed ? "今日の学習目標を達成しました。" : "今回の練習を記録しました。")}</p></div></div>}
  </>;
}
