"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useLanguage } from "./language";
import { AssetIcon } from "./asset-icon";

export function ReviewCelebration({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useLanguage();
  const [confetti, setConfetti] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setConfetti(false), 4200);
    return () => window.clearTimeout(timer);
  }, []);

  return <>
    {confetti && <div className="review-confetti" aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{
      left: `${(i * 37) % 100}%`,
      backgroundColor: ["#a5df58", "#69d3ab", "#ffc48c", "#b9a4eb", "#f4cb5e"][i % 5],
      "--drift": `${(i % 7 - 3) * 35}px`,
      "--turn": `${(i % 2 ? 1 : -1) * (360 + i * 17)}deg`,
      animationDelay: `${(i % 9) * 85}ms`,
      animationDuration: `${2400 + (i % 5) * 200}ms`,
    } as CSSProperties} />)}</div>}
    <aside className="review-celebration">
      <span className="celebration-medal"><AssetIcon name="check" size={46} /></span>
      <div role="status"><strong>{t("今日もおつかれさま！")}</strong><p>{t("今日の復習をすべて完了しました。")}</p></div>
      <button type="button" onClick={onDismiss} aria-label={t("お祝いを閉じる")}><AssetIcon name="close" size={20} /></button>
    </aside>
  </>;
}
