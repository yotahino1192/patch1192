# Mepamo — remaining owner inputs (2026-09-28)

Fetched `origin/Dev`: **0e69f2f5fb2d438d14e50a1c1f4f5914ac72a4d8**, matching approved Dev. This document supersedes earlier unconfigured-infrastructure status; historical QA records remain historical. No deployment, external setting or Production DB change is part of this checkpoint.

Confirmed by Yota: Mepamo / `https://mepamo.com`, Vercel `mepamo1192` with Production branch Dev and 13 Production-only variables, AI disabled, verified Clerk Production, migrated/validated Turso Production, initial encrypted backup and successful restore-check. [Evidence and limits](production-bootstrap-owner-evidence-20260928.md). Support/privacy/terms routes are `/support`, `/privacy`, `/terms`; their Production availability is not verified before deployment. Email OTP, Flashcards/MCQ and short Explain are the current scope. No Fill in the Blank, Advanced AI Tutor, Pro billing, sharing or video upload.

Validation for this checkpoint: [results and remaining gates](production-readiness-safe-config-validation-20260928.md).

## Classification of every missing field

**a** = confirmed fact; **b** = existing implementation/runbook; **c** = owner decision/verified information required; **d** = actual external operation/evidence required (not established by the supplied report). A c item can additionally need implementation; proposals below are not configuration. Do not fabricate opaque references just to pass validation.

Public fields live under `publicLegalConfig.fields` in `lib/public-pages/config.ts`:

| Exact field(s) | Class | Action / dependency |
| --- | --- | --- |
| `commercialTerms` | a | Filled: current Free v1 is free; no paid plan, purchase or recurring billing transaction. No future price/refund terms invented |
| `operatorName`, `legalAddress`, `contactEmail` | c | Actual publishing identity/address and monitored mailbox; domain ownership alone proves none of these |
| `serviceCountries`, `eligibility`, `effectiveDate` | c | Owner chooses audience, age and effective date; Japanese copy is not evidence of a Japan-only policy |
| `processingRegions` | c | Tokyo Turso placement confirmed and disclosed in body. All-provider processing/subprocessor/transfer explanation still needs actual contract/settings review; do not infer it from DB region |
| `retentionPolicy`, `backupRetention`, `deletionTiming` | c | Existing deletion behavior described; final durations and residual-record policy require approval and enforceable disposal/recovery operations (d) |
| `rightsProcedure`, `supportResponse` | c | Identity-verification procedure and actual staffed contact/response policy |
| `contentRights`, `liability`, `governingLaw`, `disputeResolution` | c | Approved terms; implementation cannot determine rights, liability or jurisdiction |
| `serviceChanges`, `revisionNotice` | c | Owner approves suspension/termination and change-notification rules |

19 originally missing → **1 filled / 18 remaining**. `publicationStatus` stays `draft`; noindex and missing-contact behavior remain. Brand, canonical Production URLs, current AI-disabled status and Free v1 factual descriptions are also updated (a/b); they are not substitutes for the remaining fields.

Operations fields are in `config/production-operations.json`:

| Exact field(s) | Class | Action / dependency |
| --- | --- | --- |
| `backup.restoreEvidenceRef` | a | Filled with `docs/production-bootstrap-owner-evidence-20260928.md`: owner-confirmed initial restore only |
| `backup.reconciliationPlanRef` | b | Filled with `docs/production-recovery-rehearsal.md`: existing fail-closed deletion/consent/AI reconciliation procedure, not a completed live cutover |
| `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.deliveryEvidenceRef` | d | Real collector/receiver and acknowledged synthetic alert; Vercel project/system env alone is insufficient |
| `monitoring.responderRef` | c | Named incident responder and escalation arrangement |
| `deletion.schedulerRef`, `deletion.completionEvidenceRef` | d | Actual authenticated POST scheduler plus controlled deletion/outage/closed-app completion evidence; empty DB/idle is not completion |
| `backup.storageRef`, `backup.keyCustodyRef` | d | Confirm/create offsite ciphertext+manifest storage and separate key custody, with retrieval test; initial local backup does not establish them |
| `backup.keyId` | c | Non-secret identifier of the **existing** backup encryption key, mapped in private custody; never generate a replacement key to fill this field |
| `backup.recoveryOwnerRef` | c | Actual recovery operator |
| `backup.intervalHours`, `backup.maxSuccessAgeHours`, `backup.retentionDays`, `backup.rpoHours`, `backup.rtoHours` | c | Approved schedule/age/retention/data-loss/recovery objectives; real automation and rehearsal required (d) |

