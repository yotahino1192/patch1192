# Production API / Vercel / Domain 確認（2026-09-23）

対象: `codex/testflight-production-readiness`、コード確認基点 `ee9ce0f`。

後続更新: 応答サイズ問題は[教材取得修正](materials-response-bounds-20260923.md)で解消。以下は修正前のhosting監査記録。project/domainとschedulerは引き続き未確定。
今回の変更はドキュメントのみ。Production deploy、push、merge、外部サービス設定、DB migration、Archive/Uploadは実施していない。

## 1. 確定状況

| 項目 | 結果 |
| --- | --- |
| Vercel project / team / ID | 未確定。既存21 worktreeに `.vercel/project.json` なし |
| 既存Production deployment | ローカルからは不明。Dashboard確認待ち |
| Production domain / HTTPS origin | 未確定。架空の値は設定していない |
| 過去Sites連携 | 調査したworktreeに `.openai/hosting.json` なし。リモートprojectの不存在を意味しない |
| Git repository | `yotahino1192/patch1192` |
| Vercel構成 | 各worktreeの `vercel.json` はNext.js、`npm ci`、`npm run build` |
| Production allowlist | `config/release-policy.json` のURL/issuer/DBは空。未設定を拒否する状態 |

結論: Vercel Node Functionsで動かす基本構成は適合するが、全データ応答サイズと削除workerの起動方法に未解決事項がある。「Production動作確認済み」とは扱わない。

## 2. デプロイ方式案（承認前・未実行）

| 設定 | 提案 |
| --- | --- |
| Project | 既存projectがあれば設定・履歴確認後に採用判断。なければ新規作成案を提示 |
| Framework / Root | Next.js / repository root |
| Node | 22.x（`package.json` と一致） |
| Install / Build / Output | `npm ci` / `npm run build` / Next.js既定 |
| Runtime | Node.js。Edgeへの変更不要 |
| Fluid Compute | 有効を提案。実際のDashboard値は未確認 |
| Execution | AI・data・削除workerはコードの `maxDuration=60`。その他はproject設定を継承 |
| Source | 承認したcommitをGit連携でbuild。最終commit SHAは修正完了後に指定 |
| Production Branch | 現在値を確認してから決定。`main` への変更・mergeは不要、未実施 |
| Protection | nativeから使うcanonical Production domainでVercelログインを要求しない構成。API自体のClerk認証は維持 |
| Preview | Production envをコピーしない。現コードは `VERCEL_ENV=preview` に `PATCH_ENV=staging` を要求 |

Git push/Import/Deployが自動deployを起こし得るため、現在は行わない。承認する計画にはproject、domain、commit、target環境、Git自動deploy条件を含める。
後続フェーズのClerk/Turso/OpenAI/operations設定とallowlistが揃わないとprebuildが失敗する。hostingだけの空のProduction deployは提案しない。

**CLI source deployの制約:** `scripts/infra/scan.mjs` は `git ls-files` を使う。Vercel CLIのsource uploadでは `.git` が除外されるので、現状そのままのCLI source buildを採用しない。artifact SHAの環境変数fallbackだけではscannerを解決できない。Git連携buildはshallow clone方式。

## 3. アーキテクチャ検証

