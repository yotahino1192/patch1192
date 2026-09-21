# Free v1 learning-core reliability pass

2026-09-21。開始時に `git fetch origin` を行い、最新の `origin/Dev` が指定の `7e5335b240ffec3512cae717904333f496188de4` と一致することを確認。専用ブランチ `codex/free-v1-reliability`、worktree `/private/tmp/patch-free-v1-reliability` を作成し、変更ゼロから開始した。

## 1. 発見した不具合

- サーバーの Study Session に追従して次のカードへ進む経路で、前のカードの AI 入力・パネル状態が持ち越される。競合した保留回答を破棄しても選択・回答表示が残る。
- Explain API はカードの所有者を確認していたが、指定された Study Session の所有権・カード割当を確認していなかった。自分のカードと他人／存在しないセッション ID の組合せが通り、削除・アーカイブ済みカードも provider 呼出し前には拒否されなかった。他人のカード本文が読めることは再現していない。
- Explain の実行中にカードを編集しても古い説明を保存できた。削除による保存拒否は不確定な AI 操作扱いとなり、後続の AI 操作を妨げ得た。
- 旧セッションの明示再開でリクエストの timezone が無視され、Retention 未初期化なら東京時間になった。
- Patch 行がなくカード行だけ残る状態で、Study の開始／再開／回答と Continue Learning がカードを有効と扱った。Due Count にも残り得た。

## 2. 修正

既存の revision、所有者スコープ、transaction、AI キャンセル処理を使用。カード切替／競合時は回答と AI の一時状態をリセットし、画面離脱後の AI 応答による更新を抑止。Explain は送信前と保存直前に所有する割当・有効なカード／Patch を確認し、実行中の編集・削除は確定キャンセルとして保存しない。再開へ timezone を伝達。Study／Due／Continue は所有する Patch の存在も確認する。

スキーマ、UI の視覚設計、認証設計、採点方式は追加・再設計していない。新機能、旧 U2 の復活もない。

## 3. Session resume

Flashcard／MCQ の回答前 reload、選択済み MCQ の復元、一部処理後 reload、応答紛失後の再構成、再開から完了までを検証。割当・残件・回答 receipt をサーバーから復元する。

## 4. Retry / idempotency

連打、同じ操作の並行送信、通信断後の明示再試行、commit 後の応答紛失、別 payload によるキー再利用、完了再送、Undo 後の再送を検証。Free v1 の回答は `review_logs` に一度だけ記録し、将来 Domain の `attempts` を作らない。完了と Streak は回答と同一 transaction で確定する。

## 5. Account isolation

他人の Patch／カード／セッションの read・write 拒否、pending 中の account switch、旧 native 応答、logout／reload、削除受付後の API 拒否と削除後の別アカウント保全を検証。Explain のセッション割当検証を追加した。

## 6. Edit / delete / contentRevision

古い revision の回答を拒否し、新しいカード内容に再同期。処理前カードの削除・アーカイブ／Patch 不在は UNAVAILABLE とし、既存の再開案内で新セッションへ誘導する。処理済み回答のスナップショットと完了済み履歴は保持する。Free v1 には Patch 全体削除 API がないため、Patch 不在の回帰は隔離 DB から親行を削除して検証した。

## 7. MCQ

正誤両方の実選択を保存。有効／無効 option、偽造 client rating、revision 競合、選択後 reload、旧 2–6 択・空選択肢の fallback、新規不正 MCQ の保存拒否を検証。採点は保存済み正答との比較で、回答時に AI を呼ばない。

## 8. Flashcard

remembered／not remembered とも処理済みになり、全割当の処理で完了する。復習間隔・Due の差、再開後の残件保持を検証。

## 9. Explain with AI

成功、同意取得不可、通信／provider 失敗、不確定操作、連打、次カードへ進んだ後の成功／エラーを検証。Continue は実行可能で、採点・Study Session・Streak・Attempt を変更しない。明示再試行でキーを保持し、不確定操作を自動再送しない。provider transport だけを mock した API テストで、実行中に Continue／編集／削除／アーカイブして結果と台帳を確認した。

