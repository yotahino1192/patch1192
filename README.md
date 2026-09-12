# Loop

教材からカードを作り、復習・AI解説・学習記録を使えるNext.jsアプリです。
UIと学習の仕様は従来のまま、VercelのNode.js実行環境に対応しています。

UIアイコンは既存の画像素材、または標準の絵文字を使用します。Codexによる独自のSVG・CSS描画アイコンや新規生成アイコンは追加しません。既存画像の共通表示は `app/asset-icon.tsx` を利用できます。 設定・閉じる・開閉・チェック・鍵・きらめき・説明・追加・再生成は、ユーザー提供の `public/ui-icons/` のPNGを優先します。
`public/nav-icons/` の画像は下部メニューバー専用です。画面内のボタン、見出し、ブラウザーのタブアイコンには流用しません。

現在の設計は [ARCHITECTURE.md](ARCHITECTURE.md)、検証結果と公開前の課題は [STATUS.md](STATUS.md) を参照してください。

## ローカルで起動

Node.js 22系を使います。

```sh
npm ci
cp .env.example .env
# .env の OPENAI_API_KEY を設定
npm run dev
```

http://localhost:3001/ を開きます。
TURSO_DATABASE_URLを未設定にすると、ローカル専用の `.data/loop.db` を使います。
データベースのテーブルは初回接続時に自動作成されます。
`.env` と `.data/` はGitに含まれません。

教材の入力・添付資料から読み取った文章・編集中のカード候補と、中断中の学習はブラウザーへ自動保存します。
再読み込み後はホームの「下書きの続きから」「続きから学習」から再開できます。
下書きと中断状態は同じブラウザー・同じURLで利用でき、別端末には同期されません。ブラウザーのサイトデータを削除すると消去されます。
登録済み教材と記録済みの回答はデータベースに保存されます。

学習中は「一つ前のカードに戻る」で、最後の回答と復習予定を戻せます（この機能追加後に記録した評価が対象）。
「中断する」は今回の学習開始元へ戻ります。ホームからはホームへ、セット詳細からは同じセット詳細へ戻り、開始元は途中保存にも含まれます。
「このカードを修正」から学習を離れずに質問・答え・4択の選択肢を編集できます。
ホームで復習が6枚以上ある場合は「まず5枚だけ学習」を選べます。区切りで続けるか中断するかを選び、残りはホームから再開できます。

記録の長期記憶は復習間隔60日以上（30日間隔の復習を完了）、もう少しで到達は30日以上60日未満の定着中カードです。学習し切ったセットは、有効なカードが1枚以上あり、すべて長期記憶に到達したセットを数えます。アーカイブ・削除済みカードは対象外です。
「記憶し直したカード数」は、日本時間の日付ごとに正しく思い出せたカードを重複なく集計します。取り消した回答を除き、回答履歴の500件表示上限にかかわらず直近7日間全体を集計します。
教材一覧の検索は、フォルダをまたいで教材名・質問・答えを対象にします。

### 従来のCloudflareローカルデータを引き継ぐ

新しいアプリを初めて起動する前に実行してください。

```sh
npm run db:import-local
```

`.wrangler/state` のSQLiteデータを `.data/loop.db` にコピーします。
元データは削除せず、既存の移行先ファイルも上書きしません。
ローカルデータはGitHubへのpushだけでは公開データベースに転送されません。

## Vercelからデプロイ

1. Tursoでホスト型libSQLデータベースを作成し、接続URLと認証トークンを取得します。
2. Vercelの「Add New → Project」で `yotahino1192/patch1192` をImportします。
3. Framework Presetは **Next.js**、Root Directoryはリポジトリのルートです。
   ビルドコマンドは `npm run build`、Output Directoryはデフォルトのままにします。
4. 以下の環境変数をVercelのProject Settings → Environment Variablesに設定します。
   利用するProduction/Preview環境それぞれに設定してください。
5. Deployします。Productionへの自動昇格は有効にせず、[Production運用手順](docs/production-infrastructure.md)に従ってbackup・migration検証後にreleaseしてください。

| 環境変数 | 必須 | 値 |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Vercelで必須 | `libsql://...` など、Tursoが発行する接続URL |
| `TURSO_AUTH_TOKEN` | 認証付きDBで必須 | 上記DBの読み書き用トークン |
| `OPENAI_API_KEY` | AI機能に必須 | OpenAIのAPIキー |
| `OPENAI_CARD_MODEL` | 任意 | カード生成モデル。未設定は `gpt-5-nano` |
| `OPENAI_CHAT_MODEL` | 任意 | AI解説モデル。未設定は `gpt-5-nano` |

秘密情報に `NEXT_PUBLIC_` は付けないでください。`.env` をGitHubに追加する必要はありません。
Vercelでは `file:` のDBは使用できません。PATCH_ENV=productionでは環境変数とallowlistが未設定の場合buildが失敗します。DB schemaはrequestから更新せず、npm run db:migrateで明示的に準備してください。
APIはNode.jsで動作し、実行時間上限は60秒に設定しています。
PDFのWorkerと日本語文字マップはprebuild/predevで同じ依存パッケージからコピーされます。

### データ・アクセスの扱い

既存仕様を保ち、この版にはログインや利用者別データ分離を追加していません。
利用者は同じ教材・記録を共有し、AI利用は設定したAPIキーに課金されます。
限定利用する場合はVercel側のDeployment Protectionなどでアクセス範囲を設定してください。
APIはClerk認証と内部user IDによる所有権確認を使用します。`loop-owner`への自動割当はありません。

## データベースと確認

- スキーマ: `db/schema.ts`
- マイグレーション: `drizzle/*.sql`
- 接続・自動マイグレーション: `db/client.ts`
- 保存と復習の処理: `db/store.ts`
- `npm run db:generate`: スキーマ変更時のSQL生成
- `npm test`: 本番ビルドと自動テスト
- `npm run check`: Node 22で型検査・Lint・自動テスト・本番ビルド
- `npm run test:unit`: 自動テストのみ

初回接続時、SQLをトランザクション内で順に適用します。適用履歴は `_loop_migrations` に保存します。
既存のCloudflareローカルDBをコピーした場合も、既に存在するテーブルや列は維持します。

参考: [VercelのNext.js対応](https://vercel.com/docs/frameworks/full-stack/nextjs) · [Turso TypeScriptクライアント](https://docs.turso.tech/sdk/ts/reference)

## Infrastructure Phase 1

Set `PATCH_ENV=development` locally, run `npm run db:migrate` before first use, then start the app. Production/Staging require reviewed allowlists and explicit configuration. See [Production runbook](docs/production-infrastructure.md). No Production operation has been executed by this branch.
