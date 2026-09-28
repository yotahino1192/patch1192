# Mepamo — owner decisions and remaining release gates (2026-09-29)

This record supersedes the 2026-09-28 unanswered questionnaire. Sections 1–9 have now been answered in this readiness session. No additional owner choice is needed to record this checkpoint. **Public address and the exact effective date remain intentionally deferred**, and operational evidence must come from actual setup/tests. This is a partial readiness checkpoint, not publication or deployment approval.

Approved Dev baseline: `0e69f2f5fb2d438d14e50a1c1f4f5914ac72a4d8`. Working branch: `codex/testflight-production-readiness`, following `a0978c1`. This checkpoint does not fetch/push/merge or independently re-attest current remote/service state. [Initial bootstrap report](production-bootstrap-owner-evidence-20260928.md) remains historical owner evidence. [Validation](production-owner-decisions-validation-20260929.md).

## 1. 運営者・住所・問い合わせ窓口・本人確認・回答目安

- `operatorName`: 日野 陽太.
- `legalAddress`: intentionally null; owner will decide a publishable address before final publication.
- `contactEmail`: support@mepamo.com; owner confirmed inbound delivery through Cloudflare Email Routing. Outbound sending from this address is **not** configured/verified.
- `rightsProcedure`: data access/deletion inquiries by email; normal deletion via the app's verified flow; never accept authentication codes/passwords by email; individual verification when login is unavailable.
- `supportResponse`: weekday review, initial reply target within 3 business days, no resolution deadline guarantee. Operator: 日野 陽太.

## 2. 配信対象・年齢・施行日

- `serviceCountries`: Japan only. `eligibility`: invited adults aged 18 or over. Apply this in invitation/distribution operations; this copy does not implement an age/geolocation gate.
- `effectiveDate`: first tester use date; exact calendar date intentionally null, not today's date.

## 3. 処理地域

- `processingRegions`: approved actual-configuration disclosure in `lib/public-pages/config.ts`.
- Turso Production DB stays Tokyo / AWS ap-northeast-1. Owner confirmed Vercel Functions Washington, D.C., USA / us-east-1 / iad1, and OpenAI Project Residency Global; no verified special regional contract/settings.
- Clerk's US authentication infrastructure and possible overseas processing by providers/support/subprocessors are disclosed; Tokyo DB does not imply Japan-only processing. Provider public-information review was completed during the Section 3 discussion. No contract/region/plan was changed.
- Production AI remains disabled. Future use requires controlled validation, explicit enablement and required user consent; no inference of Japanese OpenAI processing.

## 4. 保持・削除・バックアップ目標

- `retentionPolicy`: approved condition-based policy. Account/profile and learning data are removed by account deletion; ordinary card deletion can be soft deletion. AI result expiry is not a guarantee of immediate physical erasure. AI request/idempotency/budget records have no universal automatic expiry. Consent withdrawal does not itself purge consent events; account deletion removes those events. Minimal deletion tombstones/identity hashes and AI accounting records remain without a fixed implemented expiry; these are not anonymous data. Log retention depends on storage/provider configuration and is not a guaranteed universal TTL.
- `backupRetention`: 7-day retention policy **to implement/verify**, including expired artifact disposal and deletion-record reconciliation before recovery. No claim of existing automatic expiry.
- `deletionTiming`: first response target within 1 business day; actual completion target remains dependent on Production deletion testing, not a guessed number.
- Approved `backup.intervalHours=12`, `maxSuccessAgeHours=24`, `retentionDays=7`, `rpoHours=24`, `rtoHours=48`. These are operating targets, not demonstrated guarantees or installed schedules.

## 5. 権利・責任・準拠法・紛争

- `contentRights`: user retains existing content rights; permission limited to storage/display/processing/service delivery, including AI provider transfer only with required consent; user must hold required rights/permissions; no exclusive or complete AI-output IP guarantee.
- `liability`: AI can be wrong; no accuracy/exam/grade/learning-outcome guarantee; beta downtime/bugs/data loss possible; applicable non-excludable liability preserved; no blanket disclaimer and **no contractual monetary liability cap**.
- `governingLaw`: Japanese law.
- `disputeResolution`: good-faith discussion via support@mepamo.com, then statutory jurisdiction; no exclusive court.

