> Canonical repository requirements document
> - Version: 3.0
> - Source: finalized DOCX — Mepamo_Patch_統合要件定義書_開発実行計画_v3.0_2026-10-06.docx
> - Converted date: 2026-10-07 (Asia/Tokyo)
> - Public product name: Mepamo
> - Internal Patch identifiers may remain where technically required.

MEPAMO / PATCH

# 統合要件定義書・開発実行計画

Product Requirements, Technical Baseline, Production/TestFlight Handoff & Execution Plan

<table><tbody><tr class="odd"><td>Version<br />
3.0</td><td>Updated<br />
2026-10-06</td><td>Current baseline<br />
Dev aa1c7f48… / Production + Internal TestFlight operational</td></tr></tbody></table>

統合元: v2.0（2026-09-14）を基礎に、2026-10-06までのProduction基盤構築、Cloudflare削除Worker、監視、Apple Signing、Internal TestFlight、Production AI実機生成、External TestFlight提出までの実績を反映した更新版。公開ブランドはMepamo、内部のBundle ID / App Group /一部Domain名はPatchを維持する。

<table><tbody><tr class="odd"><td></td><td>現在地<br />
Production backend・認証・DB・監視・削除scheduler・iOS署名・Internal TestFlight・Production AI生成は実環境で稼働確認済み。External TestFlight build 1.0 (1) は「Mepamo friends」でBeta App Review審査待ち。次の主戦場は外部テスターQA、ブランド統一、実削除E2E、運用証跡の完了、App Store提出準備。</td></tr></tbody></table>

**この文書が一つの共通基準**

Yota・UIデザイナー・Codexが、古い資料やチャット断片ではなく、このv3.0を「現在の実装・体験・役割・次アクション」の共通基準として使う。コード上の確定事項とデザイン上の参考を明確に分離し、UI画像が既存Domainの意味を上書きしないようにする。

## 0. Executive Summary / 現在のスナップショット

<table><tbody><tr class="odd"><td></td><td><p><strong>最重要原則</strong></p><p>Visual Reference は「どう見えるか」の正本。既存コード・テスト・API/Domainは「どう動くか」の正本。両者が衝突する場合、Backend/Domainをスクリーンショットへ合わせて変更しない。</p></td></tr></tbody></table>

| **項目**             | **2026-09-14 時点**                                                                                                                                                                                                      |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 最新確認済み Dev     | aa1c7f48357d59604d307b6f488125632fe4e9b4（local/origin/GitHub一致確認済み。Production appも同SHA）                                                                                                                       |
| 自動検証ベースライン | Release/DB/Worker/iOS関連の段階別検証を通過。直近ではWorker workerd回帰27 PASS、関連Worker/API/infra 77 PASS、mobile/iOS関連32 PASS、AI診断関連48 PASS。Release artifact guard / secret scan / schema validationもPASS。 |
| コア技術基盤         | Capacitor/iOS、Clerk Production、Turso Production、Vercel Production、OpenAI、Cloudflare Worker、Healthchecks/UptimeRobot、backup/restore運用までProduction接続済み。                                                    |
| UI状態               | Current TestFlightでCreate/生成・学習フローを実機確認中。公開ブランドMepamoへの完全統一は未完了で、Patch表記・Widget名・通知・Launch Screen等に残存箇所あり。                                                            |
| Apple / 実機         | 個人Apple TeamでSigning済み。Bundle ID com.patch.learning、Widget com.patch.learning.widget、App Group group.com.patch.learning.retention。Internal TestFlight 1.0 (1)を実機起動・OTP認証・AI生成まで確認済み。          |
| 次フェーズ           | External TestFlight（Mepamo friends）承認→3〜5人QA→Build 2でブランド/バグ修正→実削除E2E・運用証跡完了→10〜20人テスト→App Store提出判断。                                                                                 |

### 本書の章構成

-   1\. プロダクトゴールとProduct Constitution

-   2\. Source of Truth / 意思決定ルール

-   3\. アーキテクチャとDomain原則

-   4\. 現在の実装ステータス

-   5\. 機能要件

-   6\. UI/UX・デザイン実装要件

-   7\. 3者の役割とDesign Handoff

-   8\. Codex / Git / CLI実行ルール

-   9\. 更新版ロードマップ

-   10\. Quality Gate / Definition of Done

-   11\. Decision Gate / 未確定事項

-   12\. Immediate Next Actions

-   13\. Change Log / 旧2文書からの統合点

-   14\. Production / TestFlight Handoff（2026-10-06）

-   15\. 新しいChatでの継続開発プロトコル

## 1. プロダクトゴールと Product Constitution

Patchの目的は、ユーザーが「何を勉強すべきか」を毎回考えなくても、短い学習を開始し、理解・想起・応用を行い、その結果が次の学習へ反映される状態を作ること。Web/iOSで主要UI・学習ロジックを共有し、同じ学習状態・Retention状態を参照する。

### 1.1 v1の完成像

-   Email（将来はSign in with Apple）で安全にログインし、ユーザーごとの教材・学習履歴・AI操作・通知・Widgetを完全分離する。

-   Homeから次の学習を迷わず開始し、1回のMy Lessonをおおむね5〜15分で完了できる。

-   Lessonの完了・回答結果・復習状態が保存され、次回のLesson選定や難易度・順序に反映される。

-   Streak / Today’s Due Count / Continue Learningはserver-authoritativeな共通状態をHome・Widget・通知で共有する。

-   AIは明示同意後のみ利用し、権限・進捗・Streak・DB整合性などの決定権は通常コード/Domainに置く。

-   UIはデザイナーのVisual Directionを高い忠実度で再現しつつ、存在しないBackend概念をスクリーンショットのために作らない。

