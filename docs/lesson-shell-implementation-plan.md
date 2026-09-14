# Patch U2 — 実装状態と次の接続

計画元: `codex/lesson-shell-plan` / `b9ee353`。今回の作業branch: `codex/patch-u2`。
現在のDevのDomain/APIを確認し、既存U2 `codex/lesson-shell@9939e07` の実装を継承した。Dev、UI Phase 1（確認開始時 `1880afa`）、main、productionへのmerge・変更は行っていない。本書は当初計画を実装結果で置き換える。

## A. Current implementation mapping

- `features/my-lesson/`の既存Shell・5renderer・reducer・Domain adapterを再利用した。新たなLesson entity、state machine、runtime API、Composerは作成していない。
- `Lesson`は既存`study_sessions`、Activity/Attempt/LessonActivityは既存Domain契約を使う。`createDomainClient(useApiFetch())`を通し、ownership/account isolationを既存serviceに委ねる。
- 旧Card学習、review/undo、onboarding、Continue Learning、Retention、Streak、Dueの処理を保持。Set/Cardを新Activityに偽装しない。`legacy=true`のLessonは新Shellでは扱わない。
- `app/page.tsx`への差分はLessonEntryのimportと最終表示のwrapperのみ。既存認証・onboardingの後で選択済みLessonを開く。UI Phase 1のHome/Preview/Completeの見た目は変更していない。

## B. Lesson Shell component structure

```text
既存 App（Auth / Privacy / Language / onboarding）
  LessonEntry — /?lesson=<実在するLesson ID>、またはhostからDomainLessonをmount
    DomainLesson — account-scoped API / checkpoint / real AI Helpを注入
      LessonExperience — loader、既存Activity reducer、保存、復元、時間予算
        固定header / progress / ActivityRenderer / feedback / Continue
        HelpSheet — 同じLesson上のnative dialog
        LessonComplete — serverのCOMPLETED確定後に表示
```

明示的な中断・完了からHomeへ戻れる。URLのLesson IDは選択入力にすぎず、毎回サーバーで所有者を検証する。Home/Continueが「今日のLesson」を生成・選択する新しい方針は追加していない。実Lessonがない場合にデモを作らない。mock adapterはtest/previewだけに残し、productionのimportから除いた。

## C. Activity contract

既存 `lib/domain/types.ts` の `id/type/objectiveId/prompt/answer/explanation/estimatedSeconds/metadata` を使用する。型はLEARN/RECALL/CHOICE/EXPLAIN/APPLYのみ。CHOICEは2–6個の単一選択。他種に新しいmetadata/rubric/scenario fieldは追加していない。

adapterが既存のLesson→Patch/Objectives→Activities、LessonActivity、Activity別Attempts queryを組み合わせる。AttemptはLessonでfilterし、Undoを除いた最新の成功だけを完了証拠とする。表示上の`revision`はActivity.updatedAtと最新履歴ID/Undo日時から作る**ローカルdraft失効用の値**で、Domain fieldではない。

Attemptは既存`recordAttempt`で保存。LEARNはCOMPLETED、他種はCORRECT/INCORRECT。RECALLはremembered/practice、CHOICEは選択肢index、EXPLAIN/APPLYは入力文章をresponseに保存する。per-answer `durationMs`は継承実装どおり0（未計測）。経過時間は端末の予算表示だけに使い、サーバー資格の根拠にしない。

## D. Renderer responsibilities

| 種類 | 実装状況 |
| --- | --- |
| LEARN | 説明を表示し、明示ContinueでCOMPLETEDを保存 |
| RECALL | 想起→reveal→「思い出せた/練習したい」の明示自己評価を保存。短文入力は追加せず既存の想起操作を使用 |
| CHOICE | 2–6択、単一選択、答えとの比較、feedback、誤答再回答。reveal前の選択を保持 |
| EXPLAIN | 自分の言葉の入力、reference answer確認、明示自己評価。空回答は送信不可 |
| APPLY | 短いscenario/problemへの文章回答とreference answer・自己評価。新しい採点概念は追加しない |

renderer自身はAPI/Retentionを呼ばない。自由回答はAI採点ではないことを表示し、AI Helpを正誤判定に使わない。結果画面は取り組んだ学習目標を表示し、mastery向上を主張しない。最終visual/i18n仕上げは後続。

