import type { CSSProperties, ReactNode } from "react";

const assets = {
  check: "/ui-icons/check.png",
  settings: "/ui-icons/settings.png",
  close: "/ui-icons/close.png",
  "chevron-down": "/ui-icons/chevron-down.png",
  "chevron-up": "/ui-icons/chevron-up.png",
  lock: "/ui-icons/lock.png",
  sparkles: "/ui-icons/sparkles.png",
  info: "/ui-icons/info.png",
  plus: "/ui-icons/plus.png",
  "plus-dark": "/ui-icons/plus-dark.png",
  "chevron-left": "/ui-icons/chevron-left.png",
  "chevron-right": "/ui-icons/chevron-right.png",
  refresh: "/ui-icons/refresh.png",
  folder: "/ui-icons/folder.png",
  streak: "/ui-icons/streak.png",
  "completed-sets": "/ui-icons/completed-sets.png",
  "long-term": "/ui-icons/long-term.png",
  document: "/ui-icons/document.png",
  "memory-clock": "/ui-icons/memory-clock.png",
  "weekly-study": "/ui-icons/weekly-study.png",
  clock: "/set-meta-icons/next-review.png",
  cards: "/set-meta-icons/cards.png",
} as const;

export type AssetName = keyof typeof assets;

// Account for transparent padding in the supplied PNGs without changing the files.
const scales: Partial<Record<AssetName, number>> = {
  "plus-dark": 2.4, "chevron-left": 4.7, "chevron-right": 4.7,
  settings: 1.35, close: 1.81, "chevron-down": 1.85, "chevron-up": 1.65,
  folder: 1.22, streak: 1.1, "completed-sets": 1.15, "long-term": 1.24,
  document: 1.55, "memory-clock": 1.45, "weekly-study": 1.23,
  check: 1.39, lock: 1.46, sparkles: 1.83, info: 1.38, plus: 1.55, refresh: 1.35,
};

// Reuse the supplied artwork without drawing or generating new icons.
export function AssetIcon({ name, size = 22 }: { name: AssetName; size?: number }) {
  return <span className={`asset-icon${name in scales ? " asset-icon-ui" : ""}`} style={{ "--asset-icon-size": `${size}px`, "--asset-icon-scale": scales[name] ?? 1.5, "--asset-icon-x": name === "chevron-left" ? "2.54%" : name === "chevron-right" ? "-2.44%" : "0%", "--asset-icon-y": name === "chevron-left" || name === "chevron-right" ? "-6.45%" : "0%" } as CSSProperties} aria-hidden="true"><img src={assets[name]} width={1254} height={1254} alt="" draggable={false} /></span>;
}

export function IconLabel({ name, children, size = 20 }: { name: AssetName; children: ReactNode; size?: number }) {
  return <span className="icon-label"><AssetIcon name={name} size={size} /><span>{children}</span></span>;
}