-   TestFlightで実機検証後にApp Store公開へ進む。

### 1.2 Core Experience

<table><tbody><tr class="odd"><td></td><td><p><strong>基本ループ</strong></p><p>HOME → TODAY’S MY LESSON → COMPLETE → HOME</p></td></tr></tbody></table>

-   Homeは管理ダッシュボードではなく「次に何をするか」を決めてくれるDecision Killerとして設計する。

-   各画面のPrimary CTAは原則1つ。追加学習や管理操作はPrimary Goalより弱く見せる。

-   Input/Uploadは重要だが、学習開始の必須前提とはしない。既存Patch・topic・starter/calibrationなどからLessonが存在し得る。

-   AI Helpは学習から離脱させる独立プロダクトではなく、原則としてLesson文脈内で支援する。

### 1.3 現在のProduct Model（UIが従う意味構造）

UIは以下の概念を中心に組み立てる。実装上のテーブル/型の詳細はコード契約を正本とし、UI側で新しい意味を発明しない。

| **概念**                            | **役割**                                                                                              |
|-------------------------------------|-------------------------------------------------------------------------------------------------------|
| Patch                               | ユーザーが継続的に理解・定着させたい学習単位。旧「Set」中心のメンタルモデルを今後の主軸に固定しない。 |
| Source                              | テキスト、画像、PDF、会話など、Patchへ学習情報を与える入力。                                          |
| Learning Objective / Learning State | 何を理解・保持すべきか、その習熟・復習状態。                                                          |
| Lesson / My Lesson                  | その時点でユーザーが行う短い学習セッション。                                                          |
| Activity                            | Learn / Recall / Choice / Explain / Apply等のLesson内活動。                                           |
| Attempt / Result                    | 回答・支援利用・完了など、後続Lessonへ反映する学習結果。                                              |

## 2. Source of Truth / 意思決定ルール

古いデザイン画像、旧要件、最新コードが混在するため、Codex・デザイナー・Yotaは次の優先順位を共通ルールとする。

| **優先** | **正本**                                                | **何を決めるか**                                                              |
|----------|---------------------------------------------------------|-------------------------------------------------------------------------------|
| 1        | Current implementation / tests / API / Domain contracts | 技術的に何が存在し、どう動くか。Security・state・ownership・migrationを含む。 |
| 2        | 最新Product/Domain requirements（本書）                 | 体験、状態の意味、優先順位、Navigationの意味。                                |
| 3        | Designer reference images                               | レイアウト、余白、サイズ、色、カード、影、キャラクター配置など「見た目」。    |
| 4        | Designer handoff内の旧Behavior記述                      | 1〜3と矛盾しない場合のみ採用。                                                |

<table><tbody><tr class="odd"><td></td><td><p><strong>Conflict Rule</strong></p><p>画像に合わせるためにStreak計算、Lesson状態、Account ownership、AI consent、Navigation semantics、DB schemaを変更しない。画像内の例示テキストや数値（Yota / AI Agents / 7 minutes / 5 days / Chapter 1等）はproduction dataではない。</p></td></tr></tbody></table>

### 2.1 Visual実装時の分類

| **分類** | **意味**                                   | **Codexの行動**                                     |
|----------|--------------------------------------------|-----------------------------------------------------|
| SAFE     | 見た目と現在Domainの意味が一致             | そのまま忠実に実装。                                |
| MAP      | Visualは使えるが意味は現Domainへ置換が必要 | Visual hierarchyを維持し、real stateへ接続。        |
| DEFER    | 画像が未実装/未確定の新Product概念を要求   | 勝手に機能を作らず、周辺UIのみ進め、gapとして報告。 |

### 2.2 旧デザインで特に注意する概念

-   「No material = Add materialしかできない」: 採用しない。現在Domainが次Lessonを持つ場合は学習を優先。

-   固定のDuolingo型Chapter / Locked Lesson / Milestone: 現Domainに存在する範囲のみMapping。存在しなければ新しいbusiness logicを作らない。

-   Home / Sets / Create / Progress / Profile: 旧案。最終Information Architectureとしては未確定。

-   Create / Chat with AI / Upload Material: 現在の画像はVisual Reference。Universal Input/Patchへの統合方法は再設計対象。

## 3. アーキテクチャとDomain原則

| **領域**     | **現在 / 方針**                                              | **必須ルール**                                                                                                                               |
|--------------|--------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| UI           | Next.js / React + Capacitor                                  | Web/iOSで主要UIと学習ロジックを共有。UIはDomainを再計算しない。                                                                              |
| iOS通信      | Native HTTP / PATCH\_API\_URL=https://mepamo.com             | Bearer token。認証情報をJS/localStorageへ長期保存しない。                                                                                    |
| Web認証      | Clerk + Cookie                                               | 同一認証基盤。Serverがinternal userを確定。                                                                                                  |
| iOS認証      | ClerkKit + Keychain / Production確認済み                     | Production Clerk issuer https://clerk.mepamo.com。Bearer認証で実機確認済み。Server secretはbundleへ含めない。                                |
| API          | Next.js API                                                  | auth / lifecycle / ownership / idempotencyをserverで検証。                                                                                   |
| DB           | Turso/libSQL + Drizzle / mepamo-production (Tokyo)           | 明示migration。internal users.idをownership基準にする。                                                                                      |
| AI           | OpenAI Responses API / Production AI enabled                 | Consent Gate + idempotency + rate/concurrency/budget + unknown-state fail closed。AI\_ENABLED=true、DB ai\_control=1。実TestFlight生成成功。 |
| Retention    | Server-authoritative summary                                 | Streak / Due / Continue Learningの単一正本。                                                                                                 |
| Widget       | WidgetKit + App Group                                        | 資格情報ではなく最小snapshotのみ共有。                                                                                                       |
| Notification | Local first / APNs decision gate                             | 2系統のlocal通知を先に検証。Pushは必要性確認後。                                                                                             |
| Reliability  | 共通error/network layer                                      | stale response、timeout、offline/reconnect、safe retry、sanitized logs。                                                                     |
| Release      | PATCH\_ENV + release guards / Vercel Production + TestFlight | 開発Secretやlocal設定が混ざる場合はrelease fail。                                                                                            |

