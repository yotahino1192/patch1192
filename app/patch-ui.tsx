"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLanguage } from "./language";

export type PatchIconName = "book" | "check" | "arrow" | "calendar" | "flame" | "close" | "plus" | "home" | "refresh" | "document" | "bars";
export function PatchIcon({ name, size = 24 }: { name: PatchIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "book" && <path d="M16 7C12 3 6 3 2 5v22c5-2 10-2 14 1 4-3 9-3 14-1V5c-4-2-10-2-14 2Zm0 0v21" />}
    {name === "check" && <path strokeWidth="4" d="m7 16 6 6L26 8" />}
    {name === "arrow" && <path d="M5 16h22M19 7l9 9-9 9" />}
    {name === "calendar" && <><rect x="5" y="6" width="22" height="23" rx="3" /><path d="M5 13h22M10 3v6M22 3v6" /></>}
    {name === "flame" && <><path fill="#ff6a0b" stroke="#ff6a0b" d="M17 2c5 6 5 9 5 12l3-5c6 9 7 21-9 21C1 30 2 18 8 11l2 6c-1-7 4-11 7-15Z" /><path fill="#ffba22" stroke="none" d="M17 13c1 6 7 9 4 13-4 5-13 0-9-6l2 3c0-5 1-7 3-10Z" /></>}
    {name === "close" && <path d="m9 9 14 14M23 9 9 23" />}
    {name === "plus" && <path strokeWidth="3" d="M16 5v22M5 16h22" />}
    {name === "home" && <path fill="currentColor" d="m3 15 13-11 13 11-3 1v12h-7v-9h-6v9H6V16Z" />}
    {name === "document" && <><rect x="7" y="3" width="19" height="25" rx="3" /><path d="M7 7H4v22a2 2 0 0 0 2 2h16M12 10h9M12 16h9M12 22h6" /></>}
    {name === "bars" && <g stroke="none" fill="currentColor"><rect x="3" y="18" width="7" height="13" rx="2" /><rect x="13" y="10" width="7" height="21" rx="2" /><rect x="23" y="2" width="7" height="29" rx="2" /></g>}
    {name === "refresh" && <><path d="M26 12A11 11 0 1 0 27 21M26 4v8h-8" /></>}
  </svg>;
}

export function Mascot({ pose = "reading" }: { pose?: "standing" | "reading" | "celebrate" }) {
  // Native Capacitor and web share these local assets; Next image optimization is unavailable on native.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`patch-mascot patch-mascot-${pose}`} src={pose === "standing" ? "/loop-companion.jpeg" : `/patch/mascot-${pose}.png`} alt="" aria-hidden="true" width={pose === "celebrate" ? 663 : pose === "reading" ? 268 : 1024} height={pose === "celebrate" ? 597 : pose === "reading" ? 253 : 1024} />;
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