## 6. サービス変更・規約改定通知

- `serviceChanges`: reasonably possible advance notice for material changes/planned suspension/termination; reasonably prompt later notice for emergencies/security/outages/legal requirements preventing advance notice; no fixed 14/30-day service-change deadline or fixed notice for ordinary minor beta iteration.
- `revisionNotice`: update public Terms/Privacy; material changes affecting invited testers get individual email, normally at least 14 days before effect; legally required/emergency exceptions with prompt reasonable notice; renewed consent where needed, including materially changed AI data sharing.
- Existing sending mailbox, manual messages, display name **Mepamo**. Do not assume support@mepamo.com is a working From address. Optional Reply-To only if supported. Before beta, test actual outbound delivery and maintain the private invited-tester recipient list; no new paid mail infrastructure required.

## 7. 監視・通知・対応担当

- Approved UptimeRobot Free, configured **after first Production deployment**: Keyword Health `https://mepamo.com/api/health`, expected `"status":"ok"`; Keyword Readiness `https://mepamo.com/api/ready`, expected `"status":"ready"`; both every 5 minutes.
- Existing frequently checked private email for alerts; address stays outside public pages/repository. `monitoring.destinationRef` remains blank until actual routing is configured/documented privately.
- `monitoring.responderRef` and `backup.recoveryOwnerRef`: `owners/yota-hino` maps to Yota Hino / 日野 陽太. Single operator; response may be delayed during absence. No 24/7 or immediate-response promise, no invented alternate responder.
- `monitoring.providerRef` and `monitoring.deliveryEvidenceRef` remain blank: service selection alone is not installed collection or acknowledged synthetic alert delivery. UptimeRobot's two URL checks do not cover aggregate operations, worker heartbeat, structured failure thresholds or backup age.

## 8. 削除scheduler

**Approved architecture, not implemented/configured:** Cloudflare Workers Free + Cron Triggers, with Healthchecks.io Free for independent heartbeat/missed-run/failure monitoring. Target approximately every minute, independent of the owner's Mac.

Preserve the existing POST-only `/api/internal/account-deletions` and Bearer authentication using `ACCOUNT_DELETION_WORKER_SECRET`. Only the scheduler's protected Secret binding receives that credential; no Turso credentials, no secret in URLs/logs/code/monitoring payloads. Preserve Production confirmation/allowlist, redirect rejection, 55-second caller timeout, server duration/retry/backoff/lease behavior and closed `idle/completed/retry/failed` outcomes. HTTP 200 with `retry` is not successful deletion completion. Do not add automatic immediate retries around the current worker.

A reviewed Workers adapter is still needed; the Node 22 CLI/runbook cannot simply be assumed to run unchanged in Workers. Verify equivalent safety and mock outcome/timeout/redirect tests, then Free CPU limits in the hosted environment. Cloudflare's network wait is separate from CPU time; Free suitability must be measured. No paid upgrade is authorized.

Healthchecks must distinguish scheduler liveness from deletion outcome: runner-only outcome reporting, missed heartbeat threshold 5 minutes, failure visibility and recovery notifications. Do not let a later idle tick erase evidence of a retry/backlog. Preserve the runbook's repeated-retry and queue-age checks through structured monitoring/`ops:status`; success ping alone is insufficient. Protect heartbeat identifiers separately and send no account/content/worker-secret data. Test synthetic failure, missed-run and recovery emails before live evidence is claimed.

`deletion.schedulerRef` stays blank until a real scheduler exists. `deletion.completionEvidenceRef` stays blank until an approved test account completes deletion through the deployed Production API, including app-closed and interruption/retry checks. Empty queue/idle and bootstrap validation are not completion evidence.