-   Clientから送信されたuser IDを認可根拠にしない。

-   Deep Link / Widget / Notification payloadは「遷移ヒント」であり認可情報ではない。

-   Account switch後に前ユーザーのresponse、workspace、notification、widget、AI操作を混入させない。

-   結果不明の非idempotent処理を安易に自動retryしない。

-   Production不可逆操作・課金・本人認証・最終Submitは人間承認を必須とする。

## 4. 現在の実装ステータス

旧v1.1ではPrivacy/Retention/AI Hardening等が未統合だったが、現在は大部分がDevへ統合済み。以下を最新状態とする。

| **領域**                                 | **Status**        | **現在地 / 残作業**                                                                                                                                                                     |
|------------------------------------------|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| iOS / Capacitor基盤                      | DONE              | Production artifactをiOSへ同期、Release guard PASS、個人Apple TeamでSigning、Archive/Validate/Upload成功。Internal TestFlight 1.0 (1)実機起動済み。                                     |
| Clerk Auth / Account isolation           | DONE              | Clerk Production・email OTP・iOS Bearer authを実機確認。mepamo.com経由でVercel SSOに阻害されないStandard Protectionへ整理。                                                             |
| Production Infrastructure                | DONE              | Vercel mepamo1192、mepamo.com、Turso mepamo-production、schema/migration、backup/restore、health/readyをProductionで確認。                                                              |
| Privacy / AI Consent / Account Lifecycle | DONE / E2E残      | Consent/lifecycle実装済み。削除schedulerは稼働確認済み。実テストアカウントの削除E2E（Clerk/DB/receipt/別ユーザー非影響）は正式公開前に実施。                                            |
| AI Production Hardening                  | DONE / LIVE       | AI\_ENABLED=true、DB ai\_control=1。未解決AI operation 0を確認後、Internal TestFlightから1件の教材生成に成功。idempotency/予算/unknown防止を維持。                                      |
| Retention System                         | DONE / 実機QA継続 | Streak/Due/Continue/Widget/Local Notification基盤は実装済み。TestFlightでWidget・通知・local-only制約を継続確認。                                                                       |
| Reliability / Error Handling             | DONE              | health/ready、safe retry、stale rejection、Production障害切り分けを実運用で使用。AI停止時の汎用エラー文言は改善候補。                                                                   |
| Public Pages                             | DONE / legal残    | /privacy /terms /support公開基盤あり。正式App Store前にlegalAddress/effectiveDate等の最終値を確定。                                                                                     |
| Integration Stabilization                | DONE              | Production release SHAを固定しつつWorker-only releaseを分離。app/workerの証跡を独立管理。                                                                                               |
| Domain / migration 0011                  | DONE              | Production DBは13 migrations 0000–0012適用・検証済み。Fresh bootstrap/restore evidenceあり。                                                                                            |
| UI再設計 / Visual implementation         | IN PROGRESS       | 現行TestFlight UIまで実装済み。Mepamo branding統一、Launch Screen、Widget/通知/エラー文言、外部テスター起点のVisual QAをBuild 2へ。                                                     |
| Production external setup                | DONE / evidence残 | Clerk/Turso/Vercel/OpenAI/Cloudflare/monitoring/backupsを設定。運用実績あり。ただしconfig/production-operations.jsonの参照5項目は未反映の可能性があり、check:operations最終PASSが残る。 |
| Apple production / TestFlight            | IN PROGRESS       | Apple Signing・App Store Connect record・Internal TestFlight完了。External group「Mepamo friends」へ1.0 (1)追加、Beta App Review審査待ち。Sign in with Appleはv1必須ではなく将来gate。  |
| App Store                                | PLANNED           | External QA後にmetadata/screenshots/legal/privacy/review notesを完成し正式Submit。                                                                                                      |

<table><tbody><tr class="odd"><td></td><td>最新確認済み品質ベースライン<br />
Dev aa1c7f48357d59604d307b6f488125632fe4e9b4。Production app同SHA。Release artifact / secret / schema / iOS config PASS。Cloudflare Worker修正は専用commit cfae8d9cd4f12ddf9b45e2917dafaeddc8d4f58aで運用し、app SHAは不変。Internal TestFlight 1.0 (1)で実機起動・OTP・Production AI生成成功。</td></tr></tbody></table>

## 5. 機能要件

### 5.1 Authentication / Session / Isolation

-   Email verification codeでSign up / Sign in。初期はpasswordless。

-   WebはClerk Cookie、iOSはClerkKit + Keychain。Sessionが有効ならreload/再起動後も復帰。

-   未認証APIは401。他ユーザーresourceは存在情報を漏らさない形で拒否。

-   Account switch時は旧ユーザーのlocal state、pending request、notification、widget snapshot、AI operationを破棄/無効化。

### 5.2 AI Consent / Privacy / Account Deletion

-   AI Card Generation、AI Chat、AI summary等は共通Consent Gateを通す。unset/denied/revoked/old versionではOpenAI call 0。

-   Consentの正本はserver。送信対象・目的・policy version・操作ID等を追跡可能にする。

-   Account deletion受付後はlifecycle=deletingとして通常API/AIを停止し、削除jobを再試行可能にする。

