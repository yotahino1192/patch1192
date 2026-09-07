# Loop

教材からカードを作り、復習・AI解説・学習記録を使えるNext.jsアプリです。
UIと学習の仕様は従来のまま、VercelのNode.js実行環境に対応しています。

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
5. Deployします。以降mainへのpushで、連携されたVercelプロジェクトが再デプロイされます。

| 環境変数 | 必須 | 値 |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Vercelで必須 | `libsql://...` など、Tursoが発行する接続URL |
| `TURSO_AUTH_TOKEN` | 認証付きDBで必須 | 上記DBの読み書き用トークン |
| `OPENAI_API_KEY` | AI機能に必須 | OpenAIのAPIキー |
| `OPENAI_CARD_MODEL` | 任意 | カード生成モデル。未設定は `gpt-5-nano` |
| `OPENAI_CHAT_MODEL` | 任意 | AI解説モデル。未設定は `gpt-5-nano` |

秘密情報に `NEXT_PUBLIC_` は付けないでください。`.env` をGitHubに追加する必要はありません。
Vercelでは `file:` のDBは使用できません。環境変数が未設定でもビルドはできますが、教材の保存・読み込みにはホスト型DBの設定が必要です。
APIはNode.jsで動作し、実行時間上限は60秒に設定しています。
PDFのWorkerと日本語文字マップはprebuild/predevで同じ依存パッケージからコピーされます。

### データ・アクセスの扱い

既存仕様を保ち、この版にはログインや利用者別データ分離を追加していません。
利用者は同じ教材・記録を共有し、AI利用は設定したAPIキーに課金されます。
限定利用する場合はVercel側のDeployment Protectionなどでアクセス範囲を設定してください。
Cloudflare専用の認証ヘッダーはVercelでは信頼せず、従来のローカル利用者 `loop-owner` を使用します。

## データベースと確認

- スキーマ: `db/schema.ts`
- マイグレーション: `drizzle/*.sql`
- 接続・自動マイグレーション: `db/client.ts`
- 保存と復習の処理: `db/store.ts`
- `npm run db:generate`: スキーマ変更時のSQL生成
- `npm test`: 本番ビルドと自動テスト

初回接続時、SQLをトランザクション内で順に適用します。適用履歴は `_loop_migrations` に保存します。
既存のCloudflareローカルDBをコピーした場合も、既に存在するテーブルや列は維持します。

参考: [VercelのNext.js対応](https://vercel.com/docs/frameworks/full-stack/nextjs) · [Turso TypeScriptクライアント](https://docs.turso.tech/sdk/ts/reference)