17 originally missing → **2 filled / 15 remaining**. Existing b values retained: monitoring every 5 minutes / missing heartbeat 15 minutes / structured fields only; deletion every 60 seconds / missing heartbeat 5 minutes. These are configuration targets, **not installed schedules**. Root version/environment already correct.

## One owner questionnaire — reply by number

Recommendations are proposals for a small invited beta, not legal conclusions or promises already made. Public legal text needs owner approval before publication. Supply non-secret facts/references only; never send token, password or encryption-key values.

| # / exact fields | Plain-language decision | Options, minimum beta recommendation and consequence |
| --- | --- | --- |
| 1 — `operatorName`, `legalAddress`, `contactEmail`, `rightsProcedure`, `supportResponse` | 誰が運営し、どの公開住所・実在メールで相談を受け、本人確認と回答をどう行うか | **推奨：実際の運営主体＋既存の受信確認済み窓口を共用**。別案：専用窓口を開設。正式名称・公開する住所・メールを指定し、「メール受付、コードを受け取らず本人確認、平日確認・3営業日を一次回答目標（保証ではない）」案を承認または修正。窓口を定期確認できる担当者が必要 |
| 2 — `serviceCountries`, `eligibility`, `effectiveDate` | テスターの国・年齢と、この文書を有効にする日 | **推奨案：日本の招待済み18歳以上だけ、初回利用開始日を施行日**。別案：他国／未成年を含める（対象を指定して条件を追加確認）。対象を絞るなら招待・配布運用も合わせる。日付を自動で今日にはしない |
| 3 — `processingRegions` | 各事業者でデータが処理され得る国・地域、国外処理の説明 | **推奨：現在の契約・設定を確認して実態を記載**。別案：地域制限が必要なら設定／契約変更を別途検討。東京DBだけで国内完結とは書けない。Clerk/Vercel/OpenAI/Tursoの非秘密の地域・再委託先情報の確認担当を指定（秘密値不要） |
| 4 — `retentionPolicy`, `backupRetention`, `deletionTiming`; `backup.intervalHours`, `backup.maxSuccessAgeHours`, `backup.retentionDays`, `backup.rpoHours`, `backup.rtoHours` | 何をいつまで残すか、削除完了目標、失ってよい時間幅と復旧目標 | **推奨：有限の期間を決め、期限消去・復旧手順を検証してから約束する**。別案：期間確定まで利用開始を保留。たたき台はバックアップ12時間毎／成功から24時間で警報／7日保持／RPO24時間／RTO48時間、削除一次対応1営業日（完了保証ではない）。通常学習データ、AI再送結果、同意証跡、削除tombstone・費用記録、運用ログそれぞれの期間とバックアップ削除反映期限は別途指定。残存記録の一律期限消去は現行実装にないため、期間選択後に安全な消去設計が必要。バックアップ7日だけで削除完了を保証しない |
| 5 — `contentRights`, `liability`, `governingLaw`, `disputeResolution` | 教材の権利・サービス利用に必要な許諾、責任の範囲、適用法・紛争窓口 | **推奨：権利移転なし・提供に必要な処理だけ許諾する最小案を、実際の運営主体に合わせてレビュー**。別案：既存の承認済み規約を指定。準拠法・裁判所・責任上限は推測しない。承認文面かレビュー担当を指定し、確定まではdraftを維持 |
| 6 — `serviceChanges`, `revisionNotice` | 変更・停止・終了と重要な規約変更をどう知らせるか | **推奨：公開ページ更新＋招待テスターへの重要変更の個別連絡**。別案：アプリ内告知を追加（追加実装が必要）。通常変更は事前通知、緊急停止は事後通知の案を承認／修正し、通常時の予告期間を指定。現行コードに一斉通知機能があるとは扱わない |
| 7 — `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.responderRef`, `monitoring.deliveryEvidenceRef`; `backup.recoveryOwnerRef` | どこで監視し、誰に通知し、誰が事故対応・復元するか | **推奨：既存の監視・通知先を使い、主担当1名と不在時の連絡先を明記**。別案：新規の運用基盤（費用・権限承認後）。実在サービス・受信先の非秘密の参照名と担当を指定。合成アラートを実際に受信確認してから証跡欄を埋める。自分のMacを開いている間だけの監視は不可 |
| 8 — `deletion.schedulerRef`, `deletion.completionEvidenceRef` | アプリを閉じても削除を進める定期実行をどこで動かすか | **推奨：既存の常時稼働runnerで認証付きPOSTを60秒毎**。別案：新規runnerを別途承認。Node22・秘密の安全な注入・heartbeat監視が必要。GETだけのcronでは代替不可。初回デプロイ前に準備できるが、実APIでの完了証跡はデプロイ後の限定アカウント検証が必要 |
| 9 — `backup.storageRef`, `backup.keyCustodyRef`, `backup.keyId` | 暗号化ファイルをどこに置き、鍵を別のどこで保管・回収するか | **推奨：既存のアクセス制限付きoffsite保管＋別の鍵保管先**。別案：新規保管サービス（承認後）。初回バックアップの保管先／鍵管理が既に満たすなら、その非秘密の参照名・既存key IDだけを指定。暗号文とmanifestを取得し、その鍵で復元できることを確認。鍵そのものは回答しない |

