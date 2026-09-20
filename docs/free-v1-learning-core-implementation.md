# Patch Free v1 Learning Core 実装記録

2026-09-21 / CLI3。実装基準は `d9e304f980711f7c9859b156b89efce4d36cd063`。
作業前に origin/Dev を fetch し、local Dev と origin/Dev が指定 SHA と一致することを確認した。
専用ブランチ `codex/cli3-free-v1-learning-core`、専用 worktree `/private/tmp/patch-cli3-learning-core` で実装した。
以前の監査は [free-v1-learning-core-plan.md](free-v1-learning-core-plan.md) に保存。そこにある旧基準・未実装の記述は調査時点の履歴であり、本書が実装結果を示す。

## 入力と生成

- 既存 Add Material に Source material / Topic の入力種別だけを接続。Topic は trim 後 1–200 文字。Interest Rates / Photosynthesis / Japanese particles を受け付ける。
- 貼り付け・ファイルの統合本文は従来の 80–30,000 文字を維持。アップロードは source に戻す。既存の PDF、DOCX、PPTX、TXT、Markdown、CSV 抽出と容量制限を利用。
- Topic は既存 `/api/ai/cards`、AI Consent、admission、idempotency、AI Hardening を通る。一般知識による生成と明示し、外部検索・取得は行わない。Topic に source 専用 focus や lesson_summary を混ぜない。
- source は入力資料のみを根拠にする既存プロンプトを維持。source/topic/mixed を保存し、トピックをアップロード資料として表示しない。
- provider 応答と保存 API で Flashcard の非空 front/back、MCQ の4個の非空・重複なし選択肢と回答の一致を検証。MCQ の provider correctChoiceIndex を実選択肢に変換する。壊れた生成は保存前に recoverable failure とし、空の学習セッションを作らない。

## 共通 Study Session 契約

既存 Card / ReviewLog / study_sessions を使用する。未来用 Domain の Lesson / Activity / Attempt / Objective は移行・拡張していない。

- start: 所有者と使用可能な候補カードを検証し、既存 planner が選んだ順序・割当を永続化。
- start ID と候補全体のハッシュを結びつけ、同一再送は同じ割当を返す。別候補での ID 再利用は 409。
- 読み取り: `StudySessionView` が assigned IDs、remaining IDs、current item、processed/total、ACTIVE / COMPLETED / UNAVAILABLE、結果と完了日時を返す。
- answer: 認証所有者、セッション所属、次の未処理カード、reviewCount、内容 revision を検証。内容 revision は正規化した問題・回答・形式・選択肢の hash で、スケジュール更新では変えない。
- completion: 全割当カードに Undo されていない結果がある場合に完了。正答・暗記済みを条件にしない。
- review、カードの復習予定、session completion、earned day を同じ DB transaction で更新。最終完了更新の失敗時は回答も巻き戻す。
- 同じ operation ID と同じ回答の再送は保存済み receipt を返す。別内容への使い回しは 409。Undo 済み receipt の再送は回答を復活させない。
- UI はサーバーの残件・完了状態に追従する。誤答を同一セッションの末尾へ再投入しない。既存のバッチ表示はバッチ内の進捗を表示する。

Flashcard の good / again は既存の自己評価を保持。MCQ はサーバーが保存内容と selectedChoice から good / again を決定し、client rating/correct を採点根拠にしない。回答時の AI 呼び出しはない。

## 再開・履歴・安全性

- start と answer は operation ID をアカウント別 workspace に同期保存してから送信する。端末への保存失敗時は送信を止める。
- GET に session IDs を渡し、サーバーの残件と既存 receipt から再構成する。レスポンス紛失後の reload でも処理済み項目を復活させない。
- Continue Learning のサーバー側セッションから別端末でも明示 resume できる。新しい resume API は既存の未完了セッションを processed-items 規則へ整合する。
- 削除・アーカイブされた未処理カードは UNAVAILABLE として扱い、完了を捏造しない。処理済みカードだけが削除された場合は残りを再開できる。編集後の古い revision は拒否し、UI を再読込する。
- 既存の認証 scope による account switch / logout / stale response fence を継続。別ユーザーの session/item は提出・取得不可。
- 完了履歴は既存 Records に最小接続。最新50セッションを返し、Flashcard 評価、MCQ の実選択・正誤を読める。復習ボタンは既存 Patch 詳細へ接続する。
- 結果には当時の question / answer / choices / format を含めるため、後日のカード編集で過去回答の意味が変わらない。

## Retention と legacy

