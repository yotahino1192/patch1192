# Free v1 Learning Core 最終統合レビュー

2026-09-21。開始時の fetch で Dev / origin/Dev = `389acfc4e2d1b804cb11e6e8c1b178a0011ea44a`、CLI3 = `7e4b8dd42a2bdaa32f3b2b247ed10a8a63258f57` を確認。両作業ツリーは clean。
CLI3 に origin/Dev を merge し、`ac5e9583d4e3c87fdc4bb8e058b558f8ca993f7c` を作成した。競合なし。取り込みは CLI2 のリリース文書9ファイルのみで、CLI1 UI と CLI2 実装は保持される。

## 最終確認と限定修正

- Topic の `materialError` / generation input / API は 1–200文字。貼り付け・ファイル由来 source は80–30,000文字のまま。短い例3件、両形式のブラウザ経路で確認。空トピックのAPIエラー文言にだけ残っていた「80文字」を修正した。
- MCQ のクライアント送信から `rating` を除いた。回答内容は selectedChoice のみで、session/item と revision/count/operation ID などの整合性情報を伴う。サーバーは余分な `rating` / `correct` が送られても採点に使わない。
- Study Session は既存割当への非Undo結果の集合から進捗・完了を決定。Flashcard again / MCQ incorrect も処理済み。同じtransactionで結果・復習予定・完了・獲得日を更新し、同じ operation ID は receipt を返す。
- 旧300–600秒の資格条件を外し、短い非空の有効な割当も処理完了で資格を得る。planner のセッション量制限は残す。IANA day clock / DST / 旅行、同日最大+1、Due / Continue / account isolationは変更しない。

## legacy fallback と新規生成の境界

**既存保存データのみ:** `db/study.persistedContent` → `lib/study/content.studyContent` で読取時に互換化する。旧MCQは2–6個のtrim済み一意選択肢に保存正答が含まれる場合、選択式のまま使う。選択肢が壊れた旧行は保存question/answerによる自己評価Flashcardとして表示・処理する。DBの形式・内容を書き換えず、旧選択結果を捏造しない。

**新しい生成・保存:** provider出力は `prepareMaterial` で要求形式を固定し、4個の非空・一意選択肢と有効なcorrectChoiceIndexを検証して実answerへ変換する。`validGeneratedMaterial` は空問題・形式変更・空配列も拒否する。saveSet/addCardsToSetも4択とanswer対応を検証する。いずれもlegacy fallback関数を呼ばず、不正MCQをFlashcardへ変換しない。混在した不正batchは全体を既知のrecoverable validation failureとして返す。0件を保存しない。provider無効出力7ケースとsave/append無効4ケースを追加回帰した。

## 0012 migration・rollback/recovery

追加は `review_logs.response_json` / `payload_hash`、`study_sessions.start_hash`、`sources.input_kind` の4列のみ。前3列はnullable、input_kindはsource既定値。旧行の全既存列を比較して変更がないことを確認する。新Pro構造・テーブル・破壊的データ変換はない。

- runnerは0012のDDLとmigration receiptをtransactionで適用し、checksum・exact schema drift・ownershipを検証する。checksumを書き換える既存migration編集は行わない。
- 新コードは未移行DBに対してreadinessで停止する。リクエスト中の自動migrationは行わない。
- **古いbinaryを移行済みDBへ戻すだけのrollbackは不可。** additive列でも旧exact-schema/manifest検査は新schemaを拒否する。4列を手動DROPしたりmigration receiptを書き換えたりしない。原則は4列を残した互換forward fixを使う。
- 移行前へ戻す必要がある場合は書込み・AI dispatch・deletion workerを停止し、元DBを保全する。事前に検証済みの暗号化snapshotを別の隔離DBへ、snapshotと一致する旧revisionのrestore checkerで復元・検証する。旧snapshotは現在のexact-migration checkerへ無条件に渡さない。再前進する場合は明示0012 migration後に最新checkerを使う。
- snapshot以後の削除/tombstone・consent・AI receipt/UNKNOWN・学習書込みを照合する。これらの後続処理を失うrollbackはデータ損失や削除済みデータ復活を伴う。根拠が揃うまでトラフィックを再開せず、別途承認されたcutoverを行う。詳細は[既存recovery手順](production-recovery-rehearsal.md)。
- 暗号化backup/restore後の選択結果・topic provenance・同じreceiptの再送を検証。account deletionが新列を含む対象行を除き、別ユーザーを保持することを検証する。旧null結果は評価だけ読める。

