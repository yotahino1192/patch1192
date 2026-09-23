# Patch Free v1 — TestFlight / Production 現状監査（2026-09-23）

現時点では **Archive → Upload に進めない**。主な残件は本番 API/Clerk/DB/OpenAI の実値、削除スケジューラと最低限の運用、公開文書、配布署名である。既存の LAN 排除・成果物検証を維持し、Vercel の環境取り違え防止だけを追加した。機能追加、DB schema 変更、Production 接続・変更、実 OpenAI 呼び出し、配信、マージは行っていない。

この監査は現コードを根拠とする。過去の release 文書にある古い commit や未決事項を、そのまま現在の完了証拠にはしていない。外部ダッシュボードは未確認であり「本番リソースが存在しない」とは断定しない。以下の「未設定」は、この checkout・環境・設定ファイルに利用可能な実値がないという意味。

## 1. 判定一覧

| 項目 | 状態 | 現状／残件 |
| --- | --- | --- |
| Dev base | READY | fetch 後の origin/Dev = `52fa552262723b5206e8afcc7b06b600959e48ca`。指定 SHA と一致、差分なし |
| branch/worktree | READY | `codex/testflight-production-readiness` / `/Users/hinoyouta/Documents/Yota-parallel/.worktrees/testflight-production-readiness`。今回新設 |
| Web/API architecture | READY | Next.js 16 Node API + Vercel 設定。実際の project/domain/region は未確認 |
| Production API | NEEDS SECRET / EXTERNAL CONFIG | 正式 HTTPS origin・hosting が未設定。Mac LAN を使う Release は拒否 |
| Clerk Production | NEEDS SECRET / EXTERNAL CONFIG | 同一 Production instance の Web/mobile key、issuer、server secret、Native API、OTP/DNS 設定 |
| Production DB | NEEDS SECRET / EXTERNAL CONFIG | 専用 Turso/libSQL、token、空 DB への明示 migration・検証。既存本番 DB は変更禁止 |
| OpenAI Production | NEEDS SECRET / EXTERNAL CONFIG | 本番 project key・billing/model access。既存の予約・制限・重複防止は維持 |
| 削除 scheduler | NEEDS SECRET / EXTERNAL CONFIG | POST worker 実装済み。毎分 runner、共有 secret、完了・障害監視が必要 |
| Backup/recovery | NEEDS USER ACTION | 暗号化 backup/ローカル restore-check 実装済み。保存先・鍵保管・期限・復旧手順の実地確認 |
| Monitoring | NEEDS SECRET / EXTERNAL CONFIG | 構造化ログ・probe・集計 CLI は実装済み。通知先・監視 runner・到達確認が未設定 |
| Privacy/legal/support | BLOCKER | `/privacy` `/terms` `/support` はあるが draft・連絡先なし。公開 origin も未決、記述修正が必要 |
| iOS Release | BLOCKER | ID/version/構成はある。本番 mobile bundle がないため既存 Release guard が拒否。配布署名も未検証 |
| Widget | NEEDS USER ACTION | ID/App Group/5画像/4 fonts は存在。コンパイル結果は §10。署名した TestFlight で共有・表示の確認が必要 |
| App Store Connect | NEEDS USER ACTION | App record・契約・メタデータ・輸出申告・レビュー情報。既存 record の有無は未確認 |
| Internal TestFlight | BLOCKER | 本番環境、Release guard、署名、Validate/Upload/processing、internal group が必要 |
| External TestFlight | BLOCKER | Internal 実機 QA の後、beta 情報・OTP reviewer access・初回 Beta App Review |
| Repository fixes | READY | Vercel environment guard＋回帰テスト、秘密なし Production templates、mobile example、誤解を招く ID コメントを修正 |
| Tests/builds | READY | 実行結果と期待された拒否は §10。Production 成功・署名済み Archive 成功とは扱わない |

## 2. 現在の release architecture

- Web は Next.js App Router、同じ origin の `/api/*` へ通信。`vercel.json` は `npm ci` / `npm run build`、API は Node runtime。Cloudflare/vinext の依存や過去の import script はあるが、現 deploy 設定は Vercel。新しい Worker API は不要。
- iOS は Vite で作る `dist/mobile` を Capacitor 8.5.2 が同梱。起動時に Web サイトを Mac から読む構造ではない。`mobile/main.tsx` が native ClerkKit bridge と CapacitorHttp を設定し、焼き込んだ HTTPS API origin へ Bearer 付き JSON 通信。redirect は禁止。
- API → Turso/libSQL、Clerk JWT/JWKS、OpenAI Responses API。iOS の ClerkKit 1.5.4 は直接 Clerk と通信。Web/mobile/API は必ず同じ本番 Clerk instance を使う。
- 小規模 beta なら **同一 Vercel project/origin で Web＋API** が最短。独立 API service や Mac の常時稼働は不要。ただし hosting/domain/region/account は Yota が確定する。別 provider を選ぶ場合は現 Vercel 用契約と legal copy の再確認が必要。
- 本番 API は決定した Web origin（例を実値として登録しない）を `PATCH_API_ORIGIN` と `PATCH_API_URL` の両方へ設定。パス `/api`・末尾 `/` を含めず、DNS 名の `https://…` とする。TLS、60秒 API 実行枠、ネイティブ端末から到達できる公開経路が必要。Vercel のログイン保護をアプリの API に要求しない。
- `config/release-policy.json` の production 配下は API/Web/Clerk/DB allowlist と databaseId が空。models のみ `gpt-5-nano`。staging も空。値は実在サービスを確認してから登録し、fixture を使わない。
- CI は通常 development checks と手動 `release_candidate` の protected `production-validation`。remote migration/deploy/upload はない。hosting の Git 自動 promotion 設定は repo から証明できないため手動確認する。

