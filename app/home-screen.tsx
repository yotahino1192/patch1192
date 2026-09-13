"use client";

import { useState } from "react";
import type { AppData } from "../lib/types";
import type { StudySession } from "../lib/workspace";
import { pendingStudyCount } from "../lib/workspace";
import { continueLearning } from "../lib/continue-learning";
import { widgetState } from "../lib/retention";
import { isLongTermDue } from "../lib/long-term-review";
import { LessonPreview } from "./lesson-preview";
import { DailyReviewRail } from "./daily-review";
import { useLanguage } from "./language";
import { Mascot, PatchIcon } from "./patch-ui";

type Screen = "home" | "import" | "generate" | "sets" | "study" | "records";
export function Home({ data, now, startStudy, setScreen, selectSet, resumeDraft, resumableSessions, onResume, onSample, onContinue }: {
  data: AppData; now: Date;
  startStudy: (setId?: string, startCardId?: string, batchSize?: number) => void;
  setScreen: (screen: Screen) => void; selectSet: (id: string) => void;
  resumeDraft?: () => void; resumableSessions: StudySession[];
  onResume: (session: StudySession) => void; onSample: () => Promise<void>; onContinue: () => void;
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
    <section className="patch-greeting" aria-label={t("キャラクターからのあいさつ")}>
      <Mascot pose={early ? "standing" : "reading"} />
      <div className="patch-bubble"><h1>{heading}</h1><p>{t(completed ? "今日はもうばっちり。もう少し続けてみる？" : learnable ? "次のレッスンを始めよう。" : "さあ、一緒に学ぼう。")}</p><i className="patch-rays" aria-hidden="true" /></div>
    </section>
    {early ? <section className="patch-first-lesson">
      <button className="patch-primary" onClick={() => setScreen("import")}><PatchIcon name="plus" size={28} />{t("教材を追加")}</button>
      <button className="patch-text-button" disabled={sampleBusy} onClick={async () => { setSampleBusy(true); setSampleError(""); try { await onSample(); } catch (error) { setSampleError(error instanceof Error ? error.message : t("サンプルを準備できませんでした。")); } finally { setSampleBusy(false); } }}>{t(sampleBusy ? "準備しています…" : "サンプルで学習 · 3枚")}</button>
      {sampleError && <p role="alert" className="inline-error">{t(sampleError)}</p>}
    </section> : <>
      <DailyReviewRail data={data} now={now} onStudy={startStudy} />
      <section className="patch-learning" aria-label={t("今日の学習")}>
        {recentSets.length > 0 && <><h2 className="patch-section-label">{t("最近学んだ教材")}</h2><div className="patch-recent-path">{recentSets.map(set => <button key={set.id} className="patch-path-stop" title={set.title} onClick={() => { selectSet(set.id); setScreen("sets"); }}><span><PatchIcon name="book" size={25} /></span><small>{set.title}</small></button>)}</div></>}
        {completed ? <div className="patch-current-node is-completed" role="status"><PatchIcon name="check" size={36} /><strong>{t("今日は完了！")}</strong><small>{t("今日の学習目標を達成しました。")}</small></div> : <button className="patch-current-node" onClick={openNext}><PatchIcon name={learnable ? "book" : "plus"} size={34} /><strong>{t(learnable ? "続きから学習" : "新しい教材を追加")}</strong><span className="patch-node-arrow"><PatchIcon name="chevron" size={20} /></span></button>}
        {!completed && currentSet && <p className="patch-current-title">{currentSet.title}</p>}
      </section>
      {(completed || resumableSessions.length > 0 || memorySets.length > 0) && <div className="patch-section-label patch-optional-label">{t(completed ? "もう少し続ける（任意）" : "学習を続ける")}</div>}
      {completed && learnable && <button className="patch-action-card" onClick={openNext}><span className="patch-action-icon"><PatchIcon name="book" /></span><span><strong>{t("続きから学習")}</strong><small>{currentSet?.title || t("今日の復習")}</small></span><PatchIcon name="arrow" size={19} /></button>}
      {resumableSessions.length > 0 && <section className="home-resume-list" aria-label={t("中断した学習")}>{resumableSessions.map(session => <button key={session.id} className="patch-action-card" onClick={() => setPreview(session.id)}><span className="patch-action-icon"><PatchIcon name="book" /></span><span><strong>{t("続きから学習 · 残り{0}枚", pendingStudyCount(session))}</strong><small>{data.sets.find(set => set.id === session.setId)?.title || t("復習")}</small></span><PatchIcon name="arrow" size={19} /></button>)}</section>}
      {memorySets.map(({ set, cards }) => <button key={set.id} className="patch-action-card" onClick={() => startStudy(`__memory__:${set.id}`)}><span className="patch-action-icon is-memory"><PatchIcon name="refresh" /></span><span><strong>{t("記憶を確かめる")}</strong><small>{set.title} · {t("{0}枚", cards.length)}</small></span><PatchIcon name="arrow" size={19} /></button>)}
      {(completed || learnable) && <button className="patch-text-button patch-add-material" onClick={() => setScreen("import")}><PatchIcon name="plus" size={18} />{t("新しい教材を追加")}</button>}
    </>}
    {resumeDraft && <button className="patch-action-card" onClick={resumeDraft}><span>{t("下書きの続きから")}</span><PatchIcon name="arrow" size={20} /></button>}
    <LessonPreview open={preview !== null} onClose={() => setPreview(null)} onStart={startPreview} title={title} summary={currentSet?.summary} sessionId={selectedSession?.id ?? remoteSession?.id} remaining={remaining} dueCount={!currentSet && destination.kind === "review" && !stale ? data.retention?.dueCount : undefined} />
  </div>;
}