| 調査対象 | 現コードの挙動・判断 |
| --- | --- |
| API runtime | Route HandlersはNode。healthもNext.js既定のNode。常駐HTTPプロセスは不要 |
| Filesystem | Production DBはremote libSQL。Vercelで `file:` DBを拒否。ローカルDB用mkdirはProduction経路では不要 |
| 配布ファイル | policy/schema JSONは `outputFileTracingIncludes` に含む。既存buildの全12 API traceで両ファイルを確認 |
| Asset生成 | PDF worker/cmapsはprebuildでpublicへ生成。runtimeの永続書込みを要求しない |
| DB接続 | `@libsql/client` によるremote接続。request中の自動migrationなし。Productionの実接続は未検証 |
| 状態管理 | セキュリティledger等はDBに保存。readinessの短いメモリcacheはインスタンスごとの最適化。常駐worker/常駐timerへの依存は見つからない |
| AI | provider timeout 45秒、対象route 60秒、native HTTP 65秒/外側75秒。実provider呼出しは今回行っていない |
| ファイル入力 | PDF/DOCX/PPTX/textを端末側で抽出。10MiBの元ファイルをそのままAPIへ送信しない |
| 抽出上限 | 1ファイル10MiB、添付最大5、合計本文30,000文字、PDF最大200page、Office展開制限8MiB |
| Request body | 共通JSON読込みは既定2MiB、domain系256KiB、AIは個別制限あり。Vercel上限4.5MBより小さい |
| Response body | **下記の実在する上限超過あり** |
| retention | request時の処理とnative側ローカル通知。Vercelで常駐する処理ではない |
| account deletion | DB job、lease120秒、1回1job、route60秒。起動scheduler未設定。下記参照 |

### 実在する問題: 全教材のJSON応答が4.5MBを超える

`db/store.ts:loadAppData` は全教材・カードと教材ごとの元文章を返す。review/chat履歴には500件上限があるが、教材全体のページ分割・応答サイズ上限はない。`app/api/data/route.ts` はGETだけでなく多くの更新後にもこの全体を返す。教材ごとの元文章取得に追加queryも発生する。

ローカルの合成データのみで再現: 60教材 × 日本語30,000文字、各1カードを実際の `saveGeneratedSet` / `loadAppData` に通したところ、JSONは **5,449,562 bytes**。4.5MBと4.5MiBの双方を超える。入力の30,000文字制限内でも蓄積で発生する。これはデプロイ先で413を観測した結果ではなく、実コードで生成した応答量と公式上限の照合。

公開前の修正候補は一覧と詳細の分離・ページ取得、および更新後の差分応答。単に本文を切り捨てると既存UI契約を壊すため、この調査では変更していない。小量データの起動は可能でも、現状を継続利用まで無条件にVercel互換とは判定できない。

### 未設定の運用: 削除worker

内部削除APIはPOSTのみ。`vercel.json` にcronはない。Vercel CronはGETのため、既存routeをそのままcronに登録しても動かない。operationsフェーズで認証付きPOSTを送れるschedulerを用意し、頻度・監視・再試行を決める必要がある。worker secretはscheduler未設定でもProduction buildに必須。`CRON_SECRET` を追加するだけでは解決しない。

## 4. canonical originとドメイン判断

APIだけなら、DashboardでProductionに割り当てられた安定した `vercel.app` HTTPS domainでも技術的には足りる。deployment固有のhash URLやbranch preview URLはcanonicalにしない。

ただしClerk公式はProduction Web認証に所有ドメインとDNS設定を要求し、`*.vercel.app` ではProduction instanceを使えないと説明している。現在のWeb+APIを同じoriginに置く構成を維持するなら、**所有ドメインの既存サブドメインをWeb/API共通にするB案**が最小。新しいPatchブランドのドメインを購入する必要はなく、所有済みのものでもよい。今回Clerkの作成・設定はしない。

native向けAPIだけを `vercel.app` に残し、Clerk/Webを別の所有ドメインに置く構成も技術的には考えられるが、現在の同一origin構成より設定を増やす。ドメイン要件の根拠はClerkであり、TestFlight自体がPatchブランドの独自ドメインを要求するという判断ではない。

実ドメイン未確認のためcanonical値は保留。決定後は以下を揃える（末尾slash、path、queryなし）:

- Vercel: `PATCH_API_ORIGIN` に最終HTTPS origin。
- Vercel: `AUTH_ALLOWED_ORIGINS` に承認済みWeb origin（複数ならカンマ区切り、空白なし）。
- Vercel自動値: `VERCEL_PROJECT_PRODUCTION_URL` はschemeなしhostname。現guardはそのHTTPS originが `webOrigins` にあることを要求。
- repository: `config/release-policy.json` の `production.apiOrigins` / `webOrigins`。
- 後続iOSフェーズ: `mobile/.env.production.local` の `PATCH_API_URL` に同じAPI origin、`PATCH_ENV=production`。

