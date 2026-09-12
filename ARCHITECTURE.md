# Architecture

最終確認: 2026-09-13。この文書は現在の実装を説明する。予定・未実装・検証結果は [STATUS.md](STATUS.md)。起動・環境変数は [README.md](README.md)。コード変更時は関連する記述も更新する。

## 実行構成

- Node.js 22、Next.js 16.3.4 App Router、React 19.2.6、TypeScript。`npm run dev/build/start` は Next.js + webpack を使用する。
- 想定ホストは Vercel の Node.js Runtime。Web版はNext.js + webpackを継続。ViteはiOS同梱フロントエンドのビルドに使用する。Cloudflare/vinextは現在の実行経路では使用しない。
- `/` のクライアント画面が JSON API を呼ぶ。Server Actions は使用していない。
- API は `/api/auth/session`、`/api/data`、`/api/ai/cards`、`/api/ai/chat` とPrivacy/Lifecycle API（後述）。Node.js、動的応答、`no-store`、実行時間上限60秒。
- DB は `@libsql/client`。ローカルは `.data/loop.db`、ホスト環境は `TURSO_DATABASE_URL`。VercelでURL未設定・file URLは実行時エラー。秘密情報はサーバー側環境変数。

## 責務と参照先

| 場所 | 責務 |
| --- | --- |
| `app/page.tsx` | 画面遷移、教材生成、学習操作、API呼び出し。依然として大きいファイル |
| `app/use-workspace.ts` / `lib/workspace.ts` | ブラウザー保存、下書き・中断セッションの検証とDB記録との照合 |
| `app/daily-review.tsx`、`app/set-library.tsx`、`app/material-manager.tsx` | 復習表示、教材一覧、教材管理UI |
| `lib/review.ts`、`lib/daily-review.ts`、`lib/long-term-review.ts` | 復習間隔、日本時間の日付・ストリーク、長期記憶の計算 |
| `app/api/**/route.ts` / `lib/api-input.ts` | HTTP境界、JSON読み取り・入力制限、エラー応答 |
| `db/store.ts` | 所有者で絞ったSQL、教材・履歴・復習計画・会話の保存と読出し |
| `db/client.ts` | DB接続、読取り専用スキーマ検証、トランザクション、ローカル接続の直列化 |
| `db/schema.ts` / `drizzle/` | Drizzleで宣言したスキーマと生成SQL。実際のCRUDは主にパラメーター付きSQL |
| `lib/openai.ts` | サーバー側AI呼び出しと出力の整形 |
| `lib/document-import.ts` | ブラウザーで資料をテキスト化。PDFはpdfjs-distのlegacy build |
| `app/layout.tsx` / `app/globals.css` / `app/asset-icon.tsx` | フォント、共通スタイル、ユーザー提供アイコン |

## データと所有権

主要テーブルは `sources`（原文）、`card_sets`（教材）、`cards`、`folders`、`review_logs`、`chat_messages`、`daily_review_plans`、`user_profiles`。カードの選択肢、要点、当日復習カード一覧、取り消し用の以前の状態はJSON文字列で保持する。

各データに `user_id` がある。Phase 2AのClerk JWT検証後、`auth_identities(issuer, subject)` から内部UUIDを解決する。Emailは所有者キーにしない。リクエストのaccount/sessionヘッダーは署名済みidentityとの一致確認用で、認証証明として信用しない。旧 `loop-owner` は隔離したまま、帰属変更・移行・削除をしない。削除受付済みidentityはtombstoneで再作成を拒否する。

学習テーブル群の外部キー制約は未導入（`auth_identities.user_id` はusersへの参照あり）。資料とカードの関係、削除・アーカイブ・フォルダ整合性は主に保存処理が管理する。全件取得と集計が多く、大規模データ向けのページングは未実装。

## 学習評価の整合性

