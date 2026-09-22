# Free v1 MCQ生成契約の修正（2026-09-22）

対象ブランチ: `codex/free-v1-import-ai-diagnosis`。開始点: `ea3045808f40b1b5cc9174f4fe2edd5220fe7ed1`。
Devマージ／push／Production変更なし。ユーザーの既存AI操作・下書き・学習データは変更していない。

## 1. invalid_choicesの原因と確定範囲

以前のrequest `4108250e-e9f5-45f9-8806-c5aaf30e730f` はHTTP 200後の
`validation / invalid_choices` → `failed_final`。元応答が保存されていないので、
**その1件が以下のどの条件だったかは、今回も遡って特定できない**。新しい成功例からも推定しない。

元の実行時バリデーターが `invalid_choices` にした条件をコードとモックで確認した:

| 条件 | 新しい構造診断コード |
|---|---|
| カード要素がnull／期待するobjectでない | `item_shape` |
| choicesがない／配列でない | `choices_not_array` |
| 選択肢数が4以外 | `choice_count` |
| 選択肢に文字列以外がある | `choice_type` |
| 空文字／trim後に空になる選択肢 | `choice_empty` |
| trim後の選択肢が重複する | `choice_duplicate` |
| correctChoiceIndexがない／文字列／小数／null等 | `correct_index_type` |
| 整数indexが0〜3の範囲外 | `correct_index_range` |

元のStructured Output schemaは4要素のstring配列、整数index 0〜3、追加プロパティ禁止を指定していた。
ただし**空文字／空白だけのstringはschema上有効**で、trim後の重複もschemaでは表現していなかった。
「JSONスキーマに合う見た目の応答」でも実行時に正しく拒否される具体的な条件がここにある。
先頭・末尾の空白だけが理由の誤拒否は確認されなかった。元のコードもtrimしていた。

正解はproviderのindexから選択肢の文字列を取り出して作るため、正常なprovider契約では
「answerとchoicesの不一致」は生じない。保存時は引き続きanswerがchoicesに含まれることを検証する。
旧データのStudy時フォールバック（不完全MCQ→自己採点式qa）とDBの旧normalizerは変更していない。
新規生成／保存は厳格な検証を通すため、旧normalizerで欠けた選択肢を補う経路には依存しない。

## 2. 生成契約の変更

- 4択用の指示を専用化。4個の非空文字列、正解1個／誤答3個、trim後の相違、0始まりの配列位置を明記。
- 最初=0／2番目=1／3番目=2／最後=3を明記し、answerフィールドと選択肢番号の接頭辞を出さないよう指定。
- 同じ応答を出す前に選択肢数・空白・重複・正解位置を確認する指示。別のAPI呼び出しによる修復ではない。
- choicesのstring schemaに `pattern: "\\S"`（非空白文字が必要）を追加。
- correctChoiceIndexを整数 `enum: [0,1,2,3]` にし、配列位置のdescriptionを追加。
- 既存の `strict: true`、`additionalProperties: false`、`minItems/maxItems: 4` は維持。
- Flashcardは従来のanswer＋空choices契約のまま。モデル、reasoning、出力予算、タイムアウトを変更していない。

