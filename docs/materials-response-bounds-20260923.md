# 教材取得の応答サイズ修正（2026-09-23）

対象branch: `codex/testflight-production-readiness`、修正前checkpoint: `ee9ce0f`。
Production/Vercel/Clerk/Turso/OpenAI/scheduler/Appleの設定、deploy、migration、mergeは行っていない。

## 原因と利用箇所

`GET /api/data` と `POST /api/data` の保存・編集・復習等の成功応答が `loadAppData` 全体を返していた。全教材に30,000文字の `sourceContent` を入れるため、60教材でJSONは **5,449,562 bytes**。カード、keyPoints、summary、folderも全件取得しており、本文だけを消す対策では件数増加に対応できなかった。元文章は教材ごとに追加SQLで取得していた。

利用箇所は `app/page.tsx`（初期読込み、復習/Undo、再開、保存）、`use-material-save.ts`、`set-library.tsx`、`material-manager.tsx`、`study-card-editor.tsx`、`onboarding.tsx`。すべて `useApiFetch` を通り、Webと `mobile/main.tsx` → Capacitor/iOSのUIも同じ実装を使う。

本文表示が必要なのはStudyとMaterialManagerの「元の文章」を展開したとき。カードのquestion/answer/status等はPatches検索、Home、Study、Historyで必要。summaryは既存のHomeプレビュー/教材画面で表示するので保持する。保存済みkeyPointsはonboarding introでのみ必要。

既存 `/api/domain` に別ドメインのsources queryはあるが、今回のlegacy card_setsを直接取得するdetail endpointではない。既存検索の「さらに表示」はクライアント表示件数制御であり、API paginationではなかった。

## 最終API契約

- `/api/data` GET/POST: `materialsVersion: 1` と、sets/cards/folders各collectionの最初のページを同梱。POSTは既存のsetId/cardIds/reviewId等を保持し、dataに同じ新契約を返す。
- `/api/materials?resource=sets|cards|folders&cursor=…&limit=…`: 続きのcollectionページ。
- `/api/materials?resource=source|keyPoints&id=…&cursor=…`: 必要な教材の本文またはkeyPointsの分割detail。
- すべて既存の `requireAuth` / account ownership / no-store / reliability route wrapperを利用。認証ロジック自体は変更していない。

setsのwire whitelist:

`id`, `folderId`, `title`, `category`, `summary`, `sourceKind`, `sourceUpdatedAt`, `createdAt`, `updatedAt`, `lastStudiedAt`, `nextReviewAt`。

**`sourceContent`、`keyPoints`、nested `cards` はsets collectionには含めない。** `sourceUpdatedAt` は既存 `sources.updated_at` を公開metadataへ写したもの。復習でset.updatedAtが変わるたびに同じ本文を再取得するのを防ぐ。cardsは検索/学習に必要な既存Card契約のまま独立してページ取得する。

## 上限と順序

- 既定100件、最大200件。0/負数/小数/最大超過/重複query/異常cursorは400。
- 各collectionページはJSON UTF-8 **512 KiB未満**。行ごとの実serialize bytesを数え、件数上限より先にbyte上限に達すれば残りを次ページへ回す。JSON escapeも計数し、本文の切捨てや圧縮に依存しない。
- 通常の入力上限内の単一cardはページに収まる。異常な既存データで単一itemが上限を超えた場合は小さい503応答にし、黙って捨てない。
- immutable rowidのkeysetと初回max(rowid)のwatermarkを利用。rename/review/moveによるupdatedAtの変化でページを飛ばさない。後から追加された行は次回refreshで取得。
- cursorはowner/resourceを照合。各SQLでもuser_idを必須にする。別accountのcursorを利用できない。
- clientは全ページ取得後に既存の更新日時順/カード作成順/フォルダ名順へ組み立てる。教材の同時刻はid、カードの同時刻は保存時のrowid順を維持し、生成batch内の順序を変えない。途中失敗では不完全な一覧をUIへ渡さない。
- 継続中の削除は除外される。異なるcollection間を含む全体のDB snapshot transactionではないため、別端末からの同時変更は次refreshで反映する。
- detailはSQL `substr` で **32,000 Unicode文字ずつ**。追加入力で単一sourceが長くなっても各応答は上限内。文字列を切捨てず、全chunkを結合して表示する。
- detail中にrevision/長さが変われば409。古い本文と新しい本文を混ぜない。