1. ブラウザーは回答ごとに `operationId` を発行する。カードID、評価、応答時間、送信前の `expectedReviewCount` とともに `pendingReview` として、HTTP送信より先に保存する。
2. 公開評価APIは操作ID・セッションID・期待カウントを必須にする。再送は同じペイロードを使う。
3. `reviewCard()` の書き込みトランザクション内で、所有者＋操作IDの既存記録を調べる。一致する再送は元の履歴IDを返す。カード・評価・セッション・期待カウントが異なる使い回しは409。
4. 新しい操作ではカードの現在カウントと期待カウントを比較する。別タブ等が進めた状態なら409。カード更新、履歴追加、教材の復習日更新はまとめてコミット／ロールバックする。
5. DBの `UNIQUE(user_id, operation_id)` が重複を防ぐ。取り消した記録も保持し、同じ操作IDの再送で再適用しない。
6. 応答だけ失われても、保存済み操作の再送またはDB照合で復元する。正答の完了・誤答の順番移動と回数を復元し、処理済みpendingを消す。

通常の履歴表示は最大500件。復元は別に `GET /api/data?sessionId=...` で該当セッションの全履歴・取り消し操作IDを取得し、表示上限に依存しない。1リクエスト最大100セッション。ブラウザーはアクティブ・中断中IDを100件ずつ取得する。評価POSTの応答にもそのセッションの履歴を含める。

ローカルSQLiteの同一接続はトランザクションと通常クエリが競合しないよう直列化する。リモートlibSQLはDBの書き込みトランザクションと制約を使用する。競合や通信障害は発生し得るが、再送で新しい評価を追加しない。

内部の `reviewCard` は旧呼び出しとの互換性のため操作メタデータ省略を許容している。HTTPからは省略不可。新しい内部呼び出しでも必ずメタデータを渡すこと。教材追加は評価の冪等性保証の対象外。AI会話は別のAI操作台帳で同一操作の再送を拒否し、応答再取得は提供しない。

## 永続化・マイグレーション

- 登録済み教材と回答履歴はDB、編集中内容・中断状態・送信待ち操作はlocalStorage。ブラウザーをまたぐ下書き同期はない。
- ストレージ容量不足・利用不可は画面で通知する。ブラウザーデータ削除後の下書き復元は保証しない。
- request初期化はmanifestと実DBの読取り専用検証のみ。未適用は503 SCHEMA_NOT_READY。適用は独立した npm run db:migrate で明示的に行い、_patch_migrations にchecksumを記録する。GETで当日復習計画の作成が発生することはある。
- 現在は0000〜0008。0007はClerk identityと内部user、0008はPrivacy/Lifecycle（詳細は後述）。0006は所有者IDを主キーとするプロフィールテーブルの追加。0005は `review_logs.operation_id` と2つの索引の追加だけ。旧履歴はNULLのまま維持し、削除・重複修復・データ移送はしない。
- 既存DBを採用する処理はテーブル・列の存在を確認するが、任意のスキーマ破損を自動修復する仕組みではない。
- 配備前にバックアップ・明示migration・schema検証を行う。リクエスト時migrationは実行しない。既存データが大きい場合は索引作成時間を事前確認する。本番適用は今回未実施。

## 入力とセキュリティ境界

全POSTは `application/json` のオブジェクトを要求し、読み取り途中も含め2MiBを超える本文を413で拒否する。評価メタデータ、カード配列、教材保存の文字数・形式を検証する。ただし全アクションの厳密なスキーマ検証は完了していない。

API認証・ユーザー別アクセス制御はPhase 2Aで実装済み。AI同意・削除状態チェックは共通ゲートで実装済み。AI利用回数／同時実行／費用上限は未実装。時間上限や入力上限は利用量制限の代わりにはならない。公開前の推奨案と判断事項はSTATUS参照。

## 品質チェック

`.nvmrc` と `package.json` のNode指定を使い、`npm ci` → `npm run check`。型生成・型検査、Lint、Nodeテスト、本番ビルドを順に実行する。CIは `.github/workflows/ci.yml`。

DBテストは一時SQLiteで行い、通信後エラー、同時送信、ロールバック、取り消し、500件超の復元を検証する。Turso本番環境・外部AI呼び出しを検証したことにはならない。

