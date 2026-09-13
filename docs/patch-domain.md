# Patch Product Domain / Data Foundation

基準: Dev `40957db35100b7b02d115a39971bb38c6750cc73`。このbranchはUIを変更しない。新Domainは既存Card APIとは独立した追加経路であり、自動移行・二重記録は行わない。

## CLI2向けの公開契約

Web/Capacitorとも `lib/domain/types.ts` の型を使用する。HTTPは同じ既存backendへ送る。UI/AIからDBをimportしない。

```tsx
import { useApiFetch } from '../app/account-context';
import { createDomainClient } from '../lib/domain/client';
// 認証済みAccount/Privacy provider配下で使用する。
const request = useApiFetch();
const domain = createDomainClient(request);
const patch = await domain.command({
  action: 'createPatch', input: { title: '細胞のしくみ', mode: 'TOPIC' },
});
const objectives = await domain.query({ resource: 'objectives', id: patch.id });
const lessons = await domain.query({ resource: 'lessons', id: patch.id });
```

実際のUIでは呼び出しをイベント/effect内に置く。account switch時は旧clientを破棄し、既存account scopeのstale-response rejectionを必ず通す。素のfetchやDB repositoryで代用しない。domain client自身はlocalStorage・Keychain・Widgetに新しいキャッシュを作らない。

- `POST /api/domain`: `{action, input}`。成功はentityのJSON。所有者は署名付きClerk sessionと`X-Patch-Account`/`X-Patch-Session`から解決する。bodyのowner/user指定は400。
- `GET /api/domain?resource=...&id=...`: 下表。すべて認証必須、no-store、correlation ID付き。
- 生の入力はserviceでも再検証。未知のaction/field/Activity type・重複query keyを拒否。JSONは256 KiBまで。未知/他ユーザーIDは同じ404。
- Domain errorは`{code}`とHTTP status。400入力、403inactive、404不存在、409競合、503一時障害。clientの例外はmessage=code、status付き。既存transportの障害・stale例外はそのまま伝播する。

| Command | inputと意味 |
| --- | --- |
| createPatch | title(1–200文字), mode: TOPIC/MATERIAL |
| createSource | patchId, title, content(最大200,000文字) |
| attachSource | patchId, sourceId。未所属または同じPatchのみ。別Patchへ再所属しない |
| createObjective | patchId, description, objectiveType(最大60文字), difficulty(整数1–5) |
| createActivity | objectiveId, type, prompt, answer, explanation, estimatedSeconds(整数5–900), metadata |
| createLesson | patchId, targetMinutes(整数5–15), activityIds(順序付き・重複なし1–100件) |
| startLesson / completeLesson / abandonLesson | lessonId |
| recordAttempt | activityId, lessonId?(省略時standalone), result, response, durationMs(0–3,600,000), operationId |
| undoAttempt | attemptId |
| writeObjectiveState | objectiveId, mastery(0–1), incorrectCount(非負整数), lastReviewedAt, nextReviewAt, expectedVersion |
| importLegacySet | setId。明示的なsnapshot import、一度のみ |

| Query resource | idの意味 / 戻り値 |
| --- | --- |
| patches | idなし / 所有Patch一覧 |
| patch | Patch ID / Patch |
| sources / objectives / lessons | Patch ID / 一覧 |
| activities | Objective ID / Activity一覧 |
| lesson / lessonActivities | Lesson ID / Lessonまたは順序付きrelation一覧 |
| attempts | Activity ID / 全履歴（undoneAtを含む、記録順） |
| objectiveState | Objective ID / state、未作成はnull |

`CommandResults` / `QueryResults`がactionごとの型を定義。IDはサーバーUUID。APIに渡すIDとoperationIdは英数字・`_`・`-`の1–120文字。日時はUTC ISO8601ミリ秒形式またはnull。

## Domainと保存

| Domain | 保存・境界 |
| --- | --- |
| Patch | 新`patches`。CardSetのrenameではない。ownerId/title/mode/status/timestamps。statusはACTIVE/ARCHIVED |
| Source | 既存`sources`にnullable patch_idのみ追加。複数Sourceが1 Patchに所属できる |
| LearningObjective | 新`learning_objectives`、Patchへのowner付きFK。onboarding.learningGoalとは別。objectiveTypeは分類ラベル、status ACTIVE/ARCHIVED |
| Activity | 新`activities`。型・runtime・DB CHECKの全てでLEARN/RECALL/CHOICE/EXPLAIN/APPLYだけ。Cardとは別entity |
| Attempt | 新`attempts`。owner+operationId一意、payload hash、任意のlessonId、undoneAt。review_logsは変更しない |
| ObjectiveState | 新`objective_states`。user/objective主キー、versionによる競合検出。mastery自動計算・Due schedulingは未実装 |
| Lesson | 既存`study_sessions`にpatch_id/target_minutes/status/started_at追加。completed_at/created_at/estimated_secondsを再利用 |
| LessonActivity | 新`lesson_activities`。owner/lesson/position主キー、activity重複不可、秒数snapshotを保存 |

新6テーブルはownerを含む主キー/FKを持ち、サービスも必ずowner-scoped transactionで処理する。loop-ownerとinactive/missing accountは新Domainを利用できない。Source/既存sessionへの追加relationは所有者検証triggerで保護。Domain LessonとActivityは同じPatchでなければならない。

CHOICEのmetadataは`{choices: string[]}`のみ、2–6個・重複なし・answerを含む。他4種類は`{}`。Activity prompt/answer/explanationはそれぞれ最大12,000文字。LEARNのみanswer空を許可。未知のAI出力typeは補正せず拒否する。今回のAPIはOpenAIを呼ばず、AI Consent/cost/rate limit/idempotencyの既存経路も置き換えない。

