# グラデーション使用箇所（カラー統一前）

今回の変更ではグラデーションの描画色を維持。重複する古い定義も記録し、後続ルールによる上書きは従来どおりです。PNG素材内の陰影も変更していません。

| セレクター | 既存の定義 |
| --- | --- |
| `body` | `radial-gradient(circle at 50% 0, #fff 0, #f4faee 58%, #e9f4dd 100%)` |
| `.review-card` | `linear-gradient(120deg,#fff,#fbfdf8)` |
| `.review-card.is-due` | `linear-gradient(120deg,#fff,#f6fbf1)` |
| `.focus-content` | `linear-gradient(115deg,#fbfdf9,#f6fbf1)` |
| `.blue-set` | `linear-gradient(135deg,#6d973e,#8ebb5a)` |
| `.green-set` | `linear-gradient(135deg,#597c32,#90bd5c)` |
| `.violet-set` | `linear-gradient(135deg,#92be5f,#b5da8a)` |
| `.floating-add` | `linear-gradient(100deg,var(--blue),#a6ca7c)` |
| `.auto-count-note` | `linear-gradient(110deg,#fafdf7,#f9fcf5)` |
| `.primary` | `linear-gradient(100deg,var(--blue),#98c269 60%,var(--cyan))` |
| `.success-banner` | `linear-gradient(100deg,#f9fcf5,#fcfdfa)` |
| `.set-hero` | `linear-gradient(115deg,#5f8335,#8dbb59)` |
| `.study-progress-fill` | `linear-gradient(90deg,#b3e968,#68cba1)` |
| `.flashcard` | `linear-gradient(145deg,#fff,#f8fbf4)` |
| `.flashcard.flipped` | `linear-gradient(145deg,#fdfefb,#f4f9ee)` |
| `.ai-answer h3 i` | `linear-gradient(130deg,var(--cyan),var(--blue))` |
| `.inline-ai-panel` | `linear-gradient(145deg,#fcfdfa,#fff)` |
| `.bar-chart span` | `linear-gradient(var(--blue),var(--cyan))` |
| `.completion-review` | `linear-gradient(120deg,#f7fbf2,#f6faf1)` |
| `body` | `radial-gradient(ellipse at 12% 0, #efffdc 0, transparent 48%), radial-gradient(ellipse at 100% 20%, #e5faf3 0, transparent 45%), #f8fcfa` |
| `.primary,.review-cta,.home-review .review-cta,.manager-actions .primary` | `linear-gradient(110deg,transparent,rgba(255,255,255,.3))` |
| `.floating-add` | `linear-gradient(110deg,#b9f1d8,#d4f8e9)` |
| `.blue-set` | `linear-gradient(135deg,#c3f36b,#def9aa)` |
| `.green-set` | `linear-gradient(135deg,#9de8cb,#cff7e8)` |
| `.violet-set` | `linear-gradient(135deg,#ffd0aa,#ffe6ca)` |
| `.set-hero` | `linear-gradient(115deg,#c7f780,#a6ebcd)` |
| `.focus-content` | `linear-gradient(115deg,#effbf5,#fff7eb)` |
| `.flashcard` | `linear-gradient(145deg,#fff,#f6fde9)` |
| `.flashcard.flipped` | `linear-gradient(145deg,#fff,#e6faf2)` |
| `.success-banner` | `linear-gradient(110deg,#e6faf1,#f7fde9)` |
| `.bar-chart span` | `linear-gradient(180deg,#b4ee64,#69d3ab)` |
| `.inline-ai-panel` | `linear-gradient(145deg,#f1fcf7,#fff)` |
| `.home-page .companion-greeting::after` | `linear-gradient(to bottom, rgba(255,255,255,.5), transparent 16%, transparent 72%, #fff 100%)` |
| `.streak-highlight::before` | `linear-gradient(110deg,transparent 32%,#ffffffb3 50%,transparent 68%)` |
| `.review-celebration` | `linear-gradient(110deg,#effcdb,#e6faf1)` |

## 共通デザイン変数

`app/globals.css` 冒頭で4色、派生色（面・枠線・補足文字）、20/16/14px、400/700を管理しています。`.dark` は指定された反転パレットを提供します（テーマ切替機能の追加はしていません）。既存グラデーションと画像の色は維持するため、暗色テーマでも明るいグラデーション面は残ります。

`app/layout.tsx` の `next/font` で Inter / Noto Sans JP / Nunito Sans / M PLUS Rounded 1c を読み込みます。本文はInter→Noto Sans JP、見出し・ボタンはNunito Sans→M PLUS Rounded 1cの順で、欧文と日本語のグリフを使い分けます。フォントはビルド時に取得し、配信時はセルフホストします。

画像・絵文字アイコンの寸法は文字サイズの対象外として維持しています。ナビゲーションの補助ラベルは14pxです。
