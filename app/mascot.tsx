"use client";

type MascotPose = "standing" | "reading" | "celebrate" | "happy" | "hello" | "finding";
type MascotAsset = { src: string; width: number; height: number };

// Canonical public URLs; artwork replacement never changes screen-specific paths.
// Dimensions describe the stable presentation canvas, not the incoming file size.
const MASCOT_ASSETS: Record<MascotPose, MascotAsset> = {
  finding: { src: "/patch/mascot-finding.png", width: 1269, height: 1239 },
  hello: { src: "/patch/mascot-hello.png", width: 1245, height: 1263 },
  happy: { src: "/patch/mascot-happy.png", width: 1125, height: 1398 },
  standing: { src: "/patch/mascot-standing.png", width: 1024, height: 1024 },
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
  />;
}