-   遅延AI応答や古いJWTで削除後のデータを復活させない。別ユーザーとlegacy loop-ownerを保護する。

### 5.3 Lesson / Learning Experience

-   HomeのPrimary CTAは現在のNext Best My Lesson / Continue Learningを優先する。

-   Lessonは開始・回答・Feedback・中断・再開・完了・保存まで一貫して動く。

-   学習結果は次回の内容・順序・難易度・復習タイミングへ反映可能な構造を維持する。

-   UIはLesson/Activity stateを表示するだけで、進捗・達成条件・認可を再実装しない。

-   今後のLesson ShellはLearn / Recall / Choice / Explain / Apply等のActivityを同一フレーム内で扱う方向。

### 5.4 Streak / Due Count / Continue Learning

-   Streakは1日に1回のみ加算。固定カード枚数だけを条件にしない。正式な学習セッション完了をserverで評価する。

-   1〜4日=通常、5日以上=Hot Streak。日付境界はIANA timezoneを基準に扱う。

-   Today’s Due Countはoverdue + 当日dueになる未完了Reviewをserverで計算し、Home/Widget/Notificationで共有。

-   Continue Learning resolverはOnboarding → interrupted session → Today Review → Recommended Next →既存未学習 → input/add → Homeの原則を維持し、現在Domainへ合わせる。

-   Deep Linkはpatch://continueを基本にし、login前・session restore中・削除済み・別user resourceで安全にfallbackする。

### 5.5 Notification / Widget

-   Local Notificationは(A)ユーザー指定時刻のreview reminder、(B)Streak risk warning。permissionは価値説明後に要求。

-   Study completion時は不要warningをcancelし、Due Count=0ならreview通知をcancel/rescheduleする。

-   Widget stateはSIGNED\_OUT / NEW\_USER / NORMAL / AT\_RISK / LAST\_CHANCE / COMPLETED / BROKEN / STALEを扱う。

-   AT\_RISK&lt;=6h、LAST\_CHANCE&lt;=3h、warning約3h前は現時点のprovisional値。実機UXで調整可能。

-   Local-only制約として、別端末で完了してこの端末がterminated中の場合は即時同期できない。Push/APNsはTestFlight後のdecision gate。

### 5.6 Reliability / Failure Handling

-   API/DB/OpenAI/Clerkの障害で白画面やcross-account data leakを起こさない。

-   通常APIは安全なtimeout/error classificationを使用し、自動retryは限定。非idempotent operation IDを保持する。

-   Offline/reconnect/foreground復帰時にstale responseを拒否し、保存済み教材の学習は可能な範囲で継続。

-   ログへtoken、Secret、email、教材本文、AI会話全文、raw request/responseを出さない。

## 6. UI/UX・デザイン実装要件

<table><tbody><tr class="odd"><td></td><td><p><strong>UI Phase 1の基本姿勢</strong></p><p>「忠実なVisual再現」と「最新Domainを守る」を同時に満たす。デザイン画像にない事情を理由に雑に別デザインへ変えず、同時に画像内の古いProduct Logicをコードへ固定しない。</p></td></tr></tbody></table>

### 6.1 Visual Fidelity

-   Reference画像はcomposition、hierarchy、spacing、relative size、radius、shadow、typography、color direction、CTA、icon scale、mascot placementの正本。

-   基準frameはiPhone約393×852。小型/大型iPhoneとmobile webでも致命的に崩れないresponsive実装にする。

-   スクリーンショット固有のmagic numberで無理に合わせるより、同じ見た目を再現できるDesign Token/Componentを優先する。

-   実装後は同一状態のスクリーンショットを取得し、referenceと比較してspacing/scale/alignment/typography/radius/shadow/color/icon/mascotを修正する。

### 6.2 Asset / Icon Strategy

| **優先** | **方法**                                                                          |
|----------|-----------------------------------------------------------------------------------|
| A        | Repo内に正しいassetが存在 → それを再利用。                                        |
| B        | 既存icon libraryに非常に近いもの → Visual差が小さい場合のみ利用。                 |
| C        | 単純な幾何形状/custom icon → lightweight SVGとして忠実に再構成。                  |
| D        | 独自イラストでcode/SVG再現が不適切 → design/ASSET\_REQUESTS.mdへ不足assetを記録。 |
| E        | 必要に応じYota/ChatGPT側で透明PNG/SVGを生成・追加 → Codexが再反映。               |

Codexが「似ているだけの別アイコン」を無言で採用して完了扱いにしない。Mascotは可能な限り正式assetを使い、reference screenshotからの再描画は最後の手段とする。

### 6.3 今夜/Phase 1で実装してよい範囲

-   共通UI foundation（必要最小限のcolor / typography / spacing / radius / shadow / Button / Card / Screen / Bottom Sheet / Mascot presentation）。

-   Home visual system（early/empty相当、active/current learning相当を現在DomainへMapping）。

-   Streak visual states（Normal / Hot / inactive-broken）。

-   Continue Learning / My Lesson Preview bottom sheet。

-   Lesson Complete。

-   Post-Lesson Home / completed-today state。

### 6.4 今回はProduct Logicを確定しない範囲

-   最終Bottom Navigation / IA。

-   「Sets」vs「Patch」の最終user-facing terminology。

-   固定Duolingo型Learning Path / Chapter / Milestone / Locked Lessonの新Domain。

-   Create / Chat with AI / Upload Materialの最終flow。現画像はVisual Referenceのみ。

-   Universal Input、Patch Detail、5 Activity Rendererの最終Visual。これらは次回デザイナーhandoffで具体化。

## 7. 3者の役割と Design Handoff

