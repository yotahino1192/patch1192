"use client";

import { useEffect, useState } from "react";
import { createDomainClient } from "../lib/domain/client";
import { useApiFetch } from "./account-context";
import { useLanguage } from "./language";
import { Mascot } from "./mascot";
import { BottomSheet, PatchIcon } from "./patch-ui";

export function LessonPreview({ open, onClose, onStart, onChoosePatch, title, summary, sessionId, remaining, dueCount, label, titleId = "lesson-preview-title" }: {
  open: boolean; onClose: () => void; onStart: () => void; onChoosePatch?: () => void; title: string;
  titleId?: string; label?: string; summary?: string; sessionId?: string; remaining?: number; dueCount?: number;
}) {
  const { t } = useLanguage();
  const request = useApiFetch();
  const [estimate, setEstimate] = useState<{ id: string; seconds: number } | null>(null);
  useEffect(() => {
    if (!open || !sessionId) return;
    let active = true;
    // Saved sessions already have a server estimate. Preview never plans/creates a Lesson.
    void createDomainClient(request).query({ resource: "lesson", id: sessionId }).then(lesson => {
      if (active && lesson.id === sessionId) setEstimate({ id: sessionId, seconds: lesson.estimatedSeconds });
    }).catch(() => { if (active) setEstimate(null); });
    return () => { active = false; };
  }, [open, sessionId, request]);
  const seconds = estimate?.id === sessionId ? estimate?.seconds : undefined;
  return <BottomSheet open={open} onClose={onClose} titleId={titleId}>
    <span className="patch-sheet-label">{t(label ?? "今日のマイレッスン")}</span>
    <div className="patch-preview-heading"><div><h2 id={titleId}>{title}</h2>
      {seconds !== undefined && seconds > 0 && <p className="patch-preview-time">{t("予定時間：約{0}分", Math.ceil(seconds / 60))}</p>}
      {remaining !== undefined && <p>{t("残り{0}枚", remaining)}</p>}
      {dueCount !== undefined && <p>{t("今日の復習：{0}枚", dueCount)}</p>}
      {summary && <p className="patch-preview-description">{summary}</p>}
    </div><Mascot pose="happy" /></div>
    <button className="patch-primary" onClick={onStart}>{t("マイレッスンを始める")}<PatchIcon name="arrow" /></button>
    {onChoosePatch && <button className="patch-choose-patch" onClick={onChoosePatch}>{t("別のPatchを選ぶ")}</button>}
  </BottomSheet>;
}
