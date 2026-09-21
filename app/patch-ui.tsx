"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLanguage } from "./language";

export function PatchWordmark() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="patch-wordmark" src="/patch/wordmark-evergreen.png" width={2172} height={724} alt="Patch" />;
}

export type PatchIconName = "folder" | "book" | "check" | "arrow" | "chevron" | "calendar" | "flame" | "close" | "plus" | "search" | "home" | "refresh" | "document" | "bars" | "profile" | "nav-add" | "nav-progress" | "nav-document" | "lesson-book";
export function PatchIcon({ name, size = 24 }: { name: PatchIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "profile" && <g fill="currentColor" stroke="none"><ellipse cx="16" cy="9" rx="6" ry="7" /><path d="M5 28v-3a11 9 0 0 1 22 0v3c-6 4-16 4-22 0Z" /></g>}
    {name === "nav-add" && <><circle cx="16" cy="16" r="13" /><path d="M16 9v14M9 16h14" /></>}
    {name === "nav-progress" && <><rect x="3" y="21" width="5" height="9" rx="1" /><rect x="13" y="13" width="5" height="17" rx="1" /><rect x="23" y="3" width="5" height="27" rx="1" /></>}
    {name === "nav-document" && <><rect x="7" y="2" width="19" height="28" rx="3" /><path d="M12 9h9M12 15h9M12 21h6" /></>}
    {name === "lesson-book" && <><path fill="currentColor" stroke="none" d="M15 9C11 6 7 6 3 7v19c5-1 8 0 12 2V9Zm2 0c4-3 8-3 12-2v19c-5-1-8 0-12 2V9Z" /><path d="M1 11v18c6-1 10 0 15 2 5-2 9-3 15-2V11" /></>}
    {name === "folder" && <path d="M3 9a3 3 0 0 1 3-3h7l3 4h10a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />}
    {name === "book" && <path d="M16 7C12 3 6 3 2 5v22c5-2 10-2 14 1 4-3 9-3 14-1V5c-4-2-10-2-14 2Zm0 0v21" />}
    {name === "check" && <path strokeWidth="4" d="m7 16 6 6L26 8" />}
    {name === "arrow" && <path d="M5 16h22M19 7l9 9-9 9" />}
    {name === "chevron" && <path d="m12 7 9 9-9 9" />}
    {name === "calendar" && <><rect x="5" y="6" width="22" height="23" rx="3" /><path d="M5 13h22M10 3v6M22 3v6" /></>}
    {name === "flame" && <g stroke="none"><path fill="#ff6518" d="M17 1C23 8 24 11 23 16l4-6c4 7 5 14-1 19-5 4-16 4-21-2C1 22 3 16 7 10l2 7C8 10 13 6 17 1Z" /><path fill="#ff9821" d="M16 9c4 5 3 9 6 11l2-3c2 5 1 10-3 12-5 3-13 0-13-5 0-4 3-8 4-10l1 6c2-3 3-6 3-11Z" /><path fill="#ffda4c" d="M17 18c0 4 4 5 4 8 0 5-9 5-9 0 0-2 1-4 2-5l1 3c2-1 2-4 2-6Z" /></g>}
    {name === "close" && <path d="m9 9 14 14M23 9 9 23" />}
    {name === "plus" && <path strokeWidth="3" d="M16 5v22M5 16h22" />}
    {name === "search" && <><circle cx="14" cy="14" r="9" /><path d="m21 21 7 7" /></>}
    {name === "home" && <path fill="currentColor" d="m3 15 13-11 13 11-3 1v12h-7v-9h-6v9H6V16Z" />}
    {name === "document" && <><rect x="7" y="3" width="19" height="25" rx="3" /><path d="M7 7H4v22a2 2 0 0 0 2 2h16M12 10h9M12 16h9M12 22h6" /></>}
    {name === "bars" && <g stroke="none" fill="currentColor"><rect x="3" y="18" width="7" height="13" rx="2" /><rect x="13" y="10" width="7" height="21" rx="2" /><rect x="23" y="2" width="7" height="29" rx="2" /></g>}
    {name === "refresh" && <><path d="M26 12A11 11 0 1 0 27 21M26 4v8h-8" /></>}
  </svg>;
}

// Native dialog supplies modal focus containment, Escape, inert background and focus restoration.
export function BottomSheet({ open, onClose, titleId, children }: { open: boolean; onClose: () => void; titleId: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);
  return <dialog ref={ref} className="patch-sheet patch-ui" aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <button type="button" className="patch-sheet-close" aria-label={t("閉じる")} onClick={onClose} autoFocus><PatchIcon name="close" /></button>
    {children}
  </dialog>;
}
