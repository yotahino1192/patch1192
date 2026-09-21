# Free v1 UI pre-TestFlight quality pass

## 基準と範囲

- `git fetch origin` 後の `origin/Dev`: `7e5335b240ffec3512cae717904333f496188de4`（指定値と一致）。
- 新規 worktree / branch: `.worktrees/free-v1-qa` / `ui/free-v1-pre-testflight-qa`。編集前の working tree は clean。
- 再設計なし。変更は共有 Shell のナビ余白、CSS、添付ファイルの読み上げ表示、検証用コードのみ。Study Session / 採点 / Flashcard の動作 / Retention / Streak / Due / DB / AI Hardening / auth / release configuration は変更なし。

## 修正

1. **Accessibility**: 設定ボタンを44pxに統一。検索クリアも44pxへ。リンク・履歴 summary・Review の名前欄に明確なフォーカス表示。添付ファイルの読み込み／失敗／受付状態を、装飾記号から分離してファイル名付きの live status として読み上げる。
2. **Text scaling**: 固定高・折り返し禁止だった下部ナビを可変高にし、ResizeObserver で測った高さを本文とプレビューの余白に反映。長い日英混在タイトルの学習ヘッダーと Patches 見出しを折り返す。Progress の数値と曜日が200%で重なる不具合を修正。
3. **Keyboard / safe area**: 高さ500px以下では Add Material の sticky CTA を通常フローに戻し、入力欄との重なりを回避。入力欄の scroll margin、フォーカス入力欄の高さ、設定ダイアログの下 safe area を調整。
4. **Empty / loading / error**: 既存状態の意味・再試行動作を維持。空の Patches／Folders／Progress／History、目標完了、復習なし、Retention 更新中、生成中／生成エラー、Explain 失敗・再試行、Ready 開始失敗を実コンポーネントで検証。新しい backend 状態は追加しない。
5. **Responsive**: 320 / 390 / 430 / 768 / 1024 / 1440px、100 / 150 / 200% の文字拡大。グラフだけ必要に応じて横スクロールし、画面全体の横あふれを回避。既存の desktop max-width を維持。
6. **Visual consistency**: 既存の配色・フォントサイズ・カード階層を維持。薄い補助文字と placeholder を既存の濃い blue-gray に寄せ、コントラストを改善。

## 検証

- Node 22.23.2: `PATCH_ENV=development npm run typecheck`、`npm run test:unit` — **292 / 292 pass**。
- `npm run lint` — **0 errors / 11 existing warnings**。最終変更ファイルの ESLint も0 errors（既存の `selectSet` 未使用警告1件）。
- `PATCH_ENV=development npm run build` — Web 最適化ビルドと artifact seal 成功。最終確認は Node 22。
- `npm run mobile:build:local` — Node 22 で build / artifact seal 成功。既存の chunk-size 警告あり。
- `PATCH_PREFLIGHT_QA=1 UI_SCREENSHOT_DIR=/tmp/patch-preflight-final npm run test:ui-browser` — **288 layout conditions + accessible-name checks + existing UI regression pass**。日本語 UI、英語 UI、長い日英混在コンテンツを使用。
- Progress の追加修正後: `PATCH_PREFLIGHT_QA=records UI_SCREENSHOT_DIR=/tmp/patch-preflight-records npm run test:ui-browser` — **36 layout conditions + chart label overlap assertions + control checks pass**。設定／削除確認200%、Escapeのフォーカス復帰、390×360で検索／Source／Topic／focus／Review入力とCTA、Explain失敗・再試行、Ready開始失敗を確認。
- `npm run test:privacy-browser` — consent / cancellation / deletion reauthentication / lost-response receipt 回帰成功。既存ハーネスに worktree 共有フォントの Vite allow-list 警告あり（視覚検証用ハーネスではローカルフォントを許可済み）。
- 最終 mobile bundle を `npx cap sync ios` で同期後、Xcode 26.1.1、Debug、generic iOS Simulator、`CODE_SIGNING_ALLOWED=NO`、DerivedData `/tmp/patch-preflight-derived` にて **BUILD SUCCEEDED**。tracked native 差分なし。
- `git diff --check` 成功。

生成スクリーンショットは上記 `/tmp/patch-preflight-final` と `/tmp/patch-preflight-records` に保存。文字拡大・レイアウト・ラベルの重なりは計測とスクリーンショットの両方で確認。物理端末・VoiceOverの検証は含めない。

## TestFlight 前の残確認

- 文字拡大は Chrome 上で computed font-size を一度だけ100/150/200%にする検証。OS の Dynamic Type、VoiceOver、実機の日本語 IME、キーボード表示・解除、横向き・ノッチ・ホームインジケータは実機で確認が必要。縮小 viewport は実キーボード検証の代わりではない。
- Add Material / Settings の既存の日英混在コピーは今回維持。
- Debug Simulator build は署名なし・開発用 bundle。TestFlight の Archive／配布設定の検証ではない。
- 旧 `check-build-review-browser.mjs` が参照する `tests/fixtures/build-review.html` はこの基準コミットにないため、当該旧スクリプトは実行せず、今回の実コンポーネント用 fixture で Review／Ready を検証。
