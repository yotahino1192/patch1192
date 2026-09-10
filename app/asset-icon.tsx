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
  refresh: "/ui-icons/refresh.png",
  clock: "/set-meta-icons/next-review.png",
  cards: "/set-meta-icons/cards.png",
} as const;

type AssetName = keyof typeof assets;

// Account for transparent padding in the supplied PNGs without changing the files.
const scales: Partial<Record<AssetName, number>> = {
  settings: 1.52, close: 1.81, "chevron-down": 2.27, "chevron-up": 2.72,
  check: 1.39, lock: 1.46, sparkles: 1.83, info: 1.53, plus: 1.58, refresh: 1.35,
};

// Reuse the supplied artwork without drawing or generating new icons.
export function AssetIcon({ name, size = 22 }: { name: AssetName; size?: number }) {
  return <span className={`asset-icon${name in scales ? " asset-icon-ui" : ""}`} style={{ "--asset-icon-size": `${size}px`, "--asset-icon-scale": scales[name] ?? 1.5 } as CSSProperties} aria-hidden="true"><img src={assets[name]} width={1254} height={1254} alt="" draggable={false} /></span>;
}

export function IconLabel({ name, children, size = 20 }: { name: AssetName; children: ReactNode; size?: number }) {
  return <span className="icon-label"><AssetIcon name={name} size={size} /><span>{children}</span></span>;
}