対応を確認できたpattern／enum等の制約を使用した。
trim後の一意性までschemaで保証できると主張せず、実行時検証を残している。
参考: [OpenAI Structured Outputsのsupported properties](https://developers.openai.com/api/docs/guides/structured-outputs#supported-properties)。

## 3. バリデーター

`lib/ai/mcq-contract.ts` に選択肢の構造検証を切り出した。
有効な場合だけ、前後の空白をtrimした4個の選択肢と有効なindexを返す。
空白の内部、大小文字、Unicode表記の置き換え、indexの文字列→数値変換はしない。
足りない選択肢の補完、重複の削除、正解の移動、カードの黙った除外は行わない。

追加の防御として、providerが契約にないanswerを同時に返した場合は
`unexpected_answer` で拒否する。別の正解表現を黙って上書きしない。
正解は検証済みの `choices[correctChoiceIndex]` からだけ作り、indexはアプリへ持ち出さない。
その後に既存の教材全体validatorを通す。保存validatorは変更していない。

## 4. 安全な診断

最初に失敗したカードについて次のメタデータだけをallowlist経由で記録する:

- `validationStage`: `mcq_choices` / `material` / `response_json`
- `validationCode`: 上表の理由、`unexpected_answer`、全体構造／JSON形状エラーの固定コード
- `itemIndex`: 0始まりのカード位置
- `choiceCount`、trim後の `duplicateCount`、`emptyChoiceCount`、`nonStringChoiceCount`
- `correctIndexValid`: 整数かつ有効な配列位置かのboolean
- 従来の内部request ID、provider request ID、HTTP status、終端状態

数値は0〜10,000の整数、stage/codeは固定集合、booleanは実booleanに限定。
配列が存在しない場合にその配列の個数を捏造しない。
質問、答え、choicesの文字列、元教材、raw provider output、任意のエラーメッセージはログに含めない。
privateな文字列を注入したモックでError／ログへの混入がないことを検証した。
DBスキーマ／保存期間の変更はない。通常のメタデータログとして残る。

## 5. failed_finalとunknownのUI

| 結果 | 表示と操作 |
|---|---|
| 内容が不正な確定応答 | 「The AI returned study content that could not be used. Your material and settings are saved. Choose Generate again to start a new request.」／`Generate again` |
| 同一キーのfailed_final再照会 | 以前の操作が終端である旨と、新しい要求になる旨を表示。内容不正だったかの履歴は未保存なので、過去の原因を捏造しない |
| unknown | 確認できないこと、管理者による解消が必要なこと、Retryは再送でなく状態確認であることを維持 |
| 通信切断等の未確認結果 | 同一キーを保持し、安全な再確認を案内 |

サーバーは確定した教材JSON／検証エラーに `AI_INVALID_GENERATED_CONTENT` を返す。
内部コードを画面へ表示しない。provider HTTPエラーや読み取り未完了までこのコードへ変換しない。
受信前のinvalid JSONは引き続きunknown、HTTP 200の確定したoutput_text内の不正JSONは確定失敗。
UIは終端／未確認の区別を下書きに保存し、再マウントしても表示とキーの扱いを維持する。
元教材、添付、detail、format、coverage、focusは保持する。

## 6. Retry／冪等性／予算

- failed_finalの同じキーを2回照会しても、provider call数もAI行数も増えない。
- その終端を受け取った後の `Generate again` は、ユーザー操作で新しいUUIDを発行する。
- unknownは同じキーを保持。別キーでも既存unknownによりadmissionが拒否される既存動作を維持。
- 自動再生成／自動修復のAPI呼び出しは0。
- モック統合テスト: 失敗1回＋明示的新規成功1回で台帳は2行。失敗3,600＋成功41 = 3,641 cost_micros。
  状態照会だけでは追加予約なし。
- DBの状態遷移、予約額、料金算出、lease、auth/account境界は変更していない。

## 7. モックテスト

null／配列カード、missing/object choices、0／3／5選択肢、非文字列、空／全角空白、重複／trim重複、
missing/string/fraction/null index、負数／4のindex、矛盾するanswerを確認。
すべて確定失敗・構造理由・itemIndex・provider IDを検証し、呼び出しは各1回のみ。
有効index 0〜3すべてでtrim前後の正解維持と保存／Review validator通過を確認。

実HTTP routeのモック統合テストで、不正生成→同一キー再照会→明示的新規生成→Save→Studyの
正解採点まで確認。Flashcard、旧データ互換、Study、Retention、auth/privacyの既存回帰を維持。
ブラウザーテストで下書き保持、再マウント、ボタン文言、unknownのキー維持、新規生成キーの差分を確認。

## 8. 実provider検証（1回のみ）

契約・validator・モック検証後、合成した水の状態変化の教材で実OpenAIを1回だけ呼んだ。
排他的な実行済みマーカーで再実行を禁止。通常の `runAi` を隔離したローカルQA台帳で使用した。
ユーザーの既存キー／教材／操作は再送していない。

| 項目 | 結果 |
|---|---|
| 実POST回数 | **1** |
| モデル | `gpt-5-nano` |
| provider HTTP | **200** |
| request ID | `2b2702c4-5b4e-47f2-bd84-049d4ec6666c` |
| provider request ID | `req_df85f919923b420ba8598f5e51438ffa` |
| state | **succeeded** |
| MCQ数 | **6** |
| 実行時／保存validator | **成功** |
| 処理時間 | 15,499 ms |
| 使用量 | input 675 / output 1,501 tokens |
| 台帳 | 最大予約3,600→確定見積もり635 cost_micros |

実課金額ではなくアプリ台帳の見積もり。追加のprovider callはしていない。
未知操作やoperator resolutionが必要な操作はこのQAに残っていない。
この1回の成功を、あらゆる教材やiPhone E2Eの成功保証とは扱わない。

## 9. ファイル取り込み回帰

PDF/DOCX/PPTX/TXT/MD/CSVの安全なfixtureで、選択、本文一致、継続、不正ファイル拒否を再検証。
10MiB／5ファイル／合計30,000文字制限も維持。前回のPDF互換性修正とiOS AI65秒修正に変更なし。
今回iPhoneにはインストールしていない。実機での最終確認は以下のユーザー操作待ち。

## 10. iPhoneでの正確な確認手順

### 更新したMac LAN APIを起動

**現在3001で動くAPIは旧Dev作業ツリーのため、iPhoneの更新だけでは今回のサーバー修正が入りません。**
現在のLAN APIを、その起動元ターミナル／既存の起動方法で停止した後、別ターミナルで:

```sh
cd /private/tmp/patch-free-v1-import-ai
npm run dev -- --hostname 0.0.0.0
```

この作業ツリーにはdevelopment専用の `.env.development.local` を準備済み。
元のLAN APIと同じClerk設定・ローカルDBを使い、相対DBパスは元のDBへの絶対パスにしてある。
秘密値はgit管理外。既存DBのAI停止スイッチもそのまま。APIの切り替え／起動自体はこちらでは行っていない。
3001を使っている別プロセスを無差別にkillしない。下書き／アプリ／DBを削除しない。

### 更新したiPhoneアプリをRun

```sh
cd /private/tmp/patch-free-v1-import-ai
npm run ios:sync:local
npm run ios:open
```

Xcodeで既存と同じ開発署名チーム、接続済みiPhone、Debugを選びRun。
mobile設定は既存のdevelopment LAN URLと公開Clerk設定を引き継いでいる。
同じbundle IDで更新し、アプリを削除しない。Wi-Fi／Mac IPが変わった場合だけ
`mobile/.env.development.local` のLAN URLを更新して再syncする。

### A. Native Files picker

安全な確認ファイル:

- `outputs/iphone-handoff/water-cycle.pdf`
- `outputs/iphone-handoff/water-cycle.txt`

AirDrop等でiPhoneの「ファイル」へ保存する。
Add Material → Upload files → **実際のネイティブFilesピッカー**からPDFを選択し、
本文が受理され、次へ進めることを確認する。TXTでも同じ確認を行う。
選択拡張子が受理されるだけでなく、文字数／内容が利用可能であることを確認する。
ここでは生成を押さず戻ってよい。私有ファイル内容をログやスクリーンショットで送る必要はない。

### B. Text → MCQ → Generate → Review → Save → Study

1. Add MaterialでCreate a new Patchを選ぶ。
2. 上記TXTの内容をTextへ貼り付け、Source materialで続行する。
3. Whole material、Key pointsまたはStandard、**Multiple choice**を選択。
4. Generateを1回押して待つ。連打／途中の再送はしない。
5. Reviewで各問に異なる4択と正解が存在することを確認（問数は固定6ではない）。
6. Saveし、保存したPatchを開いてStudyを開始。
7. 選択肢を選び、回答表示／採点／Continueで学習を進められることを確認。
8. 内容不正なら「使えない生成結果」の説明とGenerate againが出て、元教材・設定が残ることを確認。
   unknownなら同一要求の確認状態を維持し、別要求を繰り返し送らない。

**ユーザーの実機テスト完了までは、ネイティブ取り込み／MCQ E2E成功済みとは報告しない。**

## 11. 変更ファイル

- `lib/openai.ts`: 生成契約、構造検証の呼び出し、index→answer変換。
- `lib/ai/mcq-contract.ts`: 新規の厳格なMCQ構造検証。
- `lib/ai/execution.ts`, `lib/ai/diagnostics.ts`: メタデータ型とログallowlist。
- `lib/ai/control.ts`: 確定した内容不正のAPIコード（状態・予算ロジックは維持）。
- `lib/ai-client.ts`: 新コードの終端扱い。
- `lib/build-draft.ts`, `lib/build-generation-error.ts`: 終端区別の保持と文言。
- `app/use-build-generation.ts`, `app/build-patch.tsx`: 下書き保持、確定失敗／unknown表示。
- `tests/ai-mcq-contract.test.mjs`, `tests/ai-client.test.mjs`, `tests/ai-control.test.mjs`,
  `tests/ai-recovery.test.mjs`, `tests/ai-routes.test.mjs`: モックと統合回帰。
- `scripts/check-build-patch-browser.mjs`: 実UIの回帰。
- この報告書。

## 12. Tests / builds

最終結果はチャット報告にも記載。Node 22.23.2を使用。
全unit tests **331/331成功**、typecheck成功、lintエラー0（既存警告11）、Web build＋seal成功、development mobile build＋seal成功、
Capacitor sync成功、実機向けDebug arm64 iOS build（署名なし）成功。
ブラウザーの生成回復テストと6形式の取り込み回帰も実施。
実機向けコンパイルとiPhone実操作は区別する。

## 13. Branch / commit

`codex/free-v1-import-ai-diagnosis`。最終コミットはチャット報告を参照。
Devへのマージ・push・Production反映はしない。