Vercelのproduction URL自動値はcustom domain群から選ばれるため、複数domainやredirectがある場合は実値も確認する。system variableを架空の値で上書きしない。

HTTPS、literal IP全般、localhost/reserved host、allowlist、Clerk live instance、artifact environment/commit/hash、iOS Releaseを検証する既存guardを確認した。LAN URL回避のための変更は不要。

## 5. Vercel Production環境変数一覧

「Devあり」はコード/例/既知の開発構成に対応項目がある意味で、秘密値の確認・再利用を意味しない。公開は秘密として扱う必要がない値、serverはVercel側でのみ設定する値。

| 変数 | 必須/任意 | 公開範囲 | 用途・Production値の条件 | Dev相当 | 新Production値 / 担当フェーズ |
| --- | --- | --- | --- | --- | --- |
| `PATCH_ENV` | 必須 | 公開可・server設定 | `production` | `development` | 切替 / application config |
| `PATCH_API_ORIGIN` | 必須 | 公開可・server設定 | 確定したHTTPS API origin | localhost/LAN | 新規確定 / application config（今回） |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 必須 | 公開・Web bundle | Production live publishable key | test key | 新規 / Clerk |
| `CLERK_ISSUER` | 必須 | 公開可・server設定 | live keyに一致するissuer origin、allowlist登録 | Development issuer | 新規 / Clerk |
| `AUTH_ALLOWED_ORIGINS` | 必須 | 公開可・server設定 | 承認したWeb originのCSV | ローカルWeb相当 | 新規 / application config + Clerk |
| `CLERK_SECRET_KEY` | 必須 | server秘密 | Production live secret | test secret相当 | 新規 / Clerk |
| `TURSO_DATABASE_URL` | 必須 | server設定・非秘密 | remote `libsql:`/`https:`、allowlistとDB ID一致 | `file:.data/loop.db` | 新規 / Turso |
| `TURSO_AUTH_TOKEN` | 必須 | server秘密 | Production DB用token | ローカルDBでは不要 | 新規 / Turso |
| `OPENAI_API_KEY` | 必須 | server秘密 | Production用、AI無効時も現validatorで必須 | 開発AI key相当 | 新規・分離 / OpenAI |
| `OPENAI_CARD_MODEL` | 必須 | server設定・非秘密 | 現allowlistの `gpt-5-nano` を明示 | 同モデル、Dev既定値あり | 同名指定可 / OpenAI + application config |
| `OPENAI_CHAT_MODEL` | 必須 | server設定・非秘密 | `gpt-5-nano` を明示。chat非表示でも必須 | 同モデル、Dev既定値あり | 同名指定可 / OpenAI + application config |
| `AI_ENABLED` | 必須 | server設定・非秘密 | `true`/`false` を明示 | Dev設定相当 | 運用方針決定 / application config + operations |
| `ACCOUNT_DELETION_WORKER_SECRET` | 必須 | server秘密 | 独立したランダム値、32–256文字の英数字/`_`/`-`、他secret再利用禁止 | Devは必須でない、例に項目あり | 新規 / operations |

Vercel/Next.jsが供給するもの（手入力secretではない）:

| 変数 | 必須/任意 | 公開範囲 | 用途 | Dev相当 | Productionへの対応 / 担当 |
| --- | --- | --- | --- | --- | --- |
| `VERCEL_PROJECT_PRODUCTION_URL` | 現validatorで必須 | 公開hostname | Web origin検証・metadata | ローカルでは不要 | 実domainから自動供給、実値確認 / application config |
| `VERCEL_ENV` | Vercelで必須 | 非秘密 | Production/Preview取り違え防止、値は `production` | ローカルなし | Vercel自動 / application config |
| `VERCEL` | provider自動 | 非秘密 | hosted file DB禁止 | ローカルなし | Vercel自動 / application config |
| `NODE_ENV` | build/runtimeでproduction | 非秘密 | Next build/runtimeとenv読込み | Dev serverはdevelopment | Next/Vercel通常自動。developmentを登録しない / application config |
| `VERCEL_GIT_COMMIT_SHA` | Git SHAのfallback | 非秘密 | artifactのcommit識別 | ローカルGit SHA | Vercel Git自動 / application config |
| `VERCEL_URL` | 任意・provider自動 | 公開hostname | metadata fallbackのみ、canonicalに使わない | localhost fallback | Vercel自動 / application config |