従来の「全問成功」完了条件と「予定時間300–600秒のみ qualifies」を廃止。空でない有効な割当の処理完了は短くても qualify する。300秒を目安にした planner の割当量・600秒上限は維持するが、達成判定の下限には使わない。
IANA timezone / DST / 旅行時の day clock、同一 local day 最大 +1、Due Count、Continue Learning の優先順位は維持する。Undo は根拠となる完了を従来通り取り消す。

既存の完了日時・獲得日は migration で書き換えない。旧未完了セッションは明示再開または次の回答で新ルールに整合し、その時点の日に完了する。旧完了済みの非資格セッションへ過去の Streak を捏造しない。

- legacy MCQ は trim した2–6個の一意な選択肢と正答対応があれば選択式として使える。
- 選択肢が壊れた旧 MCQ は保存済み question/answer を使った自己評価 Flashcard として読む。選択肢を創作しない。
- 旧 self_explain カードも Free v1 の読取では自己評価 Flashcard にする。保存済み形式や将来 Domain の EXPLAIN Activity は変更しない。
- 旧結果の選択肢は復元・推測せず null とし、画面に過去回答未記録を示す。

## DB と移行

`0012_free_v1_learning.sql` は次の4列のみを追加する。

| テーブル / 列 | 必要な理由 | 既存行 |
| --- | --- | --- |
| review_logs.response_json | 旧 rating だけでは実選択と当時の問題を保持できない | null |
| review_logs.payload_hash | MCQ rating と独立して同じ回答の再送を検証 | null、既存 receipt 規則へ fallback |
| study_sessions.start_hash | planner が部分選択しても元の要求全体に ID を結びつける | null、旧 prefix 互換 |
| sources.input_kind | topic を資料由来と偽らず、追記混在も区別 | source |

新規テーブルや既存行の破壊的変換はない。schema manifest と Drizzle 定義を更新。既存 generic backup / restore / deletion は追加列も扱う。
旧 DB の全既存列を比較した upgrade、migration 再実行、暗号化 backup/restore 後の MCQ replay、topic provenance、account deletion と別 account 保全を回帰テストした。本番 DB の migration は実行していない。

## 検証

- Node `.nvmrc` / `engines`: 22.x。実使用 **v22.23.2**。
- Xcode **26.1.1 (17B100)**。Debug / generic iOS Simulator / CODE_SIGNING_ALLOWED=NO。
- `npm run test:unit`: **287/287 pass**。認証、AI Consent/Hardening、timezone/DST、Due、Continue、Undo、migration/restore/deletion を含む。
- `PATCH_ENV=development npm run typecheck`: pass。
- `npm run lint`: 0 errors、既存 unused-variable warnings 11件。
- `PATCH_ENV=development npm run build`: pass / WEB_ARTIFACT_SEALED。
- `npm run ios:sync:local`: mobile build pass / MOBILE_ARTIFACT_SEALED / Capacitor sync pass。
- Xcode Simulator build: BUILD SUCCEEDED。専用 derived data / SPM cache を使用。
- `test:build-patch-browser`: pass。TXT を含む既存 upload / draft / retry / format/focus / 320–768px。
- `test:auth-browser`: pass。account switch、stale native response、logout、reload。
- `test:onboarding-browser`: pass。初回3枚、通信断、DBからの再開、Day 1、deep link、所有権、logout。
- `test:build-review-browser`: pass。既存 Review/Ready と実保存・学習・履歴、320/390/393/430/768px を検証。追加の topic/text/PDF × 2形式では生成 hook → Review → Save → Ready → 全問誤答 → reload/resume → Complete → History/Review と同日 +1 / Due を検証した。
- ブラウザ生成の provider 応答は opt-in fixture。保存・採点・履歴・Retention API と DB は実装本体。別途 API テストでは実 `/api/ai/cards` と Consent/Hardening を通し provider transport のみ mock。課金される実 provider 呼び出しは実行していない。

検証ログは `/private/tmp/cli3-*.log`、スクリーンショットは worktree の `outputs/add-material-review/` と `outputs/add-material/` に生成する（Git対象外）。

本変更は Free v1 の実装 checkpoint。Dev / main への merge・push・本番配備はしていない。実 provider の出力品質と実機配布は、このローカル自動検証の対象外。

検証した範囲で残る Free v1 実装 blocker はない。実 provider 品質の実査、本番 migration、配備は未実施。作業中に共有 Dev は別作業で `389acfc4e2d1b804cb11e6e8c1b178a0011ea44a` へ進んだが、本ブランチの親は指定の `d9e304f` を維持している。