PDF本体とWorkerは同じpdfjs-distのlegacy buildを使用し、Workerと日本語文字マップをpredev/prebuildでコピーする。Node 22にはない `Promise.try` を互換実装が補う。生成済み `public/pdfjs/**` はLint対象外。Google Fonts取得のため初回ビルドにはネットワークが必要。


## 初回オンボーディング

- `lib/onboarding.ts` が18プリセット（148枚）、興味一覧、目的一覧、おすすめの順位付けを管理する。AI呼び出しは行わない。日本語の入門教材として作成し、英語設定では共通の案内文を翻訳するが、プリセット本文・カテゴリの全面英訳は未実施。
- `loadProfile` は所有者ごとにプロフィールを遅延作成する。プロフィール未作成でも教材・原文・履歴・フォルダのある所有者は完了扱いとして既存ホームへ進む。既存行は書き換えない。新規のClerk利用者には独立した内部所有者を発行する。legacyの自動引継ぎはしない。
- 名前→興味3つ→目的1つ→おすすめ3つ→自動保存→紹介→初回3枚→達成→ホーム。`app/onboarding.tsx` は案内のみを担当し、カード学習は `app/page.tsx` のStudyを共用する。初回はメニュー、編集、AI補助などを表示しない。
- `POST /api/data` の `action: onboarding`、`step: name/interests/goal/select/finish` を使う。入力・段階をサーバーでも検証する。選択時は既存教材のINSERT生成を再利用し、プロフィール更新と同じトランザクションで保存。二重選択・再送でも一つだけ保存する。
- DBに表示名、興味、目的、初回セットID、先頭3枚のID（順序付き）、サーバー発行セッションID、初回学習完了時刻、案内完了フラグと時刻を保持する。localStorageは既存の画面状態の補助だけ。削除されてもプロフィールとセッション履歴で学習途中から再開できる。
- 初回のセッションだけは `again` も一枚の学習として次へ進む。復習間隔の更新自体は通常と同じ。サーバーが指定3枚すべての有効な履歴を確認して、評価の書き込みと同じトランザクションで初回学習完了を記録する。
- ストリークを別カウンターにせず `daily_review_plans` の完了日と既存 `streakLength` を共用する。初回進行中の当日ToDoは3枚に限定。日をまたぐ場合は3枚を終えた日を達成日とし、同日には一日分だけ記録する。通常の復習ToDoは従来どおり。
- 学習完了後の「ホームへ」で `onboarding_completed` を更新する。直前で閉じた場合は完了画面へ戻り、完了済みならホーム。Clerkのユーザーごとに完了状態を保持する。Sign in with Apple・名前自動取得は未接続。

手動ブラウザー検証は `npm run build` 後に `npm run test:onboarding-browser`。Node 22とChromeが必要で、macOS以外は `CHROME_PATH` を指定する。一時DB・専用Chromeプロファイルを使い、終了時に削除する。通常利用のDBは使用しない。

## iOS / Capacitor（Phase 1）

- `mobile/main.tsx` は既存 `app/page.tsx` を直接読み込む。UI・学習ロジック・LanguageProviderは共有し、別実装にコピーしていない。
- Viteの別入口 `mobile/vite.config.ts` が `dist/mobile` に静的HTML/JS/CSSを出力。Next.jsサーバー/API/DBはアプリに同梱しない。
- Capacitor 8.5.2、`ios/App/App.xcodeproj` の Appターゲット。Swift Package Managerで同版のネイティブライブラリを使用。iOS最低16.4。現在のBundle ID `com.patch.learning` は開発用の仮ID。
- `lib/api-client.ts` はWebでは同一オリジンfetch。iOS起動時だけ `CapacitorHttp` を使うJSON通信へ切り替える。Native Clerkの短寿命Bearerを送信し、APIで同じissuerと内部userを確認する。画像/PDF取得はネイティブHTTPへ置き換えない。
- 接続先は公開設定 `PATCH_API_URL`。モバイル専用envディレクトリを使い、サーバーの秘密情報をビルドへ渡さない。開発既定はlocalhost:3001、本番モードはHTTPS originを必須にする。
- `public/`、PDF Worker/cmaps、Fontsourceの日本語・英語フォントを同梱。Web版のnext/fontは維持。
- localStorageはWKWebViewのcapacitor://localhostの領域。`patch:workspace:v2:<userId>` で所有者を分離し、SafariやWeb版とは共有しない。Clerkの永続認証情報はネイティブSDKのアプリ専用Keychain。下書きの端末間同期は未実装。
- `scripts/check-ios-bundle.sh` をXcode build phaseで実行。Releaseではローカル開発用bundleを拒否。配布可能な認証・プライバシー等が整ったことを保証するチェックではない。
- 起動・env・手動チェックは [mobile/README.md](mobile/README.md)。`ios:sync:local` → `ios:open` → Xcode Run。本番接続先は `ios:sync`。
- 署名Team、正式なApp Icon、通知、ウィジェット、ディープリンクは未整備。認証はPhase 2A、Privacy/Lifecycleは以下。既存データ移行は行わない。