## E. Lesson state / progress / completion

既存永続状態はCREATED→ACTIVE→COMPLETED、またはABANDONED。中断はACTIVEを保持。表示はloading→READY/ANSWERING→SUBMITTING→FEEDBACK→次Activity/Completeで、Helpはoverlay、errorは入力を保持する。

- 誤答の最新Attemptは未完了。説明を確認して明示的に再回答する。
- 全Activityが成功した後で`completeLesson`を呼び、再取得したCOMPLETEDを確認してから結果を表示する。保存/完了応答の消失を楽観的な完了にしない。
- 進捗の分母は割当Activity数。5枚の区切りをLesson全体の完了と扱わない。
- ObjectiveStateは保存後に既存queryから読み取るだけ。mastery・復習日・Dueの独自更新はない。
- Home復帰時に既存`patch-retention-refresh`を通知する。表示上のStreak加算、completed-todayの捏造、reviewへの二重書込はない。

## F. AI Help integration

**既存POST `/api/ai/chat`の互換拡張だけ**を追加した。新URLはない。

```ts
{ context: 'lesson', lessonId, activityId, question, language: 'ja' | 'en', operationId }
// 応答は従来同様 { answer: string }
```

- 旧Set/Card入力は従来経路のまま。Lesson入力との混在、owner/context本文/履歴の任意注入を拒否する。
- `lib/ai/lesson-context.ts`がowner、ACTIVE Lesson、割当membership、同一Patch、有効Objective/Patchを検証。本文と最大2件のSourceをサーバーから取得する。finalize時にも所属を検証する。
- `PrivacyProvider → AccountScope → sendAi → runAi('chat')`を再利用。同意revision、account generation、idempotency、取消、kill switch、model/input/output制限、cost/rate/concurrency制限を維持する。unknownは同一keyでも再dispatchしない。UIはRetry-Afterの間、再送を無効にする。
- 短い追質問の文脈は、既存`ai_requests.result_json`に保存される確定receiptから最大3往復を取得する。追加metadataは`lessonHelp {lessonId,activityId,question}`。owner/同意revision/generation/有効期限（既存24時間）/Activityで絞り込む。既存削除処理・backup対象に含まれる。外向き応答に内部metadataを追加しない。
- chat_messages、Attempt、ObjectiveStateにはHelpから書き込まない。新たな会話テーブルやschemaは**NONE**。永続Chat productや「学びを残す」機能は作らず、後者の仮ボタンはproductionでは表示しない。
- 新しいprovider promptはSource・Activityを未信頼dataとしてuser contentへ分離。navigation・評価・進捗・schedulingの変更権限を与えず、資料外知識/不確実性を明示させる。総UTF-8入力上限に収まるよう古い履歴→Source→長い文脈を削減し、質問を保つ。textとして表示する。
- native dialogで閉じる/Escape/focus復帰を提供。同意dialogも既存native modalを使用。Helpを閉じる・背景化・Lesson/account切替でabortし、abortを無視したtransportの遅延応答もUIへ反映しない。

表示会話はsheet内の一時stateで、閉じると消える。サーバーの短期文脈は期限内の追質問に利用できるが、全履歴表示・端末間Chat同期を約束するものではない。

## G. Resume / interruption behavior

- `patch:lesson:<internal-user-id>`に1件のversion付きcheckpointを保存する。内容はLesson/Activity ID、revision、未送信draft/reveal/自己評価、端末のforeground経過時間、未確定RecordAttempt payload。進捗そのものの権威にはしない。
- 既存account cleanup hookに登録し、logout/deletionで当該accountのdraftを削除する。scope失効後のread/write/clearを拒否する。他accountのstorageは触らない。
- 送信前に完全なpending payloadを保存。保存失敗時はdispatchしない。同じ論理回答の全field・operationIdを固定し、明示retryで再利用する。
- 継承adapterの「Lesson/Activity/前回履歴から作るoperationId」を保持し、Undoされた履歴もseedに含めるよう修正。Undo後の新しい回答が古いUndo済みoperationに衝突しない。
- reload/再入場/foregroundでDomainを読み直す。サーバーが受信済みのpendingは解消し、未確定のpayloadを保持する。content/Attempt revisionが違うdraftは復元しない。別端末完了/Undoはサーバー状態を採用する。
- Help・feedbackのforeground時間を予算に含み、background/中断を除外する。残り0秒では中断・後で再開を案内。Activityを削除/追加したり、時間超過を成功扱いしない。
- checkpointなしでも保存済みAttemptから再開できる。未送信draftや経過時間の端末間同期、複数Lessonの同時draft、正確なper-Attempt時間計測は未対応。

