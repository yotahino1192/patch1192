"use client";

type MascotPose = "standing" | "reading" | "celebrate";
type MascotAsset = { src: string; fallback?: string; width: number; height: number };

// Canonical public URLs. Reading/celebrate currently contain temporary crops;
// replacing these PNGs (and adding standing) needs no component change.
// Dimensions describe the stable presentation canvas, not the incoming file size.
const MASCOT_ASSETS: Record<MascotPose, MascotAsset> = {
  standing: { src: "/patch/mascot-standing.png", fallback: "/loop-companion.jpeg", width: 1024, height: 1024 },
  reading: { src: "/patch/mascot-reading.png", width: 268, height: 253 },
  celebrate: { src: "/patch/mascot-celebrate.png", width: 663, height: 597 },
};

export function Mascot({ pose = "reading" }: { pose?: MascotPose }) {
  const asset = MASCOT_ASSETS[pose];
  // Native Capacitor and web use the same local files. Rays and ground shadows
  // belong inside the transparent art canvas; no extra overlay/filter is added.
  // eslint-disable-next-line @next/next/no-img-element
  return <img
    className={`patch-mascot patch-mascot-${pose}`}
    src={asset.src}
    width={asset.width}
    height={asset.height}
    style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    alt=""
    aria-hidden="true"
    onError={({ currentTarget }) => {
      // One attempt only, including when the fallback itself cannot load.
      if (asset.fallback && currentTarget.getAttribute("src") !== asset.fallback) {
        currentTarget.setAttribute("src", asset.fallback);
      }
    }}
  />;
}