## Lesson lifecycleと復元

- CREATED → ACTIVE → COMPLETED、またはCREATED/ACTIVE → ABANDONED。完成後の有効なUndoだけACTIVEへ戻す。ABANDONEDから再開は不可。
- 呼出元がActivity一覧を指定する。合計estimatedSecondsは300–900秒。targetMinutesは目標値であり、合計秒数と完全一致は要求しない。時間の実測や固定枚数による完了判定はしない。Composerは未実装。
- すべての割当Activityに成功した最新の非Undo Attemptが存在して初めて`completeLesson`を許可。LEARNはCOMPLETED、他4種はCORRECT/INCORRECT。結果は現在の呼出元の評価であり、新しいAI採点機能ではない。
- Attemptの記録だけでLessonは自動完了しない。5枚の中間区切りもLesson completionではない。CLI2は全体終了時に明示的に`completeLesson`を呼ぶ。
- ACTIVE以降の割当変更は禁止。秒数/orderをsnapshot保存するため、後のContent変更で実行中Lessonを再構成しない。
- 再起動時は`lessons`→`lesson`/`lessonActivities`→Activity別`attempts`で復元できる。undoneAt付きの履歴は完了証拠に含めない。
- 新Lessonの旧必須set_idは内部sentinel `domain:<patchId>`、card_idsは`[]`。APIの`legacySetId`は**legacy=true時だけ**CardSet IDとして利用すること。新LessonではpatchIdを使用する。
- 新Lessonはqualifies=0/onboarding=0/earned_day=null。旧Continueの中断検索・旧review reconciliationから除外する。Streak/Due/Notification/Widgetは既存Card学習を継続。将来のOnboarding→Lesson completion/Retention接続は次フェーズで行う。

## Attemptの再送・Undo / ObjectiveState

`operationId`を最初の送信前に生成し、通信断・再送では同じ値と同じinputを使う。同一owner+operationIdは同じAttemptを返し、異なるpayloadは409。JSONキー順序はfingerprintに影響しない。DB一意制約と書込transactionで二重送信を直列化する。失われた応答・プロセス再起動・backup復元後も同じ。

Undoは同じActivity/同じLesson（standalone同士を含む）の最新の有効Attemptだけ。soft undoとLesson再計算を同一transactionで行う。Undo済みoperationの再送はundo済みAttemptを返すだけで復活しない。もう一度回答する場合は新operationId。Undo再送はidempotent。

ObjectiveStateは明示的projection storage。初回expectedVersion=0、更新は取得したversionを指定、競合は409で再読込する。Attempt/Undoはこのstateを自動更新・巻戻ししない。自動mastery計算を導入するときに同じunit of work内でprojection更新を追加する。現時点では既存CardのDueを置き換えない。

`recordAttempt`・`undoAttempt`・状態遷移・既存set import以外の作成コマンドは盲目的に再送しない。汎用transportも自動再送しない。作成応答を失った場合は一覧で照合してから次の操作を行う。

## Legacy compatibility

- 旧CardSet/Card/review_logsを残し、既存API/Undo/session restoreは従来通り。通常操作で自動importしない。
- `importLegacySet`は独立Patchを作り、既存Sourceを関連付け、有効な各CardをObjective+Activityへsnapshot変換する。qa→RECALL、multiple_choice→CHOICE、self_explain→EXPLAIN。削除済み/アーカイブCardは除外。
- legacy_set_id/legacy_card_idで出自を保持。再importは同じPatchを返し、旧/新Contentを勝手に同期しない。Sourceが別Patch所属なら409、全体rollback。旧Card/Set/Reviewは更新しない。
- `asLesson`はpatchId=nullの旧sessionを読み取り専用Lesson viewへ変換。statusはcompleted_atから導出、targetMinutes=null。旧sessionのmutationは旧APIを使う。
- `service.legacyHistory(owner,cardId)`はowner検証済みのread-only review view。元rating/reviewLogIdを保持し、Undo済みは除外。Activityの存在しない旧履歴を架空Attemptとして保存しない。

## Infrastructure / deletion

0011だけを追加。既存migration・既存行は変更せず、Drizzle journal/snapshotとschema-manifestを更新。DDLは引き続き明示的runnerのみ。テストは隔離SQLiteで実行、本番DB未適用。リリース時は既存runbookに従いbackup→explicit migration→validate→deploymentを行う。UIの接続とは別にAPI/schemaを同時に展開する必要がある。

Account deletion workerはattempts/objective_states/lesson_activities→study_sessions→activities/objectives/patches→旧データの順で同じtransaction内から消す。途中DB障害は全rollback、Clerk障害は既存jobが再試行。deleting開始後の遅延Domain writeは拒否。別ユーザーとloop-ownerは保持する。端末に追加stateを導入していないためcleanup対象の新local keyはない。

既存encrypted backup/restoreは全tableを列挙するため6テーブルも自動収録する。owner/FK/同一Patch/membership検証を拡張し、旧migration prefixのbackup検証も維持。Attemptのrowid順序・operationId・LessonActivity順序を復元しても重複記録しない。

## Verification

`tests/domain*.test.mjs`でDomain保存、型/runtime/SQL制約、全Lesson完了、再送/通信断/restart、Undo/rollback、owner/loop-owner/lifecycle、signed auth API、旧0010→0011データ保持、legacy互換、暗号化backup/restore/deletion retryを確認。既存全テスト・Web/mobile/native回帰の最終結果はSTATUS.mdを参照。