## External work still required (not performed here)

1. **Deletion runner:** always-on scheduler, service identity, Node 22/reviewed checkout, protected environment injection, 60-second POST, structured outcome capture, 5-minute missing-heartbeat alert. Stage controlled completion/retry/outage/lease testing; after authorized deployment verify a disposable Production account with app closed. Do not invoke the worker during build or against an unreviewed queue.
2. **Monitoring:** collector with allowlisted structured fields and separate runner/API source labels; protected receiver, responder/escalation, acknowledged synthetic delivery; API/readiness and failure thresholds from [operations](production-operations-readiness.md). Schedule guarded read-only `ops:status` every 5 minutes with a 15-minute missing-success alert. A DB bootstrap showing zero counts is not monitoring. Secure runner credential custody is additional to Vercel's 13 app variables.
3. **Backup/custody:** owner-approved periodic backup job, restricted offsite ciphertext **and manifest**, separate existing-key custody, restore/retrieval proof, retention/expiry/deletion replay process, failure/stale-backup alerts and a recovery operator. Approve objectives before enabling schedules. Initial backup + RESTORE_VALID do not prove these services.
4. **Recovery:** retain post-snapshot deletion/consent/AI evidence securely; prepare/review provider-specific isolated replacement import and cutover, key recovery and measured end-to-end recovery rehearsal. Existing restore-check intentionally removes scratch; it is not a replacement DB deployment tool. No new paid resource is inherently mandated; existing suitable infrastructure can be used after confirmation.
5. **Public operations:** verify the actual contact mailbox and response routine, determine provider processing regions, approve retention/terms and implement any newly promised expiry/notification behavior. The repository cannot establish these facts by inserting text.

`check:operations` validates references/numeric relationships only; it cannot verify a provider. Required ordering is `intervalHours <= maxSuccessAgeHours <= rpoHours` and `retentionDays * 24 >= intervalHours`; all values must be positive, ciphertext and key custody references distinct. Reference values must be non-secret opaque IDs or repository paths. Passing with invented references is not acceptance.

**Deployment/evidence dependency:** live deletion completion, API heartbeat and real readiness require a deployed backend. Configure runners/receivers and verify synthetic delivery beforehand, keep schedules disabled until the intended target exists, then request an explicitly scoped first deployment/controlled validation step. Do not claim `check:operations` is fully satisfied before these results exist; this checkpoint does not change guards or authorize deployment. This dependency needs an explicit phased release decision, not a fake `completionEvidenceRef`.

Remaining broader TestFlight gates: exact-candidate physical-device QA, signing/archive/App Store Connect and review metadata. They are not reasons to block integration of this honest partial configuration checkpoint; they still block the corresponding release phase. Do not add deferred product features to those gates.