## 3. 環境変数の完全な実行契約

Development の実機稼働はユーザー申告として確認済み。ただし今回の新規 checkout、元の Yota-parallel root/mobile、継承 shell にはアプリ用実値なし。旧 worktree や秘密ファイルは移植していない。下表の「Dev 未取得」は秘密の有効性未検証を意味する。Production の値も外部 secret manager から未取得で、全て未検証。

**A: public/client-safe**。issuer/API/DB URL は秘密ではないが、DB URL は client へ渡す必要がない。

| 変数 | 目的・消費箇所 | Development 状況 | Production 状況 | 手動対応 |
| --- | --- | --- | --- | --- |
| `PATCH_ENV` | 環境の明示。`lib/env/public.ts`、server、Vite、CLI | example=`development` | `production` が必要、未設定 | server/mobile/runner 別々に設定 |
| `PATCH_API_ORIGIN` | Web/API server 契約・削除 caller。`lib/env/server.ts`, `scripts/infra/operations.mjs` | example localhost、実機 LAN 値未取得 | 空、HTTPS allowlist 必須 | 正式 origin 決定 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web ClerkProvider と validator | Development instance 使用との申告、key 未取得 | `pk_live_` が必要 | Production dashboard から取得 |
| `CLERK_ISSUER` | server JWT issuer の完全一致、Web guard | 値未取得 | HTTPS issuer 未設定 | 上記 key の host と一致させる |
| `AUTH_ALLOWED_ORIGINS` | browser azp と cookie mutation origin。`lib/auth-server.ts` | example localhost | 正式 Web HTTPS origin 未設定 | exact origin のカンマ区切り、空白/wildcard/末尾 slash なし |
| `AI_ENABLED` | `lib/ai/control.ts` と server guard | example=true | 明示 true/false 必須 | 通常 true、緊急停止 false。既開始処理は取消しにならない |
| `OPENAI_CARD_MODEL` | `lib/openai.ts`、server policy | default/example=`gpt-5-nano` | 明示 `gpt-5-nano` 必須 | 値を設定 |
| `OPENAI_CHAT_MODEL` | 同上。Chat は v1 UI 非表示でも guard が要求 | default/example 同上 | 明示 `gpt-5-nano` 必須 | 値を設定、機能を有効化する意味ではない |

**B: server-only secrets / operational secrets**。Web/mobile の env や成果物に入れない。

| 変数 | 目的・消費箇所 | Development 状況 | Production 状況 | 手動対応 |
| --- | --- | --- | --- | --- |
| `CLERK_SECRET_KEY` | `lib/auth-server.ts` JWT 検証/JWKS、`lib/deletion-worker.ts` Clerk user 削除 | 未取得 | 同一 instance の live secret 未設定 | dashboard から安全な server secret store へ |
| `TURSO_DATABASE_URL` | server-only 接続先。`db/client.ts`, guarded DB CLI | default `file:.data/loop.db`、実 DB は未読 | 専用 hosted URL 未設定 | dashboard で既存の有無確認、空 DB を選定 |
| `TURSO_AUTH_TOKEN` | 同上。DB scoped token | ローカル file では不要 | 未設定 | 読書き/運用用途に応じた最小権限と期限 |
| `OPENAI_API_KEY` | `lib/openai.ts` の唯一の provider dispatch | 未取得 | 未設定 | 本番 project の key。停止中でも現 guard は key を要求 |
| `ACCOUNT_DELETION_WORKER_SECRET` | worker endpoint と runner の Bearer 認証 | example 空 | 未設定、Release 必須 | 独立ランダム 32–256 文字 base64url/hex。server/runner 同時設定・交換 |
| `PATCH_BACKUP_KEY` | backup/restore operator のみ。`scripts/infra/backup.mjs` | 空 | 未設定 | ランダム32 bytesを64桁hex化し別保管。server/mobile/CI buildには不要 |
| `PATCH_BACKUP_KEY_ID` | backup manifest の鍵版識別 | example/default=v1 | 保管鍵と対応する ID 未決 | 秘密ではない。旧 backup 用の旧鍵も保持 |