Official implementation references reviewed during Section 8: [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [limits](https://developers.cloudflare.com/workers/platform/limits/), [Healthchecks signals](https://healthchecks.io/docs/http_api/), [missed-run settings](https://healthchecks.io/docs/configuring_checks/). Vercel Cron GET and Hobby cadence do not directly satisfy this POST/every-minute contract.

## 9. 暗号化バックアップ保管・鍵custody

Owner-confirmed on 2026-09-29; no private files, keychain or cloud account were accessed for this checkpoint:

| Config field / non-secret reference | Actual owner-confirmed meaning |
| --- | --- |
| `backup.storageRef = backup/icloud/mepamo-production-backups` | Existing private iCloud Drive location **Mepamo Production Backups**; initial encrypted Production backup folder manually copied successfully. Accepted as the initial off-device/off-Mac copy |
| `backup.keyCustodyRef = backup/macos-passwords/mepamo-production-backup-key-v1` | Existing key stored separately in macOS Passwords; management label **Mepamo Production Backup Key v1** |
| `backup.keyId = mepamo-production-v1` | Owner read this identifier directly from the existing initial `manifest.json`; it is not a new key or guessed default |

References are management labels mapped here, not private paths, share links or credentials. The validator requires ASCII references without spaces, so the confirmed human-readable names remain in this mapping. No key was requested, read, rotated or replaced.

Initial restore-check evidence is still the original owner report. The later iCloud copy does not prove a restore from a newly downloaded offsite copy, independent key recovery after Mac loss, recurring offsite transfer, expiry automation, or measured RPO/RTO. Verify ciphertext **and manifest** retrieval and existing-key recovery without copying keys into artifacts/logs/repository. Cloud sync alone is not immutable backup; protect against accidental propagated deletion and keep the last usable copy until recovery is assured.

## Concrete gates still open

1. **Public finalization:** owner supplies publishable `legalAddress` and first-tester `effectiveDate`; finalize the public document only afterward. Current configuration stays `draft` and noindex. Final deletion completion target follows actual Production flow verification. Log retention and backup disposal wording must stay aligned with actual storage settings/implementation.
2. **External monitoring:** create/configure UptimeRobot and Healthchecks only in an authorized step; verify real alert receipt, failure/recovery/missing-heartbeat behavior. Establish reviewed structured-event collection and read-only `ops:status` every 5 minutes with 15-minute missing-success alert. Keep DB credentials out of the deletion scheduler; any separate DB-status runner has separate custody/target guards.
3. **Deletion runner:** implement/review/test Workers adapter, then separately create Worker/Secrets/Cron/heartbeat wiring; preserve all existing API guards. Keep actual completion evidence pending for controlled post-deployment testing.
4. **Recurring backup and recovery:** externally hosted 12-hour backup execution and offsite transfer, 24-hour stale/failure alerts, 7-day expiry and deletion/consent/AI reconciliation; verify offsite download plus separately recovered existing key, and measure recovery against 24-hour RPO/48-hour RTO. No recurring automation or independent retrieval was proven by the initial manual copy.
5. **Notice delivery:** test the existing outbound mailbox with display name Mepamo; keep recipients private. support@mepamo.com is inbound-only unless separately verified.

`check:operations` intentionally remains blocked on exactly five fields: `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.deliveryEvidenceRef`, `deletion.schedulerRef`, `deletion.completionEvidenceRef`. No placeholder references or relaxed validation are used to make the command pass. All other references/numeric targets are supplied and mapped above; passing syntax alone would not prove live services.

**Phased release dependency:** live deletion/health/readiness require a deployed API, while full handoff requires their evidence. Prepare and test adapters/receivers synthetically first, then use a separately scoped first-deployment/controlled-verification decision; never fabricate evidence or bypass guards. UptimeRobot setup is explicitly scheduled after that first deployment. This checkpoint authorizes none of those external actions.

The recorded owner decisions are ready for repository review/integration after checks, even while final publication/operational acceptance remains blocked. Existing physical-device QA, archive/signing/App Store Connect gates remain separate; no native configuration changes are included.