512 KiBは教材collectionページの上限であり、無関係なdomain/AI/history API全体を再設計したという意味ではない。`/api/data` の教材部分は最大3ページ分に固定され、教材数/本文量に比例して膨らまない。

## ClientとUX

`lib/material-data-client.ts` の共通adapterを `useApiFetch` に組込み、全Web/mobile consumerに既存のAppData形状を渡す。カードはsetIdでMapへまとめて線形時間で結合する。小さいaccountはfirst pagesが同梱されるため追加一覧requestはゼロ。大きい場合はcollectionごとに必要な続きだけ取得し、同時進行は最大3系列。

元文章は共通 `MaterialSource` のdetails展開時だけ取得。既存見出し・配置を維持し、既存の翻訳済みloading/error/retry文言を使う。onboarding keyPointsも必要なintro画面で取得する。Home/Patches/Add Material/Review/Study/History、編集・削除・navigationの契約は維持する。

detailはaccount-scoped transportをkeyにしたメモリcacheで最大8項目、進行中requestも共有。本文更新時はsourceUpdatedAtで無効化し、失敗結果はcacheしない。account変更後の結果は既存scopeのassertCurrentで拒否する。認証やprivacy同意の回避経路は追加しない。

旧wire契約のテストfixtureはadapterで読めるが、新serverには新consumerが必要。未更新の旧iOS bundleとの混在deployを前提にしない。Production導入時はこのclientを含むbuildを使う。

## サイズと性能

同じ合成ケース（60教材、各日本語30,000文字、各1カード）:

| 計測 | JSON bytes |
| --- | ---: |
| 修正前の全体応答 | 5,449,562 |
| 修正後の `/api/data` 初回応答 | 49,753 |

約99.1%削減。source/detail requestなしで全60教材と全60カードを復元できる。

元文章の教材ごとのN+1 queryは除去。新一覧は必要なsource metadataのみ1回のJOINで取得し、SQL時点で行数制限する。`EXPLAIN QUERY PLAN` で既存 `card_sets_user_idx` によるowner/rowid検索を確認。schema/index変更・migrationは不要。

既存のローカル検索・Studyを維持するため、clientはページを結合して全カードを保持する。client総メモリまで件数非依存にする変更は今回行っていない。通信の各応答はboundedで、詳細本文を一括先読みすることはない。

## 回帰検証

- 新API regression: 60×30,000文字、空/小account、205教材の境界、同時rename/insert/delete、最大limit、JSON byte境界、長いMCQ、Unicode本文、追加入力、detail revision競合、404、account isolation、auth拒否。
- Web/native transport: first pagesの組立て、native HTTPS origin、POST結果、本文in-flight/cache共有、account無効化。
- 全unit: **340/340成功、skipなし**。追加の最終サイズ/index検証も4/4成功。
- typecheck成功。lintは0 errors、既存11 warnings。
- Web build成功、mobile Development build + Capacitor sync成功。
- iOS App + Widget: generic iOS device、Debug、`CODE_SIGNING_ALLOWED=NO` build成功。
- `test:build-review-browser`: 実AppのAdd Material/保存/追加入力/Review/Study/History、本文detailのfailure→retry、複数箇所でのcache共有、狭幅/広幅を確認。
- `test:integration-browser`: 実AppのHome/Patches/Review/Study、再開、失敗/重複/response loss、account/logout隔離を確認。
- AIはfixtureのみ。実OpenAI呼出しなし。

証跡: `/private/tmp/patch-material-{size-tests,unit-final,typecheck,lint-final,web-build,mobile-build,ios-debug,browser,integration-browser}.log`。

## 判定

今回特定した **教材全件＋元文章によるVercel応答サイズblockerは解消**。実Vercel deployment検証、hosting project/domain確定、削除scheduler等の別blockerが完了したという意味ではない。
