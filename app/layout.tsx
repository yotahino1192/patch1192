import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001"),
  title: "Loop — 知識を小さくして覚え、深く理解する",
  description: "AIで情報をカードに変え、学習・深掘り・復習までをひとつにつなぐ個人知識学習アプリ。",
  openGraph: {
    title: "Loop — 知識を小さくして覚え、深く理解する",
    description: "情報をカードに変え、学習・AI深掘り・復習をひとつの循環に。",
    images: [{ url: "/og.png", width: 1664, height: 954, alt: "Loop 個人知識学習アプリ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop — 知識を小さくして覚え、深く理解する",
    description: "情報をカードに変え、学習・AI深掘り・復習をひとつの循環に。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