| **領域**                   | **Yota**   | **UIデザイナー**  | **Codex**                |
|----------------------------|------------|-------------------|--------------------------|
| Product goal / scope       | 最終決定   | 提案              | 実装依存・リスク提示     |
| Behavior / state semantics | 最終決定   | 必要に応じ参照    | 既存Domainと整合して実装 |
| Visual / spacing / asset   | 確認・承認 | 制作責任          | 忠実に再現               |
| Data / API / security      | 要点確認   | 参照              | 設計・実装責任           |
| Visual QA                  | 体験確認   | reference差分確認 | screenshot比較・修正     |
| Release                    | 最終判断   | 見た目確認        | build/release準備        |

### 7.1 Repository上のDesign Handoff

<table><tbody><tr class="odd"><td></td><td><p><strong>推奨構造</strong></p><p>design/source/ = デザイナー原本。design/references/ = 個別/参考画像。design/REFERENCE_MANIFEST.md = 画像の意味と注意点。design/ASSET_REQUESTS.md = Codexだけでは再現できないasset依頼。</p></td></tr></tbody></table>

-   原本は削除/上書きしない。Reference画像はCodexが分類・renameしてよい。

-   画像ごとにScreen / State / Visual influence / outdated semanticsをManifestへ短く記録する。

-   Design file自体をGit checkpointへ含め、新しいworktreeでも参照できる状態にする。

### 7.2 次回デザイナーへ依頼する優先成果物

| **Priority** | **依頼内容**                                                              | **目的**                                         |
|--------------|---------------------------------------------------------------------------|--------------------------------------------------|
| 1            | Revised Home + My Lesson Shell + 5 Activity states + Complete             | Core loopのVisualを最新Product Modelへ合わせる。 |
| 2            | AI Help overlay + Universal Input + Patch Detail                          | 旧Chat/Create/Set中心のUIをPatch中心へ更新。     |
| 3            | Navigation alternatives + Loading/Empty/Error/Offline + edge cases        | IAと例外状態を確定。                             |
| 共通         | Color/Font/Spacing/Radius/Shadow/Button/Nav寸法/Icon source/Mascot assets | Codexの再現精度と一貫性を上げる。                |

## 8. Codex / Git / CLI 実行ルール

### 8.1 Codex Session

-   長期チャットに全履歴を持ち続けず、フェーズごとに新しいCodex chatを使いtoken消費を抑える。

-   新chatには「latest Dev + repo内のrequirements/design paths + 今回scope」だけを渡す。

-   調査専用ターンを繰り返さず、必要最小限のinspection → implementation → test → fix → commitまで自律実行。

-   人間に止めるのはLogin/MFA/secret/payment/Apple enrollment/final submit/重要production data changeなど本当にhuman-onlyな操作。

### 8.2 Git / Worktree

-   Devを共有integration branchとする。main/productionは明示承認まで触らない。

-   実装は専用branch/worktreeで行い、同じ機能を複数CLIが同時編集しない。

-   UI Foundationを最初に1本で作り、共通token/componentがDevへ入ってから画面単位で並列化する。

-   commit前にtests/buildを通し、Dev merge後はGitHub origin/Devへcheckpoint pushする。

-   force pushは禁止。production deploy / production DB migrationは別承認。

### 8.3 UI Phaseの推奨並列化

| **段階**      | **CLI 1**                                                    | **CLI 2**                              |
|---------------|--------------------------------------------------------------|----------------------------------------|
| 今            | UI Phase 1 / Foundation + Home + Streak + Preview + Complete | 待機。共通Design基盤を二重に作らない。 |
| Phase 1統合後 | Lesson Shell / Study / Review UI                             | Universal Input / Patch Detail UI      |
| 統合前        | Visual regression + Domain regression                        | 担当画面のVisual QA / state QA         |

## 9. 更新版ロードマップ

| **ID** | **Phase**                           | **Status**             | **完了条件 / 次アクション**                                                                                  |
|--------|-------------------------------------|------------------------|--------------------------------------------------------------------------------------------------------------|
| U0     | Design files checkpoint             | DONE                   | Design assets/referencesは開発で利用済み。以後は新デザイン差分のみcheckpoint。                               |
| U1     | UI Phase 1 / Visual Foundation      | IMPLEMENTED / QA       | Home/Streak/Preview/Complete等は現行アプリへ反映済み。外部TestFlight feedbackでVisual polish継続。           |
| U2     | Lesson Shell + Activity UI          | IMPLEMENTED / QA       | 学習UIは現行アプリで稼働。Activity/AI Helpの最終体験はBuild 2以降で磨く。                                    |
| U3     | Universal Input + Patch Detail + IA | IMPLEMENTED / ITERATE  | Create/Input/Patch生成をTestFlightで利用可能。Universal Input/Patch Detail/IAはユーザーテストで継続調整。    |
| U4     | Full UI Integration & Regression    | IN PROGRESS            | 実機TestFlightでresponsive/error/offline/branding/Widget/notificationをQA。Build 2で修正を集約。             |
| U5     | Production External Setup           | DONE / evidence残      | Production Clerk/API/Turso/OpenAI/worker/monitoring/backups稼働。check:operations参照追記と実削除E2Eを残す。 |
| U6     | Apple Developer / iOS Production    | DONE for current scope | 個人Team Signing、Bundle ID/App Group、Production Clerk実機接続完了。Sign in with Appleは将来gate。          |
| U7     | TestFlight                          | IN PROGRESS            | Internal TestFlight完了。External TestFlight 1.0 (1)はMepamo friendsでBeta App Review審査待ち。              |
| U8     | Push/APNs Decision                  | GATE OPEN              | 外部TestFlightでlocal-only通知/Widgetの不足を観察。必要時のみAPNsを実装。                                    |
| U9     | App Store                           | NEXT AFTER QA          | Build 2→外部QA→legal/privacy/metadata/screenshots/review notes→App Store Submit判断。                        |

