# Free v1 — ファイル取り込み／MCQ診断（2026-09-22）

対象: Dev `5768c6bce7f19fb70a7e274c7f2d3789675f73b2`。
作業ブランチ: `codex/free-v1-import-ai-diagnosis`。
独立作業ツリー: `/private/tmp/patch-free-v1-import-ai`。
Devへのマージ、Production変更、実データの更新、実OpenAIへの追加送信は行っていない。

**結論:** PDFのWebKit互換性不具合とiOS AI通信の15秒打ち切りを修正した。
MCQの元応答は `invalid_choices` で拒否されており、その不正内容は保存されていない。
待機時間修正だけでMCQの生成成功まで保証したとは扱わない。検証を緩める変更や自動再生成は行っていない。

## 1–5. PDFとファイル対応表

### 実装と確認範囲

実アプリは `app/build-patch.tsx` のHTML `<input type="file" multiple>` から
`File` を受け取り、`lib/document-import.ts` の `extractDocument()` を呼ぶ。
全形式ともブラウザー/WebView内で `File.arrayBuffer()` を読み、抽出したテキストを下書きへ保存する。
選択したファイルの原本を解析サーバーへアップロードする経路、独自のCapacitorファイルピッカープラグイン、
ネイティブファイルパスをJavaScriptで再オープンする処理は使っていない。

表の「iOS」は接続済み **iPhone 11 ProのSafari上の実コンポーネント** による検証。
合成 `File` を `DataTransfer` で入力して、本文抽出、検証、Step 3への遷移まで実測した。
Chromiumでは生成ファイルをディスクに保存し、CDPのファイル選択で同じUIを検証した。
別途、macOS WKWebViewの **`capacitor://localhost`** でバンドル版パーサーを検証した。

**既存Patchアプリ内のiOS「ファイル」ピッカーからの再選択／security-scoped accessは今回再試験していない。**
実機Safariの結果を、ネイティブピッカーを含むE2E成功とは読み替えない。
元の私有PDFは読まず、そのファイル固有の問題の併発有無は未確認。

| Format | Advertised | Web works | iOS works | Parser | Limits | Notes |
|---|---|---|---|---|---|---|
| PDF | Yes | Chromium成功。WebKitは修正前失敗→修正後成功 | 実機Safariも修正前失敗→修正後成功* | PDF.js legacy 6.3.289、`streamTextContent().getReader()` | 共通制限＋200ページ | テキスト層を抽出。OCRなし。空／画像のみ、破損、パスワード付きは制約あり |
| DOCX | Yes | 成功 | 成功* | fflate ZIP＋DOMParser、`word/document.xml` の `w:p/w:t` | 共通制限＋対象XML展開後8MiB | 本文／表内段落。画像、ヘッダー／フッター等の全文再現は対象外 |
| PPTX | Yes | 成功 | 成功* | fflate ZIP＋DOMParser、プレゼンテーション順のスライド `a:p/a:t` | 共通制限＋対象XML展開後8MiB | スライド本文。ノート／画像OCRは対象外 |
| TXT | Yes | 成功 | 成功* | TextDecoder: BOM付きUTF-16 LE/BE、UTF-8、Shift-JIS fallback | 共通制限 | 空ファイル拒否 |
| MD | Yes | 成功 | 成功* | TXTと同じ | 共通制限 | Markdown構文を含むテキストを使用。レンダラーではない |
| CSV | Yes | 成功 | 成功* | TXTと同じ | 共通制限 | CSV文字列を教材として使用。表／型の構造解析ではない |

\* 実機Safariの隔離UI検証。ネイティブFilesピッカーの再確認は残る。

共通制限:

- 1ファイル **10 × 1024 × 1024 = 10,485,760 bytes (10MiB)** 以下。UIの「10 MB」は二進単位の実装。
- **5ファイル**まで。既存添付と今回の選択の合計で判定。失敗した添付も削除するまでは枠を使う。
- 抽出文字列は1ファイル30,000文字以内。入力文＋受理済み添付の合計も30,000文字以内（結合改行を含む）。
- Source materialで次へ進むには合計80文字以上。拡張子を受理しただけでは成功と判定していない。
- 別のAI入力上限があり、全文30,000文字が必ずAIに送れるという意味ではない。
- 10MiBちょうどのテキストを受理、+1 byteを拒否。5ファイル受理／6ファイル拒否、合計32,000文字の継続不可を検証。

### 1. 確定した原因

PDF.js 6.3.289のlegacy buildでも `getTextContent()` 内部は
`for await (const value of readableStream)` を使用する。
今回の実機SafariとMac WKWebViewで `ReadableStream.prototype[Symbol.asyncIterator]` は `undefined`。
単純な合成PDFで `getTextContent` 内の `undefined is not a function (near '...value of readableStream...')` を再現した。
ファイル読み込み、PDFオープン、ページ取得の後の本文抽出で失敗する。

