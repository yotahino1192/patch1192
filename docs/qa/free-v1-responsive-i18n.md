# Free v1 UI安定化 — レビュー報告

## 1. Devベース

`git fetch origin` 後の `origin/Dev` は指定どおり `79aca25623c02b29230d61fdeb0d5bb4223ee52f`。このコミットから新規ブランチ `codex/free-v1-responsive-i18n` と `/private/tmp/patch-free-v1-responsive-i18n` を作成した。

## 2. 黒い上下領域の原因と修正

コード上では、CapacitorのiOS背景色が未設定だった。使用中のCapacitor 8.5.2はこの場合、WKWebViewとUIScrollViewの背景に `UIColor.systemBackground` を設定するため、ダークモードでは黒になる。`contentInset: automatic` とページ別のCSS safe-area処理も併存していた。さらに、Web側には半透明のシェルやAdd Materialに適用される旧背景が残っていた。

iOSのWebView/scrollViewを明示的に白にし、`contentInset: never` と `viewport-fit=cover` によりsafe-areaをCSSで管理。html/body/mobile root/シェルも白に統一した。グローバルな `overflow: hidden` は追加していない。Capacitor自身の既存のbounce設定は変更していない。

上記は実装から特定した露出経路。今回、物理iPhoneで黒帯の再現・解消を確認したとは主張しない。

## 3. Bottom Navigation

既存の共有Shell/navを継続使用し、ページ別の高さ・幅・bottom指定を削除。4タブ共通の固定位置、幅、余白、選択表示を適用した。navはmainの外にあり、ResizeObserverの実測高を本文の下余白に反映する。タブ遷移では本文を先頭へ戻す。

同一言語・文字倍率では全タブのnav矩形が一致し、本文スクロールでも不変。翻訳や文字拡大による折返しには高さが追従する。Add Materialの2段階目以降とStudyでnavを隠す既存動作を維持した。

## 4. 不要なスクロールを除去した画面

375×812、safe-area上44px/下34px、通常文字サイズで、以下は日英ともdocumentの余分な縦スクロールが0px。

- Home（通常・初回）
- Add Material保存先選択
- 短いテキスト入力
- Customizeの教材全体・トピック設定
- 保存完了画面

Homeは挨拶・最近の教材・学習開始部分の余白を調整。Add Materialはviewport高さとnav予約の重複を解消し、アクションを本文フロー内に置いた。

## 5. 意図的に残したスクロール

Patches、Progress、重点内容を入力する長いCustomize、Review/Save、長い教材・ファイル一覧・エラー表示。小さい表示領域、キーボード相当の縮小、文字拡大時にも必要な縦スクロールを維持する。フォーカス対象とアクションにはnav/画面端を避けるscroll-marginを設定した。

## 6–7. 言語監査と修正

既存の `LanguageProvider`、`loop-language`、日本語キーの `lib/translations.ts` を使用。新しいロケール機構は導入していない。

見つかった問題はAdd Material/Review/Readyの `lang="en"` 固定、直接書かれた英語ラベル・エラー・aria-label、Progress履歴の未翻訳文言、Studyの教材種別説明、Settings/通知/アカウント管理の混在表記。

これらを既存の `t()` に接続した。英語を返す既存バリデータのエラーは `app/build-copy.ts` で表示時に既存辞書へ対応付ける。保存先名、パッチ名、ファイル名、トピック、元の文章、生成された学習内容を翻訳しないことをテストした。通知・認証・削除の処理、AI生成、API、DBの変更はない。公開規約等の文書本文はこのUIコピー修正の対象外。

## 8. タイポグラフィ

ロケールのフォントトークンを復元：日本語本文=Noto Sans JP、見出し/強調=M PLUS Rounded 1c、英語本文=Inter、見出し/強調=Nunito Sans。Studyの20px Bold / 16px Bold / 14px Regularと実際に描画された日本語フォントも既存回帰テストで確認。新規フォントは追加していない。

## 9–10. レスポンシブ・キーボード・アクセシビリティ

168レイアウト：日英 × 12画面状態 × 次の7サイズ。

`320×568`, `375×667`, `375×812`, `390×844`, `430×932`, `768×1024`, `1024×768`

各レイアウトでCSS文字倍率100/150/200%、横はみ出し、主要操作への到達、navの矩形/固定位置、白いルート背景を検証。375×360でAdd Material入力・Customize・Reviewのフォーカス、スクロール、主要操作への到達、通常サイズへの復帰を検証した。実OSキーボードとDynamic Typeの実機挙動は下記の確認が必要。