**C: iOS Release config**。mobile はこの4変数だけを供給する。server secrets を含む shell でビルドしない。

| 変数 | 消費箇所 | Development 状況 | Production 状況 | 手動対応 |
| --- | --- | --- | --- | --- |
| `PATCH_ENV` | `mobile/vite.config.ts` | `--mode development` なら未指定時 development | production 必須 | `mobile/.env.production.local` または分離 build env |
| `PATCH_API_URL` | Vite define → `mobile/main.tsx` | example localhost、LAN 実値未取得 | 正式 HTTPS API 未設定 | server と一致 |
| `PATCH_CLERK_PUBLISHABLE_KEY` | Vite define → `PatchAuthPlugin.initialize` | key 未取得 | live key 未設定 | Web と同一 instance |
| `PATCH_CLERK_ISSUER` | Vite validatePublic | issuer 未取得 | 未設定 | server と完全一致 |

Xcode 設定（env ファイルとは別）は `MARKETING_VERSION=1.0`、`CURRENT_PROJECT_VERSION=1`、iOS 17.0、2 target の App Group。`DEVELOPMENT_TEAM` は repo 未設定。配布時に両 target へ `42D2L4D9UL` を選び provisioning を確認する。個人 Debug signing は変更していない。

**D: deployment-platform / command configuration**。

| 名前 | 消費・用途 | Dev / Production 状況 | 手動対応 |
| --- | --- | --- | --- |
| `VERCEL_PROJECT_PRODUCTION_URL` | `app/layout.tsx` の canonical と server Web allowlist。scheme なし hostname | Dev fallback localhost / Prod 未取得 | Vercel 実値が approved Web hostname と一致することを確認。ローカル本番 validation には注入 |
| `VERCEL_ENV` | 今回追加 server guard。production→production、preview→staging | 未設定 | Vercel の System Environment Variables を有効にし、手で偽装しない |
| `VERCEL` | `db/client.ts` の hosted local DB 禁止 | 未設定 | provider 自動値 |
| `NODE_ENV` | Next/`scripts/infra/cli.mjs` の env file 選択 | local Next build も production compilation | 本番コマンドは起動時から `NODE_ENV=production`。`PATCH_ENV` の代用ではない |
| `VERCEL_URL` | layout fallback のみ | 未設定 | provider 自動値。正式 URL の代用にしない |
| `VERCEL_GIT_COMMIT_SHA` / `GITHUB_SHA` | git 不在時のみ artifact SHA fallback | local git から取得 | platform 自動値。手動 fixture 不可 |
| `CI` | DB CLI が remote target を禁止 | ローカル未設定 | platform 自動。CI で本番 migration を行わない |