したがって、再現した原因はPDFパーサーが要求するWeb APIの互換性である。
再現fixtureではArrayBuffer取得、PDF workerのロード、PDF構造の解析は進んでおり、
ファイルURL、権限、文字エンコーディング、元PDF特有の破損を原因にする必要がない。
元の私有PDFについて、未取得のコンソール例外を見たとは主張しない。

参考: [PDF.js upstreamの同一getTextContent問題](https://github.com/mozilla/pdf.js/issues/20973)、
[WebKitのReadableStream async iteration説明](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)。
OSバージョン表示だけでは判断せず、実際に機能の有無と失敗箇所を確認した。

### 2–4. 対応可否と最小修正

PDFサポート自体は有効。iOS限定ではなく、該当Web APIが欠けるDesktop Safari／WKWebViewでも発生する。
PDF.jsの同じテキストストリームを `getReader().read()` で読むように変更した。
全体的なpolyfill、PDF.jsの入れ替え、ファイル形式の撤去、サーバー解析への移行は行わない。
ページ数／文字数上限、パスワードエラー、空テキスト拒否、タスク破棄を維持する。
**Free v1の判断: PDFはA（いま最小修正）。残り5形式は現状維持。B（UIから撤去）は不要。**

### 5. 回帰テスト

- `ReadableStream[Symbol.asyncIterator]` を外した環境で、単純PDFの本文抽出を検証。
- 同環境で破損PDF／空PDFを拒否。
- 6形式の安全なfixtureで内容一致を確認。各形式の破損または空fixtureを拒否。
- Nodeの単体テストだけでなく、Chromium、実機Safari、`capacitor://` WKWebViewのバンドルを比較。
- 実機隔離UI: 6形式すべて受理→本文一致→継続→Step 3、各不正fixture拒否、各上限、AI呼び出し0件を確認。

## 6–11. MCQ診断

### 6. 正確な操作状態

読み取り専用で、起動中LAN APIのローカルDBと `.data/physical-iphone-api.log` を突き合わせた。

| 項目 | 確認値 |
|---|---|
| AI request ID | `4108250e-e9f5-45f9-8806-c5aaf30e730f` |
| endpoint | `cards` |
| admission | 2026-09-22 13:36:21.049 UTC (22:36:21 JST) |
| dispatch marker | 13:36:21.080 UTC |
| final diagnostic | 13:36:44.966 UTC、duration 23,893 ms |
| `ai_requests.state` | **`failed_final`** |
| provider HTTP | **200** |
| provider request ID | `req_9278a582aa1543c0bfecb49663a9afe1` |
| category / providerCode | **`validation` / `invalid_choices`** |
| application failure status | 503 (`AI_PROVIDER_FAILED`) |
| result | 未保存 (`result_json IS NULL`) |
| token counts | DBでは未保存 (`NULL`) |
| budget ledger | **3,600 cost_micros**（最大見積もりを保守的に維持。実課金額の証明ではない） |
| 対応する `ai_operations.state` | `started`（プライバシー／重複操作用の記録。実行状態の正本は`ai_requests`） |
| DB全体の reserved / dispatching / unknown | **0件**（診断時点） |

### 7–8. dispatchと失敗分類

実OpenAIへ送信され、HTTP 200とprovider request IDを取得済み。
`prepareMaterial()` が選択肢検証で拒否した、**dispatch後の確定した終端失敗**である。
`invalid_choices` になり得る条件は、選択肢の数、空文字／型、trim後重複、正解indexの整数／範囲。
これらを元コードは一つのコードにまとめており、元応答本文は保存していない。
**どの条件だったかは特定不能。重複選択肢などと断定しない。**
プロバイダーの出力を記録／再送して追跡する変更はしていない。

設定はdevelopment・ローカルSQLite、OpenAIキーあり、cards/chatモデルは `gpt-5-nano`。
このリクエストが200に達しているため、キー未設定、401、クォータ429、provider 5xx、provider 45秒タイムアウトが今回の最終原因ではない。

画面の確認不能には別の通信問題が重なっている。
インストール済みCapacitor iOS 8.5.2の `HttpRequestHandler.swift` は
`(connectTimeout ?? readTimeout ?? 600000) / 1000` を `URLRequest.timeoutInterval` に使う。
アプリは15,000/65,000を指定していたので、iOSは**初回応答待ちにも15秒**を適用する。
サーバーのPOST接続ログは15.3秒で終了し、AIの最終診断は23.893秒後。
これはnative待機の先行打ち切りと整合する。実機NSErrorのコード自体は採取していない。
Next.jsのその接続ログの200を、生成物が正常に受信された証拠とは扱わない。

### 9. Retryの安全性

保存された同一キー・同一入力での最初のRetryは、既存行の `AI_REQUEST_FINAL` を返し、providerへ再送しない。
その終端応答を受け取ったUIはキーを解除するので、**その後の明示的なRetryは新しい生成要求**になり得る。
これはunknownの自動再送ではない。`unknown` の既存保護、同一キー再照会、アカウント分離は変更していない。
本番のRetryボタンをこちらから押しておらず、実providerへの追加呼び出しは**0回**。

### 10. 最小修正と残るブロッカー

iOSの `POST /api/ai/cards` と `POST /api/ai/chat` だけ、native connectTimeoutを65秒にする。
その他のAPIとAndroidの15秒設定、providerの45秒、外側のAI75秒deadlineは維持する。
二重送信、バックグラウンド再送、新しい操作への自動切替は追加しない。

**残る確認:** 元の `invalid_choices` の内訳と、修正済みアプリでの実MCQ成功。
出力を正しく拒否するガードを緩めることは修正にならないため変更していない。
元の不正応答が残っていない状態で、プロンプト／モデル／スキーマを推測で変えない。
Free v1のMCQ成功が確認済みとは判定しない。

### 11. Operator resolution

対象操作は終端状態なので、unknown解消操作や強制再送は**不要**。
アクティブ予約は保持されていない。3,600 cost_microsは料金上限計算の記録として残る。
`ai_operations.started` も、新しい同一要求を勝手に再開するワーカーではない。削除／変更していない。

## 12–15. 変更・検証・引き継ぎ

### 12. 変更ファイル

製品コード:

- `lib/document-import.ts`: WebKit互換のPDFテキストストリーム読み取り。
- `mobile/http-timeouts.ts`: iOS AI APIのみ65秒設定。
- `mobile/main.tsx`: その設定をnative transportへ適用。

回帰テスト／合成QA:

- `tests/document-import.test.mjs`
- `tests/native-http-timeouts.test.mjs`
- `tests/ai-control.test.mjs`: `invalid_choices` → failed_final → 同一キーRetryでdispatchが増えないこと。
- `tests/fixtures/document-files.mjs`
- `tests/fixtures/document-import.{html,js}`
- `tests/fixtures/document-import-flow.{html,jsx}`
- `scripts/check-document-import-browser.mjs`
- `scripts/build-document-import-fixture.mjs`
- `scripts/check-document-import-webkit.swift`
- この報告書。

### 13. 検証

- Node 22.23.2: 全unit tests **306/306成功**（Node 25でも306成功）。
- 型検査成功。
- ESLint: エラー0、既存のunused-vars警告11。
- Next.js webpack Web build成功、artifact seal成功。
- Safari 17 targetのdevelopment mobile build成功、artifact seal成功。
- Capacitor sync成功。
- 実機向けarm64 Debug Xcode build成功（署名なしのコンパイル検証。インストールとは別）。
- Chromium実ファイル入力、iPhone Safariの隔離UIで6形式／不正fixture／上限を検証。
- macOS `capacitor://` WKWebViewのパーサー比較でPDFの修正前失敗／修正後成功を確認。描画用ウィンドウを付けた隔離UIでも6形式／不正fixture／上限／継続をすべて確認。
- 警告: Viteの既存large-chunk警告。最初のWeb buildはsandboxのGoogle Fonts取得制限で失敗し、ネットワーク許可後に成功。

再現コマンド（合成資料のみ、AIなし）:

```sh
node scripts/prepare-assets.mjs
node --test tests/document-import.test.mjs tests/native-http-timeouts.test.mjs tests/ai-control.test.mjs
node scripts/check-document-import-browser.mjs
node scripts/build-document-import-fixture.mjs
# Mac WKWebView（macOS SDKが必要）
xcrun swiftc scripts/check-document-import-webkit.swift -o /tmp/patch-import-webkit
/tmp/patch-import-webkit "$PWD/outputs/import-qa/bundle" document-import.html
```

### 14. iPhone / Xcode

**Xcodeから修正版を再ビルド・Runする必要がある。** 現在インストールされているPatchは書き換えていない。
JS資産がアプリ内に同梱されるため、API再起動だけではPDF／native timeout修正は入らない。
接続とペアリングが維持されていれば、ケーブルの抜き差し自体は不要。必要ならロック解除して接続する。
このブランチでdevelopment用のLAN URL・既存の公開Clerk設定を使用し、`npm run ios:sync:local` 後にXcode Run。
署名チームは既存の開発環境の設定を使用する。この作業のために署名設定をコミットしていない。
アプリ削除・再インストールによる下書き初期化はしない。

実機で残す確認:

1. ネイティブFilesピッカーから安全な6形式を選択してAdd Materialを継続。
2. 元PDFは内容をログに出さず再試験（画像のみ／暗号化など別制約がないか確認）。
3. 保存済みMCQ要求は同一キーのRetryで終端を確認。新規生成は別の明示的な操作として扱う。
4. 新規MCQを行う場合、失敗したら繰り返し生成せず、request IDとmetadata-only診断を確認する。

### 15. ブランチ・コミット

ブランチ `codex/free-v1-import-ai-diagnosis`。コミットハッシュはチャットの最終報告を参照。
指定Devコミットから分岐。Devマージ・push・Production反映は未実施。