## Privacy / Account Lifecycle

詳細と運用条件は [docs/privacy-lifecycle.md](docs/privacy-lifecycle.md)。Web/iOSとも `LanguageProvider → AuthBoundary → AccountContext → PrivacyProvider → 既存UI` を共有する。

- `lib/privacy-policy.ts`: 日本語/英語の同意説明・consent/policyバージョン。
- `app/privacy-provider.tsx`: 初回手動AI操作の明示的同意、設定からの変更、所有者をまたぐpending操作の破棄。自動lesson summaryでは同意ダイアログを開かず、未許可なら送信しない。
- `db/privacy-store.ts` / `lib/ai-gateway.ts`: active user・現行同意を確認し、`(user_id, operation_id)` 一意のAI台帳を外部送信より先にコミット。外部応答後はgeneration・同意revisionを再確認。chat保存はそのトランザクション内。生成候補は確認後に返し、ユーザーが後で既存保存APIで保存する。
- 同一AI操作IDは成功/失敗に関係なく再送拒否。外部送信とDBは原子的でないため、結果不明の台帳はstartedのまま保守的に残す。外部APIのexactly-onceや応答キャッシュを保証する設計ではない。
- `users.lifecycle_state`: active → deleting → deleted。受付トランザクションでgenerationを増やし、tombstoneとjobを作る。全protected APIは `requireAuth`、削除の再送だけ署名済みidentity＋receiptで処理する。
- 0008はuserデータのINSERT/UPDATEトリガーも追加する。削除以前に認可済みの通常APIでも、inactive userへの遅延書込みをDBで拒否する。usersの最小削除行を残すことがこの境界の条件。
- `db/account-deletion.ts`: 5分のチャレンジとClerk署名済み再認証ID・factor ageを検証し受付。クライアントの成功booleanやOTPをサーバーで信用しない。
- `lib/deletion-worker.ts`: DB消去 → Apple該当判定/将来revocation → Clerk削除 → identity消去。永続job、120秒lease、指数バックオフ。POST内部workerは32文字以上の専用Bearer secretで保護し、1回1job。スケジューラーは別途必須。
- `lib/account-cleanup.ts`: 対象workspace・同意停止フラグと将来のscoped cleanup hook。logout中断の消去intentは次回同じsessionの起動で再開。未同期のAI撤回は通常logoutで消さない。削除時のネイティブClerk Keychain消去は待機可能APIを使い、SDKのメモリー状態も再構成する。
- 公開 `/privacy` `/support` `/terms` とアプリ内の共有コンテンツは公開準備中。正式運営者・連絡先・保持期間は未確定と表示する。完成した法務文書として配布しない。

追加API: `GET/PUT /api/privacy/consents`、`POST /api/account/deletion`（challenge/delete）、`GET /api/account/deletion`（receiptで状態のみ）、`POST /api/internal/account-deletions`（worker専用）。一般利用者がworkerを起動するAPIは提供しない。

## Production Infrastructure統合

PATCH_ENVを明示し、Production Environment Validation、explicit migration runner、Release Guardrails、暗号化Backup/Restoreを維持する。復元時は外部キーをtransaction終端で検証し、Privacyの同意・tombstone・削除job・inactiveトリガーも保持する。詳細は [Production Infrastructure](docs/production-infrastructure.md)。