200%で発見したFlashcardボタンの最小幅と、Progress数値のnowrapによる横はみ出しも修正した。

## 11. 変更ファイル

- シェル・表示：`app/globals.css`, `app/build-patch.css`, `app/layout.tsx`, `app/page.tsx`, `capacitor.config.ts`, `mobile/index.html`
- 翻訳：`app/build-patch.tsx`, `app/build-review.tsx`, `app/build-copy.ts`, `lib/translations.ts`, `app/settings-dialog.tsx`, `app/retention-settings.tsx`, `app/account-deletion-dialog.tsx`, `app/legal-content.tsx`
- QA：`scripts/check-responsive-i18n-browser.mjs`, `scripts/check-build-review-browser.mjs`, `tests/fixtures/ui-phase1.jsx`, `tests/language.test.mjs`, `tests/workflow-rendering.test.mjs`, 本報告

## 12. 検証結果

| 検証 | 結果 |
| --- | --- |
| typecheck | PASS |
| lint | エラー0、既存警告11 |
| unit（Node 22.23.2） | 334/334 PASS |
| 新規レスポンシブ回帰 | 168レイアウト、100/150/200%、日英、PASS |
| 既存Add Materialブラウザー回帰 | PASS |
| 既存Review/Save/Studyブラウザー回帰 | PASS（topic/text/PDF × Flashcard/MCQ、再試行・再開・保存の重複防止を含む） |
| Web build（Node 22、development接続設定） | PASS、artifact seal成功 |
| mobile:build:local（Node 22） | PASS、artifact seal成功 |
| cap sync ios | PASS |
| iOS Debug / generic iOS Simulator / 署名なし | BUILD SUCCEEDED（Xcode 26.1.1） |
| 物理iPhone / 実OSキーボード | 未実施、ユーザー確認待ち |

ブラウザー検証はheadless Chromeの実コンポーネント/隔離fixture。safe-areaはCSS変数で注入した。実AIサービスへの生成テストは行っていない。

再実行：`node scripts/check-responsive-i18n-browser.mjs`。スクリーンショットと計測JSONはworktree内の `outputs/responsive-i18n/`。既存回帰の画像は `outputs/add-material/` と `outputs/add-material-review/`。

## 13. ブランチ・コミット

`codex/free-v1-responsive-i18n`。実装とQAをチェックポイントコミットとして保存。正確なコミットIDは最終応答および `git log -1` で確認できる。Devへのマージ・pushは実施していない。

## 14. iPhone 11 Proでの確認手順

1. 新worktreeに既存の端末用Dev接続設定を適用する。`npm run ios:sync:local` 後、`ios/App/App.xcodeproj` のDebugをiPhone 11 Proで実行する。今回の検証用ローカルbundleのAPI既定値はlocalhostなので、実機には到達可能な既存Dev設定を使う。
2. 文字サイズを通常にし、iOSのライト/ダーク両モードで起動。Home/Patches/Add Material/Progressの上下端を引き、safe-areaと画面外周に黒帯が出ないことを確認する。
3. 4タブを繰り返し切り替え、長いPatches/Progressも上下スクロール。navの幅・高さ・縦位置がタブ間で変わらず、本文の最後が隠れないことを確認する。
4. 通常のHomeで主要内容と学習開始が1画面に収まり、不要な縦移動がないことを確認する。教材追加の保存先、短い入力、教材全体/トピックのCustomizeも確認する。
5. 長い教材/ファイル一覧、重点内容、生成後Reviewを開き、下端の操作までスクロールできることを確認する。
6. テキスト・重点内容・パッチ名を編集して日本語/英語キーボードを表示。入力位置と主要操作に到達でき、キーボードを閉じた後に大きな空白や黒い領域が残らないことを確認する。
7. Settingsで日英を切り替え、nav、通知設定、Add Material全段階、エラー、Review/Save、Study、Progress履歴のシステム文言とフォントを確認する。混在言語のパッチ名/ファイル名/本文は元のままであることを確認する。
8. 端末の文字サイズを拡大して再確認。内容が長くなった場合はスクロールでき、重要な操作が切れたり重ならないことを確認する。Flashcard/選択問題をそれぞれ1回完了し、保存と履歴への遷移も確認する。