Settings → Environment Variablesのsystem variables公開設定も確認する。Production envだけに登録し、Previewへ一括コピーしない。
`config/production.env.example` は参照用で自動読込みされない。

Vercelへ登録しないもの:

- `PATCH_API_URL` / `PATCH_CLERK_PUBLISHABLE_KEY` / `PATCH_CLERK_ISSUER`: mobileの公開build設定。後続フェーズ。
- `CLERK_JWT_KEY`: Releaseでは禁止。
- `PATCH_BACKUP_KEY` / backup key ID: operator側専用。
- Development bypass/mock/debug、local DB、Apple signing/APNsキー。
- `CRON_SECRET`: 現workerの認証変数ではない。

## 6. 今回の変更と検証

- Runtimeコード、release guard、policyの値は変更なし。
- 本報告追加。READMEの古いenv一覧、共有データ/認証なし、自動migrationの説明を現実装に合わせて修正。
- Node22で `tests/infra-env.test.mjs`、`tests/infra-runtime.test.mjs`、`tests/document-import.test.mjs`、`tests/native-http-timeouts.test.mjs`: **27/27成功、skipなし**。
- 既存buildのAPI trace確認（12route）。新たなProduction build/deployは未実施。
- 合成データで応答5,449,562 bytesを再現。検証用DBはメモリのみ、外部DB・providerは使っていない。
- ローカル証跡: `/private/tmp/patch-vercel-phase-tests.log`、`/private/tmp/patch-vercel-response-size.log`。初回再現harnessは `/private/tmp/patch-vercel-response-size.mjs`（後続修正により回帰テストをrepositoryへ追加）。

## 7. 今Dashboardで確認して返す情報（変更不要）

1. Vercel Dashboardで所属teamを選び、ProjectsからPatch / Loop / Yotaまたはrepository名 `patch1192` を探す。
2. 該当projectのDashboard URLを送る（team/projectが分かればよい。project IDやtokenは不要）。なければ「projectなし」。
3. Settings → DomainsでProductionに接続したdomain、Primary/Redirect、設定状態を確認し送る。custom domainがあればDNSを管理できるかも添える。
4. Deploymentsで最新のProduction deploymentの状態（Ready/Error等）と割当domainを送る。
5. Settings → Git / Environmentsで接続repositoryとProduction Branchを確認し送る。
6. Settings → Build and Deployment / FunctionsでNode.js Version、Fluid Computeの状態を確認し送る。
7. Settings → Deployment ProtectionでProduction domainに認証制限がかかるか確認し送る。

現在はCreate/Import/Deploy/Redeploy、domain追加、設定保存を行わない。envの秘密値や画面全体は不要。
上記を得たらproject/domainの実名を本計画に反映し、未解決API制約を含むdeploy条件を確定する。deploy承認はその具体的計画が揃ってから別途受ける。

## 公式根拠（2026-09-23確認）

- [Clerk: Deploy to Vercel](https://clerk.com/docs/guides/development/deployment/vercel) — Production用所有domain/DNS、vercel.app制約。
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — Node、duration、request/response 4.5MB。
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables) — system envとproduction hostname選択。
- [Vercel generated URLs](https://vercel.com/docs/deployments/generated-urls) — deployment/branch/production domainの区別。
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection) — canonical Productionとpreviewの適用範囲。
- [Vercel configure a build](https://vercel.com/docs/builds/configure-a-build) — Git cloneとbuild構成。
- [Vercel build features](https://vercel.com/docs/builds/build-features) — CLI uploadの `.git` 除外。
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) — HTTP GETによる起動。