`DB_ID`、`BACKUP_DIR` は手順内の operator shell 変数で、アプリ env ではない。監視サービス用 webhook env は実装されていない。監視 provider 側で通知先を設定する。GitHub variables/secrets の正確な別名は [configuration contract](production-configuration-contract.md#protected-ci-mapping) と現在の `.github/workflows/ci.yml` を参照（`WEB_HOST`, `CLERK_PUBLISHABLE_KEY`, `TURSO_VALIDATION_TOKEN` など）。GitHub 設定だけでは hosting/runtime は設定されない。

**E: optional / Free v1 に不要**。`CLERK_JWT_KEY` は Development offline public key のみで Release は禁止。`CHROME_PATH` / `TEST_*` / `UI_SCREENSHOT_DIR` はテスト用。APNs、Apple Sign-in、iCloud、Associated Domains、Keychain Sharing、課金、analytics/crash SDK、Cloudflare/D1 は今回追加不要。`DEBUG` 等の有効な開発フラグは Release へ注入しない。Web Clerk SDK の telemetry はアプリ側で停止設定がなく、native は明示 false（§8）。最終文書で「全経路で telemetry なし」と書かない。

読み込み順の注意：root CLI は `@next/env` を使い、`NODE_ENV !== production` なら Development 用ファイルを読む。`PATCH_ENV=production` だけではファイル選択が切り替わらない。Next 本体と pre/postbuild が同じ実値を見るよう、本番コマンド起動前に `NODE_ENV=production` を明示する。mobile は `mobile/.env*` の PATCH 系と shell の PATCH 系（shell 優先）を読み、root `.env` は読まない。`npm run ios:sync` 後の sealed bundle を使う。

秘密なしテンプレート：[server](../config/production.env.example)、[mobile](../config/mobile-production.env.example)。値は空のままで、コピーだけでは release できない。

## 4. Clerk の手動設定

1. Clerk Dashboard で Production instance の有無を確認し、必要なら Production を作成する。ユーザー・Dev secrets はコピーしない。実所有 domain を設定し、表示された DNS records と certificates の検証を完了する。[Clerk Production guide](https://clerk.com/docs/guides/development/deployment/production)
2. Sign-up/sign-in 設定で Email を必須にし、Email verification code を有効にする。コードで完了する構成にする。現在の native custom UI が扱わない password 必須、追加必須 profile fields、MFA/session tasks を強制しない。email link/social/Apple login は有効化しない。[認証方式](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options)
3. Production の Native applications で Native API を有効にし、iOS app に Bundle ID `com.patch.learning` と Apple portal で確認した App ID Prefix（Team ID `42D2L4D9UL` と一致するか確認）を登録する。Widget は Clerk を利用しない。[iOS setup](https://clerk.com/docs/ios/getting-started/quickstart)
4. Production publishable key/secret/issuer を §3 の各欄へ注入し、Web origin と必要な subdomain のみ許可する。API の `AUTH_ALLOWED_ORIGINS` は Web HTTPS origins。`capacitor://localhost` を追加しない。[Allowed Subdomains](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist)
5. 現 native は email code を SDK に送るため OAuth callback は使用しない。`patch://` は通知・Widget → 学習画面の deep link。Web auth は hash routing と `/`、`/sign-up`。不要な mobile SSO redirect を捏造しない。公式 quickstart には Associated Domains もあるが、このアプリの OTP 経路で必要性を検証せず追加しない（ユーザー指定どおり）。本番実機で signup/signin/再起動後session/再認証による削除を必ず検証する。
6. 配信元メール/DNS、実メール到着、再送、期限切れを確認。Native API は browser CAPTCHA を通らない経路なので、Clerk のアクセス・不正登録状況とアプリの全体 AI 上限を監視する。友人招待の TestFlight 制限だけで API 公開登録が制限されるとは考えない。[Native API と bot protection](https://clerk.com/docs/guides/secure/bot-protection)

API は JWT signature/issuer/subject/session/azp、アカウント一致、cookie mutation Origin を検証する。native の Bearer token は azp 省略を許容し、azp がある場合は allowlist が必要。Production guard は test key、`.clerk.accounts.dev`、issuer mismatch を拒否する。構文検証だけで key の実在・同一 instance は証明できない。

## 5. DB / 削除 / retention

13 migrations（`0000`〜`0012_free_v1_learning.sql`）が現在の schema。`config/schema-manifest.json` の checksum と履歴、FK、ownership を検証する。`db/runtime-schema.ts` は **read-only** で、API 起動時に DDL を行わず未移行なら `SCHEMA_NOT_READY` 503。`db:generate` は本番 migration コマンドではない。

最初の本番 DB は独立した空 Turso/libSQL を選ぶ。`ai_control` の初期行は migration が作成。ユーザーは正規 Clerk login による issuer/subject → internal UUID bootstrap。onboarding/sample はユーザー単位の既存機能で、Dev DB、`loop-owner`、既存学習履歴のコピーは不要。retention_state、study_sessions、timezone も通常のアプリ操作で作られる。

既存の owner-scoped query、複合 owner/FK/trigger、`ai_requests_user_key` unique、user/time/state・deletion due index を確認。migration/ownership/isolation/restore テストで検証。新 index/schema は不要と判断した。

本番 migration は **利用開始前の明示手動操作**。以下は将来の承認済み対象にのみ使う手順で、今回は未実行。既存本番 DB がある場合、対象確認・backup・明示承認を先に行い、`--baseline` で勝手に通さない。

```sh
# Node 22、NODE_ENV=production、完全な server 環境を安全に注入した後
npm run check:env
npm run db:migrate -- --allow-remote --confirm-db "$DB_ID" --maintenance-confirmation "$DB_ID"
npm run db:validate -- --allow-remote --confirm-db "$DB_ID"
```

削除は challenge → fresh email 再認証 → 最終確認 → lifecycle/tombstone を保存して即時アクセス停止 → worker が対象学習データ削除 → Clerk user 削除 → completed。challenge は5分、worker lease は120秒、失敗は永続 retry＋指数 backoff（最大6時間＋jitter）。1 invocation は最大1 job。Clerk 404 は削除済みとして処理。Apple connection は利用しないため既存の Apple revocation 専用実装を追加しない。

必要な production job：`npm run ops:deletion-worker -- --execute --confirm-env production` を **毎分**。runner env は `PATCH_ENV=production`, `PATCH_API_ORIGIN`, `ACCOUNT_DELETION_WORKER_SECRET`、Node 22、review済み checkout/dependencies/policy（ファイル利用時は `NODE_ENV=production` も明示）。server 側は §3 の完全環境。endpoint は `POST /api/internal/account-deletions`。`config/deletion-worker.crontab.example` は全行コメントで自動起動しない。Vercel Cron に URL を書くだけではこの POST 契約を実行できないので、対応する既存 scheduler/runner を選ぶ。

runner 非ゼロ終了・retry・5分 heartbeat 欠落、job oldest >1時間を通知する。処理件数は最大1件/分を前提に滞留を確認する。使い捨て本番アカウントで受付→データ/Clerk削除→別端末拒否までを確認して初めて完了扱いにする。

Streak/復習計算は API/学習/同期時、通知は端末で当日分のみ予約、Widget は App Group snapshot＋expiry。日次 retention server cron・Push・Background Modes は不要。削除以外の一括 TTL cleanup job はない。AI result の24時間期限は次の AI admission 時に掃除されるため、物理削除が24時間以内という保証ではない。tombstone/費用台帳/削除記録にも自動廃棄期限はない。この事実に合う保持方針を確定する。

## 6. OpenAI safety

`lib/openai.ts` の server fetch 一箇所から Responses API、`store:false`、model は `gpt-5-nano`。public client graph/secret scanner と artifact hash guard あり。今回実 key の bundle 検証は不可能だが、Development artifacts と合成 fixture の leak tests は検証した。実 provider call は **0回**。

`lib/ai/control.ts` の DB transaction admission、user＋idempotency key unique、payload fingerprint、費用上限の事前予約、dispatch marker、同意/lifecycle の前後検証、unknown 状態の予約保持、succeeded replay を確認。paid retry はない。曖昧な network/timeout/commit は unknown として再送・再予約を止める。MCQ schema/choice validation、保存前の生成内容検証も維持。

| 制限 | 現コードの値 |
| --- | --- |
| cards/ユーザー | 2/分、5/時、10/日、100/rolling31日 |
| chat/ユーザー（API は存在） | 6/分、30/時、60/日、1000/rolling31日 |
| 同時処理 | ユーザー1、全体10（unknown も枠を保持） |
| 全体件数 | cards10/分、chat20/分、合計30/分・1000/時・5000/日 |
| 予約費用の内部上限 | 全体 $1/時・$5/日・$30/31日、ユーザー $0.15/日・$1/31日相当 |
| 入出力制限 | cards input上限24000/output6000、chat12000/1800。inputはUTF-8 bytes＋余裕の保守見積り |
| timeout | provider45秒、API maxDuration60秒、iOS AI connect/read65秒、外側75秒 |

内部費用は `costMicros()` の固定係数で、請求額の保証ではない。実 project の model access、課金有効性、価格との整合、予算通知を Yota が確認する。個別 key を client に配布しない。停止は `AI_ENABLED=false` または guarded `ai:control stop`。Production unknown を Development 専用 resolve で解除しない。provider 結果と費用の確認後、既存 `resolve-final` 手順を使用する。

`store:false` は provider の全保持なしを意味しない。公開文書はこの点を正しく留保している。[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data#v1responses)

## 7. 小規模 beta の backup / monitoring

暗号化 backup は一貫した read transaction、AES-256-GCM、manifest/hash、rowid を保存する。`db:restore-check` はローカル scratch の schema/FK/integrity/行内容を検証して削除する。**本番へ復元するコマンドではない**。provider 固有の replacement DB / cutover は未確定。[既存 recovery 手順](production-recovery-rehearsal.md)

最初の友人 beta は、責任者が日々実施・確認できるなら **手動 backup で開始可能**。例として「1日1回＋migration前、暗号化offsite保管7日、RPO目標24時間、RTO目標1営業日」を提案するが、確定値ではない。RPOは実際の最後の復元可能なsnapshot時刻で判断し、手動作業の遅れも含めて監視する。RTOは provider の新DB復旧と差分照合までの測定後に約束する。運用できなければ日次自動化を選ぶ。

1. 別保管の鍵と保存先を決定し、`db:backup -- --allow-remote --confirm-db "$DB_ID" --out "$BACKUP_DIR"`（毎回新規 directory）。
2. `db:restore-check -- --backup "$BACKUP_DIR"`、暗号化ファイル＋manifest の offsite copy、再取得・復元可能性を確認。`BACKUP_OK` だけでは offsite 成功ではない。
3. 最終成功時刻と保存期限を記録し、期限超過/失敗を通知。保持期限に沿ってコピーを廃棄する。復旧時は新しい DB へ復元し、snapshot 後の削除・同意撤回・AI unknown/費用を照合してから切替える。原本を上書きしない。

Turso の復元機能は選定したDB/planの保存期間を確認して使える。CLI は既存DBの時点から新DBを作成する機能を持つが、今回のアカウントでの可用性・保持期間は未検証。[Turso db create](https://docs.turso.tech/cli/db/create)

| 観測対象 | TestFlight 前の MUST HAVE | NICE TO HAVE |
| --- | --- | --- |
| API/DB | `/api/health` と DB/schema を見る `/api/ready`、5xx/503 の構造化ログと通知先 | latency dashboard、trace |
| Auth | `request_failed` 401/403 の増加と Clerk 側障害を確認、実機 OTP smoke | native auth エラー集計（現 plugin は汎用エラーのみ） |
| AI | `ai_unknown` と diagnostic、provider failure/rate/cost、全体停止手段 | 使用傾向 dashboard |
| 無通信時の滞留 | `npm run ops:status -- --allow-remote --confirm-db "$DB_ID"` を5分毎、15分 heartbeat欠落検知 | 自動 triage |
| 削除 | 毎分 worker、retry/failed/5分 heartbeat/1時間滞留、実削除証拠 | 運用画面 |
| Backup | 最終復元可能copyの時刻、失敗・期限超過、鍵取得＋復元実績 | 自動化、別リージョン冗長化 |
| iOS crash | TestFlight feedback/Apple crash 情報を確認する担当 | 外部 crash SDK（今回不要） |

最小構成は既存 hosting logs＋小さな scheduler＋メール等の通知でよく、新規大規模 platform は不要。ただし生の本文・header・cookie・token・email・教材・会話を転送せず、`lib/safe-log.ts`, `lib/ai/diagnostics.ts`, `lib/operations.ts` の許可フィールドだけを使う。client `configureDiagnostics` の既定 sink は no-op。`config/production-operations.json` は証拠参照用で、監視サービスを作成しない。空欄のため現在 `check:operations` は拒否する。

## 8. Legal/privacy の実装との不一致

公開 route は `/privacy`, `/terms`, `/support`、アプリ内は同じ文書を埋め込み表示。正式URLは **未設定の public origin＋各path**。`lib/public-pages/config.ts` は `publicationStatus:'draft'`、19項目全てnull。正式な問い合わせも送れず、公開済みとは判定できない。

| 箇所 | 現コードとの差／必要な修正 |
| --- | --- |
| privacy/support/terms の AI 説明、`AI_DISCLOSURE` | AI Chat・学習終了時要約を利用機能として説明するが、`app/page.tsx` の `advancedStudyEnabled=false` で Free v1 UI は非表示。現提供は生成中心と記述し、既存server/APIと保持対象の説明は消し去らない。送信範囲変更なら consent version の扱いを確認 |
| 運営者/連絡先/施行日/配信地域 | 実値を Yota が確定。法的住所の公開範囲も判断し、未確定表示を残したまま published にしない |
| 保持/削除 | 学習データ、AI resultの遅延掃除、台帳/tombstone、logs、backup を分ける。削除完了目安、残す記録・保持期限、backup失効・復旧時削除反映を明記 |
| Provider/region | Vercel/Turso/Clerk/OpenAIを列挙済みだが本番契約/regionは未確認。処理地域・越境処理説明を実際の設定に合わせる |
| Diagnostics/analytics | 独立 analytics/crash SDK は見つからない。serverのrequest/AI/運用ログ、provider logsの説明を追加。native Clerk telemetryはfalse、Web ClerkProviderは停止指定なしでSDK collectorはopt-out既定。全経路無収集とは書けない |
| 利用条件 | eligibility/年齢、教材権利、無料beta条件、免責、準拠法・紛争対応、変更告知、サポート回答目安を確定。決定していない文言は今回捏造しない |
| 言語/旧ブランド | legal本文は主に日本語。英語配信時の文書方針が未決。`app/layout.tsx` のWeb metadataはLoop/AI深掘り表記が残る（TestFlight binary自体のblockerではないが公開前に整える） |

収集事実：Clerk email/identity/session、Tursoの教材・カード・回答・履歴/進捗・timezone/設定・同意/削除記録、OpenAIへ同意した入力/抽出本文・設定、運用上のAI利用/診断情報。元PDF/DOCX等は端末抽出であり、抽出本文は送信・保存されるので「添付内容は一切端末外に出ない」は誤り。GPS、Push device token、広告trackingは自前実装にない。

App Privacy は Email Address、User ID、Other User Content、Product Interaction、Diagnostics 等の適合性・目的（主に App Functionality）・ユーザーとのリンクを実設定込みで回答する。端末内のみの情報と送信される情報を区別し、privacy manifestを「Data Not Collected」の根拠にしない。final archive の SDK privacy report と照合する。[Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)

## 9. iOS / App Store Connect / 正確な順序

App=`com.patch.learning`、Widget=`com.patch.learning.widget`、App Group=`group.com.patch.learning.retention`。ユーザーによる両 App ID への App Group 割当済み申告と repo entitlement は一致。両 target は automatic signing、DEVELOPMENT_TEAM は repo に固定なし。project に残る `iPhone Developer` 指定だけで配布証明書の欠落/成功を断定せず、Organizer の配布署名を確認する。

version 1.0/build 1 は `ios/version.xcconfig` を共有。各Uploadのbuild番号はConnectの既存番号を確認して増やす。App Iconは最終1024×1024 PNG、alphaなし。Widgetの5 assets（normal/risk/urgent/restart/complete）、NunitoSans-Bold/MPLUSRounded1c-Bold/Inter-Regular/NotoSansJP-Regularとlicense/Info.plist/resource登録を確認。

Debugのみ `CAPACITOR_DEBUG=true` と `DEBUG` compilation condition。ReleaseにLAN endpointは固定されていないが、Capacitor sync の出力先は共通なので、Archive前に必ずProductionで再syncする。Release shell phaseがSHA/hash/env/allowlistを検査し、古い/Development bundleを拒否する。ATSは `NSAllowsLocalNetworking=true` が共通plistに残るが、arbitrary loadsはなし。これは本番API選択の許可ではなく、Release URL allowlist検証も通らない。今回Debugの実機通信とsigningを変更していない。

Appのprivacy manifestとCapacitor/Cordova/Clerk manifestsをDebug bundleで確認。Widgetは共有file snapshotのみで、メール/教材/tokenを持たない。署名済みarchiveでApp Group entitlement、embedded Widget、SDK privacy reportを再確認する。local notificationsは許可要求のみ、PushやBackground Modesは不要。

このMacは Xcode 26.1.1/iOS SDK26.1。deployment target17.0とは別の話で、現Apple upload要件のXcode26+/iOS26 SDK+に適合する。[Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/)

| Connect 項目 | Internal 前 | External/Beta Review 前 | App Store release 前 |
| --- | --- | --- | --- |
| App record/platform/ID | 必須。Apps→＋New App、iOS、`com.patch.learning` | 共用 | 共用 |
| App name/SKU/primary language | 必須。Patchは実装名、名前の可用性・SKU・primary languageはYota決定 | 共用 | localizationsを確定 |
| version/build/icon | 1.0/1（番号重複確認）、正しいbundle icon、processing成功 | 同じ配布可能build | 提出versionとbuild選択 |
| 契約・role・署名 | Account Holderの有効契約、team・証明書/profile、internal group | group管理権限 | 配信国/価格/追加契約の該当分 |
| encryption/export compliance | TestFlight利用前に回答。`ITSAppUsesNonExemptEncryption`未設定なので手動対応 | 引継ぎ | 最終app/SDKに合わせて確定 |
| beta description/feedback email/What to Test | 自分の検証項目を用意。Store説明全文は不要 | 必須beta情報を入力 | Store用descriptionとは別 |
| review contact/notes/OTP access | 自分のnormal OTPで可 | 氏名・email・電話、単独でOTPを受け取れるreview用メール環境、操作手順 | App Reviewにも必要 |
| support/privacy URL | Connect画面上の入力時期とは別に、実データを扱うPatchの公開文書を準備 | 実在・未ログイン閲覧可能な正式URL | 必須URL、最新本文 |
| Terms/削除 disclosure | アプリの現データ処理と一致させる | 完了目安・窓口も確定 | 正式版を継続 |
| subtitle/keywords/Store description | 不要 | Store完成版は不要 | 最終文言を用意（subtitleは任意、keywords等は提出欄に従う） |
| age rating/App Privacy questionnaire | Store回答完成だけを内部配布blockerにしない。実データ棚卸しは先に必要 | betaの対象年齢/説明を実態に合わせる | 更新済みage rating質問とApp Privacyを回答・公開 |
| screenshots | 最終Store screenshotsは不要 | Store screenshotsだけをbeta blockerにしない | 対応iPhone/iPadの指定サイズ、実候補buildの権利処理済みsample |

既存 draft は [app-store-metadata-draft.md](app-store-metadata-draft.md)、[store-asset-inventory.md](store-asset-inventory.md)。subtitle/description/keywords/primary language/SKU等の未決値は今回確定していない。両targetはiPhone/iPad対応なのでStore提出時はiPadも確認する。

TLS/Keychain等の利用と同梱SDKを確認し、Appleの暗号化質問に回答する。バックアップ用server AESはiOS bundleの機能ではない。今回export complianceを勝手にfalse指定していない。[Apple encryption guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)

将来のrelease実行順（今回の実行許可ではない）：

1. domain/provider/project/regionと本番値を決定。Clerk/DB/OpenAI、削除runner、監視・backup・公開文書を準備。既存本番DBを変更する場合は明示承認を得る。
2. 手動migration/validate、production API公開（別途実行指示後）。health/ready、OTP、ユーザー分離、保存/復習、削除をsmoke。初回の実AI確認は権利処理済み短文を使い、費用を確認する。
3. 最終review済みcommitとversion/buildを固定し、server用shellで `NODE_ENV=production npm run build`、mobile用shellで `npm run ios:sync`。shellに古いPATCH値を残さない。`check:release` と `check:operations` を通す。commitが変われば両成果物を再生成する。
4. Xcodeの両targetでYota Hino/Team IDを選択し、登録済みApp Groupを含む配布署名を確認。App Store ConnectのApp recordと契約/輸出情報を準備する。
5. generic iOS deviceで **Archive**。生成Appに `npm run check:ios-release -- --app <archive>/Products/Applications/App.app`、署名entitlements/Widget/Privacy Reportを確認して **Validate**。
6. 明示した実行指示後に **Upload**。後でExternalにも使うなら **TestFlight Internal Only** の配布方式は選ばない。
7. Connect processing完了、export compliance、Internal groupへbuildと自分を追加。TestFlightから自分のiPhoneへinstall（InternalにBeta App Reviewは不要）。
8. Mac APIを停止・Xcode切断・携帯回線等で、OTP/再起動/session、import→MCQ/flashcards生成→review/save→study→history/streak、local通知、Widget、同意撤回、使い捨てaccount削除を確認。unknown時の自動再送なしも監視。
9. External group、beta説明/feedback/What to Test/review contact・OTPアクセスを準備し、初回 **Beta App Review** を提出。承認後に友人email招待/人数制限付きpublic link。Store全メタデータ完成は後段。

InternalはApp Store Connectユーザー最大100人、Externalは最大10,000人。External groupの前にInternal groupが必要で、最初のexternal buildはfull review。reviewerにOTPを手渡しする運用や固定コードを作らず、専用review inboxへ独立アクセスできる手順を私有Review Notesへ記す。[Apple Internal](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers), [Apple External](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/), [Beta information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/)

## 10. 検証記録

Node 22.23.2、lockfileに対するnpm ci、Xcode26.1.1。local fixture/合成credentialsのみで実provider呼び出しなし。ログは `/private/tmp/patch-testflight-*`。Production成功を偽装するallowlist/key、Release guardの迂回は行っていない。

| 検証 | 結果 |
| --- | --- |
| full unit suite | 最終336/336成功（0 fail / 0 skip、環境取り違え・全必須変数欠落の追加テストを含む） |
| typecheck/lint | 成功。lintは既存unused変数のwarning11件、error0件。機能コードの不要な修正は行わない |
| Web build | 初回sandbox内でGoogle Fonts取得失敗。ネットワークを許可した再実行は成功・WEB_ARTIFACT_SEALED（Development設定のproduction compilation） |
| mobile build / ios sync | `PATCH_ENV=development npm run ios:sync:local` 成功・sealed・コピー完了 |
| Production config / check:release（実値なし） | 継承DEBUG flagを拒否。debugなしの専用条件では両コマンドで `CONFIG_INVALID:API_ORIGIN` を確認 |
| Production mobile（実値なし） | `CONFIG_INVALID:API_ORIGIN` で期待どおり失敗 |
| Operations config | 未設定17欄を列挙して期待どおり失敗 |
| guard/env separation/infra/restore | infra＋ios-releaseの38/38成功（今回の追加テストを含む） |
| iOS Debug / Widget | generic iOS device向け、`CODE_SIGNING_ALLOWED=NO` でBUILD SUCCEEDED。署名成功を意味しない |
| Swift snapshot tests | state/期限/通知重複/serializationテスト成功 |
| iOS App Release | `IOS_NATIVE_CONFIG_VALID` 後、Development成果物を `ARTIFACT_METADATA_INVALID` で拒否。期待された失敗。Production値を揃えて再build/syncするまで完了不可 |
| Widget Release | `xcodebuild -target PatchWidget -configuration Release -sdk iphoneos … CODE_SIGNING_ALLOWED=NO build` 成功。Release産物のID/1.0(1)/compiled Assets.car/4 fontsも確認。自動schemeはホストAppもbuildするため、そちらはAppのguardで停止 |
| Archive/Validate/Upload/実機TestFlight | 未実行。本番値・署名・外部設定待ち |

検証した変更はこの専用branchへ記録する。commit後はSHAが変わるため、このDevelopment検証用bundleを配布に再利用しない。本番値と最終候補SHAで両artifactを再build/syncしてからcheckする。main/Devへのmerge、remote push、デプロイ、App Store Connectの作成/更新/uploadは未実行。

## 11. Yota が次に行う3つ

1. **本番の接続先を確定する。** VercelでWeb/APIを同居させるか決め、所有domain、Clerk Production＋Native API/email OTP、専用Turso DB、OpenAI projectを確認。公開値をrelease-policyへ、秘密を各secret storeへ登録する（チャットやGitに貼らない）。
2. **betaの運用と公開情報を完成させる。** 毎分POST scheduler、失敗通知先、手動日次backupの担当/保管/復旧を決めて実証。正式連絡先・保持/削除方針を含むprivacy/terms/supportを公開し、本番smokeを通す。今回はそのデプロイを行っていない。
3. **同一候補から配布buildを作る。** Productionでbuild/sync→両targetのTeam/signing確認→Connect App record/輸出申告→Archive/Validate。成功後、改めてUploadを実行してInternalでMacなし実機検証。Externalはその後にbeta情報とReview。