本レビューはlocal/in-memory/file DBのみ。本番migration・DB接続・配備・Apple操作を行わない。

## 検証結果

最終実行結果を以下に記録する。Nodeは `.nvmrc=22` / `engines=22.x` に従い **22.23.2**、Xcode **26.1.1 (17B100)** を使用。

- `PATCH_ENV=development npm run check`: 成功。typecheck、lint（0 errors / 既存warnings 11）、全 **289/289** テスト、Web build / WEB_ARTIFACT_SEALED。
- migration checksum / drift / 再実行 / 旧データ保持、encrypted backup/restore、account deletion、Retention / timezone / Due / Continue は全テスト内で成功。
- `PATCH_ENV=development npm run ios:sync:local`: mobile build / MOBILE_ARTIFACT_SEALED / sync 成功。
- `xcodebuild ... -destination 'generic/platform=iOS Simulator' ... CODE_SIGNING_ALLOWED=NO build`: BUILD SUCCEEDED。署名・archive・実機配布はしていない。
- `test:build-review-browser`: 成功。topic/text/PDF × Flashcards/MCQ、全問誤答、reload/resume、Complete/History/Review、同日Streak最大+1、Due、MCQ送信にrating/correctがないこと。
- `test:build-patch-browser`: 成功。既存upload、draft保持、validation、再送ID、320–768px。

ログ: `/private/tmp/cli3-integration-*.log`。生成・保存・学習に別経路を追加せず、既存production componentsと認証APIをテスト用identity/隔離DBで検証した。全自動テストとbuildは統合CLI3ツリーの検証であり、署名済みTestFlight成果物の証明ではない。

- `test:auth-browser` / `test:onboarding-browser`: 成功。account switch、stale response、logout、first-run、Day 1、deep link、server session restore。
- 実provider smoke: 安全な既存development設定を読込、DB URLは新規隔離file DBへ強制指定。無害な短いトピック「Photosynthesis」で **Flashcards 1回 / MCQ 1回、合計2回だけ** dispatch。両方 `succeeded`。Review → Save → Study → 最初の回答の永続化まで成功。MCQ要求形式は維持。answer-time AI呼出しなし。失敗・UNKNOWN・自動再送・運用解除なし。
- provider台帳の集計: Flashcards input/output tokens = 472/1257、MCQ = 473/2302。ログは状態・使用量のみで、秘密値・実ユーザー資料は出力しない。ログ `/private/tmp/cli3-integration-live-provider.log`、スクリーンショット `outputs/add-material-review/live-topic-*.png`。ローカル台帳は再送せず監査用に保持した。

## 統合判定と残る配布ゲート

ローカル・統合回帰と実provider smokeは成功。既存lint警告11件は新規エラーではなく、Free v1統合を妨げない。Learning Coreの既知の統合blockerはない。
CLI3をDevへ統合し、同一tree・schema・learning/migration/Retentionの最終sanity確認後に通常pushする。mainは変更しない。

TestFlight/本番には既存の外部ゲートが残る: Apple membership/Team・bundle/App Group・signing/profiles・Connect、実機QA、実環境のClerk/Turso/OpenAI・ドメインと秘密管理、worker/監視/backup運用、運営者・法務・privacy/support文言、ストア素材。詳細は [release owner inputs](release-owner-inputs.md) と [TestFlight runbook](testflight-release-runbook.md)。本レビューでは本番配備・本番migration・Appleアカウント操作を行っていない。最新merge SHAに紐づく署名済み配布artifactも未作成。