旧P01〜P23の初期計画は、本書U0〜U9へ再編した。既に完了したArchitecture/Auth/Privacy/AI/Retention/Reliability等をBacklogとして再実装しない。

## 10. Quality Gate / Definition of Done

| **領域**             | **受け入れ基準**                                                                                                                                                            |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Security / Isolation | A/Bデータ、AI operation、notification、Widget、workspaceが混ざらない。auth/ownership/lifecycleはserver検証。                                                                |
| Privacy              | AI未同意時OpenAI call 0。Consent revoke / account deleting後の遅延結果を保存しない。                                                                                        |
| Learning             | 開始→回答→中断/再開→完了→保存→次回反映が成立。                                                                                                                              |
| Retention            | Streak/Due/Continue Learningが同じauthoritative stateを利用。                                                                                                               |
| Navigation           | Home/Widget/Notification/Deep Linkから安全にContinue Learningへ解決。                                                                                                       |
| Reliability          | offline/timeout/5xx/stale/account switchで白画面・破損・leakを起こさない。                                                                                                  |
| Infrastructure       | migration checksum/drift/backup restore/release guardrailsが維持される。                                                                                                    |
| UI Fidelity          | 基準frameでreferenceと比較し、spacing/scale/typography/color/icon/mascotの主要差分を解消。                                                                                  |
| Accessibility        | tap target、semantic controls、基本contrast、Dynamic Textで致命的に壊れない。                                                                                               |
| Build/Test           | baseline testを維持し、typecheck/lint/Web/mobile/Swift/Simulator/browser regressionを通過。                                                                                 |
| Release              | Internal TestFlight実機起動・OTP・Production AI生成を確認済み。次はExternal TestFlight QA、実削除E2E、運用証跡、正式Privacy/metadata/reviewer accessを完了してApp Storeへ。 |

<table><tbody><tr class="odd"><td></td><td><p><strong>UIでのDone</strong></p><p>コードを書き終えただけではDoneではない。Referenceとの差分確認、real domain接続、state/error確認、関連回帰テストを終え、既知の差分/不足assetを明記した状態をDoneとする。</p></td></tr></tbody></table>

## 11. Decision Gate / 未確定事項

| **項目**                  | **現在の扱い**                                                                                                       |
|---------------------------|----------------------------------------------------------------------------------------------------------------------|
| Final Bottom Navigation   | 旧 Home / Sets / Create / Progress / Profile を固定しない。最新IAをデザイナーと再決定。                              |
| Sets vs Patch terminology | 公開ブランドはMepamo。学習単位の内部/UX概念としてPatchを維持。ユーザー表示の「Patch」残存箇所はBuild 2で意図を整理。 |
| Learning Path             | 旧Duolingo型pathをそのままDomain化しない。real progressを見せる代替案をデザイン検討。                                |
| Universal Input           | Topic / pasted text / image / PDF → new or existing PatchのUXを次デザインで決定。                                    |
| AI Help                   | 独立Chat中心ではなくLesson内overlayを主案。詳細stateをデザイン確定。                                                 |
| Streak thresholds         | AT\_RISK 6h / LAST\_CHANCE 3h / warning 3h前はprovisional。実機検証で調整。                                          |
| Push/APNs                 | Internal/External TestFlightでlocal-onlyの不足を観察中。必要性が明確になった場合のみv1採用。                         |
| Legal placeholders        | Public pagesは存在。正式公開前にlegalAddress / effectiveDate等の確定値を反映。                                       |
| Production setup          | Production setupは実稼働済み。残件はoperations evidence参照、実削除E2E、継続監視。                                   |
| Apple enrollment          | 個人Apple TeamでSigning・TestFlight完了。会社Team不使用。                                                            |
| Visual assets             | Codexで再現困難なicon/illustrationはASSET\_REQUESTS→ChatGPT/Designerで透明asset作成。                                |

## 12. Immediate Next Actions

<table><tbody><tr class="odd"><td></td><td>次の1サイクル<br />
Beta App Review承認 → Mepamo friendsへ3〜5人招待 → 1週間の実利用QA → Build 2でブランド/バグ修正 → 実削除E2E・operations evidence完了 → 10〜20人へ拡大 → App Store提出判断。</td></tr></tbody></table>

| **\#** | **Action**                    | **完了条件**                                                                                                                       |
|--------|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| 1      | External TestFlight承認を確認 | Mepamo friendsの1.0 (1)がテスト可能になったら、まず3〜5人へメール招待。公開リンクは初期は使わず管理可能な人数で開始。              |
| 2      | Critical-path実機QA           | Sign up/OTP、Create→AI生成→Review→Save、再起動、Flashcard/MCQ、再ログイン、Widget、通知、offline/errorを確認。                     |
| 3      | AI運用確認                    | 実生成後にTurso集計でsucceeded/usageを確認し、reserved/dispatching/unknown=0を維持。予算とrate limitsを監視。                      |
| 4      | Build 2修正を一本化           | Patch→Mepamoの表示整理、Widget/通知名、Launch Screen、AI停止時のエラー文言、外部テスターのblocker/高頻度UX問題をまとめて修正。     |
| 5      | 実アカウント削除E2E           | Disposable email OTP accountで削除申請→アプリ終了→Worker completed→Clerk/DB/receipt/再認証拒否→別アカウント無影響を確認。          |
| 6      | Operations evidence完了       | monitoring 3 refs + deletion.schedulerRef + deletion.completionEvidenceRefを非秘密参照として整理し、check:operationsを最終PASSへ。 |
| 7      | 外部テスター拡大              | Build 2安定後に10〜20人へ。クラッシュ/生成失敗/保存失敗/認証失敗を最優先で収集。                                                   |
| 8      | App Store準備                 | legal values、Privacy回答、metadata、screenshots、review notes、reviewer accessを完成しSubmit判断。                                |

