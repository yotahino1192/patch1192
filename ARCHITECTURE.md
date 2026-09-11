# Architecture

最終確認: 2026-09-11。この文書は現在の実装を説明する。予定・未実装・検証結果は [STATUS.md](STATUS.md)。起動・環境変数は [README.md](README.md)。コード変更時は関連する記述も更新する。

## 実行構成

- Node.js 22、Next.js 16.3.4 App Router、React 19.2.6、TypeScript。`npm run dev/build/start` は Next.js + webpack を使用する。
- 想定ホストは Vercel の Node.js Runtime。Cloudflare/Vite/vinext 関連の開発依存は残っているが、現在の起動・本番ビルド経路には使用しない。
- `/` のクライアント画面が JSON API を呼ぶ。Server Actions は使用していない。
- API は `/api/data`、`/api/ai/cards`、`/api/ai/chat`。Node.js、動的応答、`no-store`、実行時間上限60秒。
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
| `db/client.ts` | DB接続、自動マイグレーション、トランザクション、ローカル接続の直列化 |
| `db/schema.ts` / `drizzle/` | Drizzleで宣言したスキーマと生成SQL。実際のCRUDは主にパラメーター付きSQL |
| `lib/openai.ts` | サーバー側AI呼び出しと出力の整形 |
| `lib/document-import.ts` | ブラウザーで資料をテキスト化。PDFはpdfjs-distのlegacy build |
| `app/layout.tsx` / `app/globals.css` / `app/asset-icon.tsx` | フォント、共通スタイル、ユーザー提供アイコン |

## データと所有権

主要テーブルは `sources`（原文）、`card_sets`（教材）、`cards`、`folders`、`review_logs`、`chat_messages`、`daily_review_plans`。カードの選択肢、要点、当日復習カード一覧、取り消し用の以前の状態はJSON文字列で保持する。

各データに `user_id` がある。ただし **認証は未実装**。`requestUserId()` は常に `loop-owner` を返し、全利用者が同じデータを共有する。所有者条件付きSQLがあっても利用者を識別しているわけではない。外部認証ヘッダーは信頼しない。

外部キー制約は未導入。資料とカードの関係、削除・アーカイブ・フォルダ整合性は主に保存処理が管理する。全件取得と集計が多く、大規模データ向けのページングは未実装。

## 学習評価の整合性

1. ブラウザーは回答ごとに `operationId` を発行する。カードID、評価、応答時間、送信前の `expectedReviewCount` とともに `pendingReview` として、HTTP送信より先に保存する。
2. 公開評価APIは操作ID・セッションID・期待カウントを必須にする。再送は同じペイロードを使う。
3. `reviewCard()` の書き込みトランザクション内で、所有者＋操作IDの既存記録を調べる。一致する再送は元の履歴IDを返す。カード・評価・セッション・期待カウントが異なる使い回しは409。
4. 新しい操作ではカードの現在カウントと期待カウントを比較する。別タブ等が進めた状態なら409。カード更新、履歴追加、教材の復習日更新はまとめてコミット／ロールバックする。
5. DBの `UNIQUE(user_id, operation_id)` が重複を防ぐ。取り消した記録も保持し、同じ操作IDの再送で再適用しない。
6. 応答だけ失われても、保存済み操作の再送またはDB照合で復元する。正答の完了・誤答の順番移動と回数を復元し、処理済みpendingを消す。

通常の履歴表示は最大500件。復元は別に `GET /api/data?sessionId=...` で該当セッションの全履歴・取り消し操作IDを取得し、表示上限に依存しない。1リクエスト最大100セッション。ブラウザーはアクティブ・中断中IDを100件ずつ取得する。評価POSTの応答にもそのセッションの履歴を含める。

ローカルSQLiteの同一接続はトランザクションと通常クエリが競合しないよう直列化する。リモートlibSQLはDBの書き込みトランザクションと制約を使用する。競合や通信障害は発生し得るが、再送で新しい評価を追加しない。

内部の `reviewCard` は旧呼び出しとの互換性のため操作メタデータ省略を許容している。HTTPからは省略不可。新しい内部呼び出しでも必ずメタデータを渡すこと。教材追加・AI会話等は今回の冪等性保証の対象外。

## 永続化・マイグレーション

- 登録済み教材と回答履歴はDB、編集中内容・中断状態・送信待ち操作はlocalStorage。ブラウザーをまたぐ下書き同期はない。
- ストレージ容量不足・利用不可は画面で通知する。ブラウザーデータ削除後の下書き復元は保証しない。
- `db/client.ts` が初回アクセスで `drizzle/*.sql` を番号順にトランザクション内で適用し、`_loop_migrations` に記録する。GETでも初期化・当日の復習計画作成が発生し得る。
- 現在は0000〜0005。0005は `review_logs.operation_id` と2つの索引の追加だけ。旧履歴はNULLのまま維持し、削除・重複修復・データ移送はしない。
- 既存DBを採用する処理はテーブル・列の存在を確認するが、任意のスキーマ破損を自動修復する仕組みではない。
- 配備後の最初のDBアクセスで0005が適用される。既存データが大きい場合は索引作成時間を事前確認する。本番適用は今回未実施。

## 入力とセキュリティ境界

全POSTは `application/json` のオブジェクトを要求し、読み取り途中も含め2MiBを超える本文を413で拒否する。評価メタデータ、カード配列、教材保存の文字数・形式を検証する。ただし全アクションの厳密なスキーマ検証は完了していない。

API認証・ユーザー別アクセス制御・AI利用回数／同時実行／費用上限は未実装。時間上限や入力上限は利用量制限の代わりにはならない。公開前の推奨案と判断事項はSTATUS参照。

## 品質チェック

`.nvmrc` と `package.json` のNode指定を使い、`npm ci` → `npm run check`。型生成・型検査、Lint、Nodeテスト、本番ビルドを順に実行する。CIは `.github/workflows/ci.yml`。

DBテストは一時SQLiteで行い、通信後エラー、同時送信、ロールバック、取り消し、500件超の復元を検証する。Turso本番環境・外部AI呼び出しを検証したことにはならない。

PDF本体とWorkerは同じpdfjs-distのlegacy buildを使用し、Workerと日本語文字マップをpredev/prebuildでコピーする。Node 22にはない `Promise.try` を互換実装が補う。生成済み `public/pdfjs/**` はLint対象外。Google Fonts取得のため初回ビルドにはネットワークが必要。