## 10. Retention / Streak

短い有効セッション、全問誤答での完了、同日最大 +1、東京の境界・DST 23/25 時間・旅行時の境界、Due、Continue Learning、Undo／再送、完了履歴を検証。旧再開時の timezone と、親 Patch 不在の Due／Continue を修正した。

## 11. Generation → Study E2E

短い Topic／貼付 Text／PDF × Flashcard／MCQ の 6 経路。Generate → Review → Save → Study → interruption/resume → Complete → History/Review を検証。ブラウザ生成は明示 fixture、保存・採点・Retention は実 API／隔離 SQLite。別の API テストは実生成ルート・同意・admission を通し provider transport のみ mock。実 provider 呼出しはゼロ。

## 12. Migration / legacy

既存 `0012_free_v1_learning.sql` の既存列保全、legacy default、再実行、checksum／drift 検知、暗号化 backup／restore、復元後 MCQ receipt、topic provenance、アカウント削除と別 owner 保全を検証。migration／schema の変更なし。本番 DB 操作なし。

## 13. Tests / builds

- Node **v22.23.2**（`.nvmrc` / engines の 22.x）。依存は同一 `package-lock.json` の既存 Dev インストールを worktree 内へ複製。
- 全 `tests/*.test.mjs`: **297 / 297 pass**。最終 DB 修正を含む重点再確認 **43 / 43 pass**。
- `PATCH_ENV=development npm run typecheck`: pass。
- `npm run lint`: 0 errors、既存 unused-variable warnings 11 件。
- `PATCH_ENV=development npm run build`: pass、`WEB_ARTIFACT_SEALED`。
- `PATCH_ENV=development npm run ios:sync:local`: mobile build / `MOBILE_ARTIFACT_SEALED` / Capacitor sync pass。
- Xcode **26.1.1 (17B100)**、Debug、generic iOS Simulator、`CODE_SIGNING_ALLOWED=NO`: **BUILD SUCCEEDED**。
- `test:auth-browser` / `test:privacy-browser` / `scripts/check-reliability-browser.mjs`: pass。
- `test:onboarding-browser` / `test:build-patch-browser`: pass。
- `test:build-review-browser`: pass。追加した両形式の通信断／連打／commit 後の応答紛失／選択保持／再開、AI 遅延エラー、全 6 生成経路を完走。

最初の `npm test` では新しい回帰の赤と、実在セッションを作らない既存 AI fixture の不整合を検出した。修正後、全 unit suite と Web build をそれぞれ再実行して上記結果を確認。Web のフォント取得／localhost browser／Xcode cache は sandbox 制限に当たったため、必要な権限で再実行した。

ブラウザ検証補修として、Home 旧プレビューに依存する Onboarding テストを現行導線へ変更し、Chrome 終了前の一時ディレクトリ削除が本来のエラーを覆い隠さないよう終了待ち・削除再試行を追加した。保留操作の null が workspace 正規化で省略される既存仕様にもテストの判定を合わせた。

ログ: `/private/tmp/free-v1-unit.log`、`free-v1-final-regressions.log`、`free-v1-web-final.log`、`free-v1-types-final.log`、`free-v1-lint-final.log`、`free-v1-mobile.log`、`free-v1-simulator.log`、`free-v1-*-browser*.log`。ブラウザ画像は `outputs/add-material-review/` と `outputs/add-material/`（Git 対象外）。

## 14. 残る blocker / 検証限界

検証範囲で未解決の Free v1 learning-core reliability blocker はない。実機 TestFlight、実 provider 品質、本番 migration／配備はこのローカル検証に含まない。実機固有の OS 強制終了・通信復帰は今後の配布 QA で確認する。

## 15. Git

専用ブランチ `codex/free-v1-reliability` に checkpoint を 1 commit 作成。Dev／main への merge、push、Production deploy は行わない。元 worktree の未追跡計画書は保全。