## 13. Change Log / 旧2文書からの統合点

本v3.0は、旧「iOS要件定義書・実装ロードマップ」と「開発実行計画書」を単純連結せず、矛盾・古いStatus・重複を解消した統合版。

| **更新点**          | v3.0での扱い                                                                                                                                                 |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Production / domain | mepamo.comをProduction originとして稼働。Vercel Standard Protectionでcustom domainをネイティブから利用可能にし、固有deployment/preview保護を維持。           |
| Turso / DB          | mepamo-productionをTokyoで稼働。13 migrations 0000–0012、Fresh bootstrap/backup/restore、AI preflight SQLを実運用で確認。                                    |
| Deletion operations | Cloudflare Worker mepamo-deletion-schedulerを導入。workerdのredirect:error不具合をWorker-only commit cfae8d9…で修正し、5回連続 idle/heartbeat:okを確認。     |
| Monitoring          | UptimeRobot health/ready監視とHealthchecks scheduler heartbeatを稼働。通知経路も確認。                                                                       |
| Apple / TestFlight  | 個人Apple TeamでSigning、Archive/Validate/Upload完了。Internal TestFlight 1.0 (1)を実機起動。External group Mepamo friendsへbuild提出、Beta App Review待ち。 |
| Production AI       | AI\_ENABLED=trueへ同一app SHAで昇格。Turso pre/post確認で未解決0、Internal TestFlightから教材生成成功。                                                      |
| Branding            | 公開ブランドMepamoを採用。Bundle ID/App Group等の内部Patch識別子は変更しない。ユーザー表示の残存Patch/Launch ScreenはBuild 2候補。                           |
| Release strategy    | App release SHA aa1c7f…を固定し、Worker-only releaseを別commitとして運用。不要なapp SHA churnとbackup再作成を回避。                                          |
| Roadmap             | インフラ構築中心から、External TestFlight→Build 2→実削除E2E/operations evidence→App Storeへ移行。                                                            |

<table><tbody><tr class="odd"><td></td><td>この版の使い方<br />
新しいChat/Codex sessionでは、まず本v3.0を共通基準として読み、Current baseline・Production/TestFlight状態・未完了項目だけを確認する。古いchatの全履歴を再投入しない。実装前にrepoのCurrent implementation/tests/API/Domainを正本として照合し、Production変更・secret・Apple submit等は人間承認を維持する。</td></tr></tbody></table>

## 14. Production / TestFlight Handoff（2026-10-06）

この章は、新しいChat・Codex session・外部テスター対応時に最初に確認する運用スナップショット。ここに明記された状態を、古いv2.0のDEFERRED記述より優先する。

### 14.1 確定済みProduction構成

| **項目**                        | **現在値 / 状態**                                                                                        |
|---------------------------------|----------------------------------------------------------------------------------------------------------|
| Public brand                    | Mepamo（内部プロジェクト/Domain概念としてPatch名は一部維持）                                             |
| App release SHA                 | aa1c7f48357d59604d307b6f488125632fe4e9b4                                                                 |
| Production domain               | https://mepamo.com                                                                                       |
| Vercel                          | project mepamo1192 / workspace scope campus-ring-3f45e625 / Production region hnd1                       |
| Current AI-enabled deployment   | dpl\_ByW4LTzjFuQBbRLMBEzaRKosYV8R                                                                        |
| Rollback AI-disabled deployment | dpl\_6yyCAhKmRRksrbK2EqNZNbaDM9hj                                                                        |
| Production DB                   | Turso mepamo-production / aws-ap-northeast-1 (Tokyo)                                                     |
| Clerk                           | Production issuer https://clerk.mepamo.com / native iOS enabled                                          |
| OpenAI                          | Production project / gpt-5-nano / AI\_ENABLED=true / DB ai\_control(id=1).enabled=1                      |
| Main iOS Bundle ID              | com.patch.learning                                                                                       |
| Widget Bundle ID                | com.patch.learning.widget                                                                                |
| App Group                       | group.com.patch.learning.retention                                                                       |
| TestFlight                      | 1.0 (1) Internal: operational / External group Mepamo friends: Beta App Review waiting                   |
| Deletion Worker                 | mepamo-deletion-scheduler / Cron \* \* \* \* \* / Worker commit cfae8d9cd4f12ddf9b45e2917dafaeddc8d4f58a |
| Monitoring                      | UptimeRobot health+ready / Healthchecks deletion scheduler heartbeat / email notification path verified  |

### 14.2 実環境で確認済みのユーザーフロー

-   Internal TestFlight 1.0 (1)をiPhoneへインストールし、アプリ起動に成功。

-   Production Clerkのpasswordless email OTPで認証し、mepamo.comのProduction APIへ到達。Vercel SSO 302は解消済み。

-   Production AI有効化前後にTurso read-only集計を実行し、reserved / dispatching / unknown / expired lease = 0を確認。

-   AI\_ENABLED=trueへ同一app SHAでProductionを昇格後、TestFlightから「再試行」を1回だけ実行し、教材生成に成功。新しいTestFlight buildは不要だった。

-   Cloudflare削除schedulerは5回連続で event=deletion\_scheduler / outcome=idle / heartbeat=ok。HealthchecksもUpを確認。

### 14.3 既知の残件 / blockerではないが正式公開前に必要