## H. Remaining gaps / required error states

loading、空/不正/不明type、API failure、保存不明、storage failure、同意拒否、AI制限/unknown、別owner、stale responseに対する表示/再読込を実装した。offlineで新しいLessonを取得したり、回答を裏で自動送信する機能はない。表示済み内容と入力を保持し、再接続後に明示retry/再取得する。

後続の境界:

1. **UI Phase 1との接続:** Previewが選んだ実Lesson IDでDomainLessonをmountし、Complete/Homeの既存componentに接続する。現状は`/?lesson=<id>`で開く入口を提供するだけで、Home/Continueの選択優先順位は変更しない。
2. **Composer:** 「今日のLesson」の生成・時間内の割当選択、Helpに応じた短縮は未実装。現行ACTIVE割当をUIが削ることはしない。
3. **Retention資格:** 新Lessonは現在`qualifies=0/earned_day=null`。0011 triggerもそれを強制する。Streak連携には資格policyと後続migration、complete/Undoの同一transaction連携が必要。今回のU2では決め直さない。
4. **採点/ObjectiveState:** 自動採点・mastery projection・Objective Due schedulingはDomainの後続仕様が必要。
5. **一括取得:** queryは既存APIの組合せでatomic snapshotではない。最後の完了判定はserviceが行い、競合は再取得へ戻す。必要性が計測されるまで新runtime APIは追加しない。

## I. Changed areas

`features/my-lesson/`（Domain adapter、Help、checkpoint、entry、Shell/結果）、`app/page.tsx`の入口、`app/api/ai/chat/route.ts`、`lib/ai/lesson-context.ts`、`lib/openai.ts`、関連unit/browser tests、および本書/feature README。

Domain command/query/result enum、DB schema、migration、Retention/Streak/Due/Continue selectorは変更していない。

## J. Validation

Node 22.23.2、隔離SQLite、署名付きfixture account、テストproviderを使用。実AI課金・本番DB・live loginは使わない。

- unit: 5renderer、契約、Attempt再送、Undo、新規回答、storage failure/reload、checkpoint隔離/cleanup、AI文脈/同意/owner/取消/unknown、旧UI回帰を検証。
- browser: 375/1280pxの既存renderer回帰、実Domain APIの6Activity完了、二重tap、応答消失、失敗後retry、draft復元、Help同意拒否/許可、遅延応答、pause/Home/reentry、別accountを検証。
- browserのHelp成功応答はfixture transportに限定したstub。実routeのprovider呼出し・キャッシュ・安全境界は`tests/ai-lesson.test.mjs`で独立に検証する。
- `npm run check`成功：245/245 tests、typecheck、lint（error 0、既存warning 41）、Web build。`npm run mobile:build:local`成功（既存chunk-size warningあり）。
- 5renderer browser、実Domain/entry browser、既存auth/privacy browserは全て成功。画面の375px screenshotも確認した。release環境へのbuild/deploy、live AI呼出し、native signingは実施していない。

## K. Recommended next implementation order

1. UI Phase 1の統合後、実Lesson選択→DomainLesson→既存Complete/Homeを接続し、Homeからの通しE2Eを追加。
2. Composerと新LessonのRetention資格policyを確定。必要なら新migrationとtransaction統合を別変更で実施。
3. final designer visuals/i18n、per-Attempt計測、必要性に応じたresume/budget精度を改善。
4. AI採点・Objective scheduling・adaptive composerは新しいDomain仕様が固まってから追加。

## L. Git/worktree strategy

実装は`/private/tmp/patch-u2` / `codex/patch-u2`に隔離。既存`codex/lesson-shell`と`codex/lesson-shell-plan`は変更しない。継承commit `9939e07`にはそれ以前のDomain統合があるが、このセッションではmergeしない。UI Phase 1統合後の新Devに対して、既存U2と今回の差分をreviewし、入口の小さな変更を統合先の配置に合わせる。main/productionは対象外。
