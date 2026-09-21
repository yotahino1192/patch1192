"use client";

import { useState } from "react";
import type { AppData } from "../lib/types";
import type { StudySession } from "../lib/workspace";
import { pendingStudyCount } from "../lib/workspace";
import { continueLearning } from "../lib/continue-learning";
import { widgetState } from "../lib/retention";
import { isLongTermDue } from "../lib/long-term-review";
import { AvailableLessons } from "../features/my-lesson/available-lessons";
import { LessonPreview } from "./lesson-preview";
import { StreakCard } from "./streak-card";
import { useLanguage } from "./language";
import { Mascot } from "./mascot";
import { PatchIcon } from "./patch-ui";

type Screen = "home" | "import" | "generate" | "sets" | "study" | "records";
export function Home({ data, now, startStudy, setScreen, selectSet, resumableSessions, onResume, onSample, onContinue, onChoosePatch, onOpenLesson }: {
  data: AppData; now: Date;
  startStudy: (setId?: string, startCardId?: string, batchSize?: number) => void;
  setScreen: (screen: Screen) => void; selectSet: (id: string) => void;
  resumeDraft?: () => void; resumableSessions: StudySession[];
  onResume: (session: StudySession) => void; onSample: () => Promise<void>; onContinue: () => void; onChoosePatch: () => void; onOpenLesson?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const destination = continueLearning(data, resumableSessions);
  const selectedSession = resumableSessions.find(session => session.id === (preview === null || preview === "continue" ? destination.id : preview));
  const remoteSession = destination.kind === "session" ? data.retention?.session : undefined;
  const sessionCardIds = new Set(selectedSession ? [...selectedSession.queue, ...(selectedSession.remaining || [])] : remoteSession?.cardIds);
  const spansSets = data.sets.filter(set => set.cards.some(card => sessionCardIds.has(card.id))).length > 1;
  const currentSet = spansSets ? undefined : data.sets.find(set => set.id === (selectedSession?.setId ?? remoteSession?.setId ?? (destination.kind === "set" ? destination.id : undefined)));
  const learnable = ["session", "review", "set"].includes(destination.kind);
  const stale = !!data.retention && widgetState(data.retention, now.getTime()) === "STALE";
  const completed = !stale && (data.retention?.completed ?? data.dailyReview.completed);
  const early = !learnable && !completed && !data.sets.some(set => set.cards.some(card => !["削除済み", "アーカイブ"].includes(card.status)));
  const name = data.profile?.displayName?.trim();
  const heading = name ? t(completed ? "よくできました、{0}！" : "こんにちは、{0}", name) : t(completed ? "よくできました！" : "こんにちは");
  const memorySets = data.sets.map(set => ({ set, cards: set.cards.filter(card => isLongTermDue(card, now)) })).filter(({ cards }) => cards.length);
  // These are real recently studied sets, not completed Lesson entities or a prescribed sequence.
  const recentSets = data.sets.filter(set => set.lastStudiedAt && set.cards.some(card => !["削除済み", "アーカイブ"].includes(card.status))).sort((a, b) => String(b.lastStudiedAt).localeCompare(String(a.lastStudiedAt))).slice(0, 3);
  const title = currentSet?.title || t("今日の復習");
  const remaining = selectedSession ? pendingStudyCount(selectedSession) : remoteSession?.cardIds.length;
  const openNext = () => { if (learnable) setPreview("continue"); else onContinue(); };
  const startPreview = () => { setPreview(null); if (selectedSession) onResume(selectedSession); else onContinue(); };
  return <div className={`page home-page patch-home patch-ui ${early ? "patch-home-early" : completed ? "patch-home-completed" : ""}`}>
    <svg width="0" height="0" aria-hidden="true" className="patch-book-filter"><defs>
      <filter id="patch-book-crisp" colorInterpolationFilters="sRGB">
        <feComponentTransfer><feFuncA type="linear" slope="12" intercept="-10" /></feComponentTransfer>
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
      </filter>
    </defs></svg>
    <section className="patch-greeting" aria-label={t("キャラクターからのあいさつ")}>
      <Mascot pose={early ? "standing" : "reading"} />
      <div className="patch-bubble"><h1>{heading}</h1><p>{t(completed ? "今日はもうばっちり。もう少し続けてみる？" : learnable ? "次のレッスンを始めよう。" : "さあ、一緒に学ぼう。")}</p></div>
    </section>
    {early ? <section className="patch-first-lesson">
      <button className="patch-primary" onClick={() => setScreen("import")}><PatchIcon name="plus" size={28} />{t("教材を追加")}</button>
      <button className="patch-text-button" disabled={sampleBusy} onClick={async () => { setSampleBusy(true); setSampleError(""); try { await onSample(); } catch (error) { setSampleError(error instanceof Error ? error.message : t("サンプルを準備できませんでした。")); } finally { setSampleBusy(false); } }}>{t(sampleBusy ? "準備しています…" : "サンプルで学習 · 3枚")}</button>
      {sampleError && <p role="alert" className="inline-error">{t(sampleError)}</p>}
    </section> : <>
      <section className="daily-review-rail" aria-label={t("連続学習記録")}><StreakCard data={data} now={now} /></section>
      <section className="patch-learning" aria-label={t("今日の学習")}>
        {recentSets.length > 0 && <><h2 className="patch-section-label">{t("最近学んだ教材")}</h2><div className="patch-recent-path">
          <svg className="patch-path-curve" viewBox={`0 0 100 ${recentSets.length * 68 + 20}`} preserveAspectRatio="none" aria-hidden="true"><path d={[
            "M53 0 C53 28 40 10 40 34",
            recentSets.length > 1 ? "C40 83 58 54 58 102" : "C40 66 50 58 50 88",
            recentSets.length > 2 ? "C58 148 45 122 45 170 C45 200 50 190 50 224" : recentSets.length > 1 ? "C58 136 50 126 50 156" : "",
          ].join(" ")} /></svg>
          {recentSets.map((set, index) => <button key={set.id} className={`patch-path-stop patch-path-stop-${index + 1}`} title={set.title} onClick={() => { selectSet(set.id); setScreen("sets"); }}><span><PatchIcon name="lesson-book" size={25} /></span><small>{set.title}</small></button>)}
        </div></>}

        <div className={`patch-current-node${completed ? " is-completed" : ""}`} role={completed ? "status" : undefined}>
          <span className="patch-current-book">{learnable && !completed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/patch/lesson-book-white.png" className="patch-lesson-book-image" alt="" aria-hidden="true" />
          ) : <PatchIcon name={completed ? "check" : "plus"} size={42} />}</span>
          {completed ? <><strong>{t("今日は完了！")}</strong><small>{t("今日の学習目標を達成しました。")}</small>{learnable && <button className="patch-lesson-start" onClick={onChoosePatch}>{t("続きから学習")}<PatchIcon name="arrow" size={21} /></button>}</> : <>
            <span className="patch-current-label">{t("今日のレッスン")}</span>
            <h2 title={learnable ? title : undefined}>{learnable ? title : t("新しい教材を追加")}</h2>
            {learnable && <p className="patch-current-context">{selectedSession || remoteSession ? t("続きから学習") : destination.kind === "review" ? t("今日の復習") : t("学習")}
              {remaining !== undefined ? <> · {t("残り{0}枚", remaining)}</> : destination.kind === "review" && !stale && data.retention ? <> · {t("{0}枚", data.retention.dueCount)}</> : null}
            </p>}
            <button className="patch-lesson-start" onClick={openNext}>{t(learnable ? selectedSession || remoteSession ? "続きから学習" : "レッスンを始める" : "教材を追加")}<PatchIcon name="arrow" size={21} /></button>
          </>}
        </div>
      </section>
      {memorySets.map(({ set, cards }) => <button key={set.id} className="patch-action-card" onClick={() => startStudy(`__memory__:${set.id}`)}><span className="patch-action-icon is-memory"><PatchIcon name="refresh" /></span><span><strong>{t("記憶を確かめる")}</strong><small>{set.title} · {t("{0}枚", cards.length)}</small></span><PatchIcon name="arrow" size={19} /></button>)}
    </>}
    {onOpenLesson && <AvailableLessons onStart={onOpenLesson} />}
    <LessonPreview open={preview !== null} onClose={() => setPreview(null)} onStart={startPreview} onChoosePatch={() => { setPreview(null); onChoosePatch(); }} title={title} summary={currentSet?.summary} sessionId={selectedSession?.id ?? remoteSession?.id} remaining={remaining} dueCount={!currentSet && destination.kind === "review" && !stale ? data.retention?.dueCount : undefined} />
  </div>;
}