| **領域**               | **Status** | **現在地 / 次アクション**                                                                                                                                          |
|------------------------|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| External TestFlight    | WAITING    | Mepamo friends / build 1.0 (1) はBeta App Review審査待ち。承認後にまず3〜5人へ招待。                                                                               |
| Branding               | OPEN       | ユーザー表示にPatch表記が残る箇所、Widget名、通知タイトル、Launch ScreenのCapacitorデフォルト等をBuild 2で整理。                                                   |
| Account deletion E2E   | OPEN       | Disposable email OTP accountで、申請→app close→Worker→DB/Clerk削除→receipt→再認証拒否→別user非影響を確認。                                                         |
| Operations evidence    | OPEN       | monitoring.providerRef / destinationRef / deliveryEvidenceRef / deletion.schedulerRef / deletion.completionEvidenceRefをconfigへ反映しcheck:operationsを最終PASS。 |
| Legal / Store metadata | OPEN       | legalAddress/effectiveDate、Privacy回答、description、screenshots、review notes等を正式Submit前に完成。                                                            |
| Push/APNs              | GATE       | Local notification/Widgetで不足が明確になった場合のみ実装。                                                                                                        |
| AI operations          | MONITOR    | Production AIは現在ON。外部テスト中はusage/cost/unknownを監視し、異常時はDB stop +既知AI-disabled deploymentへrollback可能。                                       |

### 14.4 外部テスト後の優先順位

-   P0: 登録不能、OTP失敗、教材生成不能、保存不能、クラッシュ、cross-account leakなど「使えない」問題。

-   P1: AI生成失敗率、再起動後のデータ不整合、学習セッション/進捗保存、Widget/通知の誤表示。

-   P2: Mepamo branding統一、Launch Screen、文言、spacing/visual polish。

-   P3: 新機能追加。外部QA中はscopeを増やさず、既存core loopの安定を優先。

## 15. 新しいChatでの継続開発プロトコル

新しいChatへ移る目的は、長い履歴を持ち越さずtoken負荷を下げつつ、Production状態・安全ルール・未完了事項を失わないこと。以下の手順で開始すれば、これまでと同じ開発方式を再現できる。

### 15.1 新しいChatの最初に渡すもの

-   このv3.0 DOCXを添付し、「この文書を現在の共通基準として読んでから進める」と伝える。

-   そのChatで扱うscopeを1つだけ明示する（例: External TestFlight QA、Build 2 branding、account deletion E2E、App Store準備）。

-   必要な最新スクリーンショット/CLI2 reportだけを添付する。古いchat全文は不要。

-   Current app SHA aa1c7f…、Worker-only commit cfae8d9…、TestFlight 1.0 (1)、External review待ちを初期状態として再確認する。

### 15.2 ChatGPT側に守らせる開発ルール

-   Codex promptは英語で作り、その直後に「日本語で何をさせるか」を短く説明する。実際にCodex promptを出す時だけ推奨モデル/Thinking Effortも併記する。

-   Codexへ実装方法を過剰に固定しない。必須要件、制約/Source of Truth、完了時の報告項目を中心にし、既存コードを確認して最適実装を選ばせる。

-   Production・secret・Apple final submit・課金・不可逆DB変更は人間承認を必須とする。

-   「確認できた事実」と「推測」を分ける。CLI報告・実画面・read-only SQL等の証拠なしにProduction状態を断定しない。

-   新しいSHAを作る変更は、backup/release evidence再作成コストを考慮して必要性を先に判断する。Worker-only/ops-onlyでapp SHAを維持できる場合は分離を検討。

### 15.3 推奨Chat分割

| **領域**                     | **Status**      | **現在地 / 次アクション**                                                         |
|------------------------------|-----------------|-----------------------------------------------------------------------------------|
| Chat A: Product / UI         | 通常            | 外部テスターfeedback、Build 2 branding/UX、designer handoff、Visual QA。          |
| Chat B: Release / Production | 高注意          | Vercel/Turso/Clerk/OpenAI/Cloudflare/monitoring、operations evidence、rollback。  |
| Chat C: iOS / App Store      | 高注意          | Xcode signing、Build number、TestFlight、Beta Review、App Store metadata/Submit。 |
| Codex session                | phaseごとに新規 | repo inspection→implementation→tests→report。長期1 chatに全履歴を積まない。       |

### 15.4 新しいChat用スタータープロンプト

以下をそのまま新しいChatの最初に使う:  
  
「添付の『Mepamo / Patch 統合要件定義書・開発実行計画 v3.0』を現在のSource of Truthとして読んでください。公開ブランドはMepamo、内部Bundle ID/App Group等はPatch識別子を維持しています。Current app Dev/Production SHAは aa1c7f48357d59604d307b6f488125632fe4e9b4、Worker-only fixは cfae8d9cd4f12ddf9b45e2917dafaeddc8d4f58a。Internal TestFlight 1.0 (1)は実機でOTP認証・Production AI教材生成まで成功、External group Mepamo friendsはBeta App Review待ちです。Production AIは現在enabledです。まず文書のCurrent Stateと未完了事項を短く要約し、矛盾があれば質問してください。その後、今回のscope: \[ここに1つだけ書く\] を進めます。Production変更・secret・Apple submit・不可逆操作は私の明示承認なしに行わないでください。」

### 15.5 次にこの文書を更新するタイミング

-   External TestFlight承認・友達QA開始時。

-   Build 2をDevへ統合・TestFlightへUploadした時。

-   実アカウント削除E2Eとcheck:operationsが完了した時。

-   App Store Submit直前 / 承認時。

-   Production app SHA、DB schema、主要provider、認証方式、AI gateなど大きな前提が変わった時。
