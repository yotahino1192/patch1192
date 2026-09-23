# Production configuration contract — 2026-09-21

Entry point: [master runbook](testflight-go-live-runbook.md). All values below are **YOTA INPUT REQUIRED** or must be obtained from the chosen service. Empty policy/operations fields are intentional release blockers. No Production service is configured by these files. Never substitute synthetic test values into real policy or build environments.

## Reviewed public policy and variable names

2026-09-23 guard update: Vercel `VERCEL_ENV=production` requires `PATCH_ENV=production`; `VERCEL_ENV=preview` requires isolated `PATCH_ENV=staging`. Enable Vercel System Environment Variables; do not override this provider identity. Set `NODE_ENV=production` before invoking local Production npm commands so root pre/postbuild CLI scripts load the Production env files too. Public mobile values belong only in `mobile/.env.production.local`. See the [current Japanese inventory](testflight-production-readiness-20260923.md) and secret-free [server](../config/production.env.example) / [mobile](../config/mobile-production.env.example) templates.

Edit `config/release-policy.json` on a reviewed candidate. `production.apiOrigins`, `webOrigins`, `clerkIssuers`, `databaseUrls`, `databaseId`, `models` must describe the actual services. Keep staging DB/Clerk instance/credentials distinct; compare actual service identities, not only display names (offline checks cannot prove account isolation).

| Location | Exact variable | Contract / source |
| --- | --- | --- |
| Server/build and deletion runner | `PATCH_ENV` | Explicit `production`; NODE_ENV is not deployment identity |
| Server/build and deletion runner | `PATCH_API_ORIGIN` | Canonical HTTPS origin in `production.apiOrigins`; no path, trailing slash, credentials, wildcard, literal IP or placeholder |
| Server/build | `VERCEL_PROJECT_PRODUCTION_URL` | Web **hostname**, no scheme/path; `https://` + hostname must be in `webOrigins` |
| Server/build | `AUTH_ALLOWED_ORIGINS` | Comma-separated exact HTTPS web origins, no spaces/trailing slash/wildcards; each must be allowlisted. Native Clerk tokens may omit azp; don't add `capacitor://localhost` to weaken hosted origin validation |
| Server/build | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER` | Actual live public key; decoded host must equal canonical HTTPS issuer in `clerkIssuers`; no `.clerk.accounts.dev` in Production |
| Server/build only | `CLERK_SECRET_KEY` | Live secret for the same instance; secret-manager injected; no `CLERK_JWT_KEY` release override |
| Server/build / guarded DB operator | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Exact allowlisted hosted `libsql://` or HTTPS URL and token; stable policy `databaseId` is required for confirmations. Verify actual scope/expiry with provider |
| Server/build only | `OPENAI_API_KEY`, `OPENAI_CARD_MODEL`, `OPENAI_CHAT_MODEL`, `AI_ENABLED` | Real key; both models in policy; explicit `true` or `false` required in hosted environments. False fences new dispatch; it does not cancel dispatched operations |
| Server/build and dedicated deletion runner | `ACCOUNT_DELETION_WORKER_SECRET` | Independent cryptographically random 32–256 base64url/hex characters, not a reused provider/backup credential. Server + runner rotate together; no secret in cron or argv |
| Mobile build only | `PATCH_ENV`, `PATCH_API_URL`, `PATCH_CLERK_PUBLISHABLE_KEY`, `PATCH_CLERK_ISSUER` | Public Production API/key/issuer matching server. Use `mobile/.env.production.local` or an isolated build environment; never copy server env into mobile |
| Backup/recovery operator only | `PATCH_BACKUP_KEY`, `PATCH_BACKUP_KEY_ID` | 32 random bytes encoded as exactly 64 hex characters and opaque key version; recover the original key for old backups. Key belongs in separate custody, never mobile/runtime/logs |

No provider login or key validity is established by syntax checks. No env values are printed by these commands:

```sh
npm run check:env
npm run check:schema
npm run scan:secrets
npm run build
npm run ios:sync
npm run check:release
npm run check:operations
```

Use Node 22 and actual Production build environment only after values are supplied. Builds and `check:release` are offline; do not add live probes to build hooks. `check:operations` validates the separate operational handoff below. Empty environment correctly fails. Changes to public values or commit SHA require rebuilding/resealing both artifacts. Do not disable Xcode Release checks.

## Protected CI mapping

`.github/workflows/ci.yml` → manual `release_candidate=true` → protected **production-validation** environment; no deploy step. Configure environment approvals/access before granting secrets. Never expose these to PR jobs.

- GitHub variables: `WEB_HOST` → `VERCEL_PROJECT_PRODUCTION_URL`; `PATCH_API_ORIGIN` → server/mobile origin; `CLERK_PUBLISHABLE_KEY` → web/mobile public key; `CLERK_ISSUER` → both issuers; `AUTH_ALLOWED_ORIGINS`; `TURSO_DATABASE_URL`; `AI_ENABLED` (`true` or `false`). Models remain reviewed `gpt-5-nano` in workflow/policy; change together if approved.
- GitHub secrets: `TURSO_VALIDATION_TOKEN` → `TURSO_AUTH_TOKEN`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, **`ACCOUNT_DELETION_WORKER_SECRET`**. A validation token should have minimum required scope; CI never executes remote DB commands.
- Runtime hosting needs its own environment injection; setting GitHub variables does not configure hosting. Backup keys stay with backup operators and are not required by this CI build.
- Production-validation also runs `check:operations`; complete the reviewed opaque references below before declaring a release candidate ready. Ordinary development CI remains runnable while they are blank.

## Operational handoff and alert destination path

`config/production-operations.json` is a disabled handoff record, not an SDK config, scheduler or service provisioner. `npm run check:operations` uses no credentials/network and reports missing/invalid **field names only**. No new monitoring webhook env variable is consumed by the app: configure the chosen platform log drain/collector and alert receiver outside the app. This avoids shipping provider secrets or coupling request success to alert delivery.

Use opaque record IDs (2–128 ASCII letters/digits plus `.`, `_`, `/`, `-`), never mailbox addresses, webhook URLs or tokens. The restricted operator registry maps each ID to actual provider/account/region, destination and access. Keep sensitive details there. Reference completeness is not proof of service health; a reviewer must inspect evidence and timestamps.

| JSON fields | Required external value/action |
| --- | --- |
| `monitoring.providerRef`, `destinationRef`, `responderRef` | Chosen log/alert account/project; actual channel/mailbox/on-call destination in provider UI; primary responder + escalation/backup in restricted registry |
| `monitoring.deliveryEvidenceRef` | Restricted record of test alert received and acknowledged, failure/recovery and missing-heartbeat tests, timestamp and responsible operator |
| `monitoring.statusIntervalMinutes`, `statusHeartbeatMinutes` | Initial 5-minute aggregate job, missing-heartbeat alert within 15 minutes; validator permits stricter limits |
| `monitoring.structuredFieldsOnly` | Must remain true; disable automatic raw request/response/exception capture |
| `deletion.schedulerRef`, `completionEvidenceRef` | Scheduler job/secret-store identity and disposable-account end-to-end completion plus outage/retry evidence |
| `deletion.intervalSeconds`, `heartbeatMinutes` | Initially 60 seconds / 5 minutes; one job per invocation; see capacity and retry rules in [operations](production-operations-readiness.md) |
| `backup.storageRef`, `keyCustodyRef`, `keyId`, `recoveryOwnerRef` | Encrypted offsite location/access/region, separate key vault/version, recovery operator and alternate custodian; app runtime cannot delete backups |
| `backup.intervalHours`, `maxSuccessAgeHours`, `retentionDays`, `rpoHours`, `rtoHours` | **YOTA DECISION REQUIRED**. No invented schedule/SLA. Positive finite values; interval ≤ maximum successful-backup age ≤ RPO, retention covers an interval. RTO must be measured; form validation cannot prove it |
| `backup.restoreEvidenceRef`, `reconciliationPlanRef` | Actual key retrieval/offsite copy/isolated restore timing/invariant evidence and reviewed deletion/consent/AI reconciliation plus provider-specific replacement/cutover plan |

## External setup procedure (future operator work)

1. Provision/review actual DNS, hosting project, separate Clerk/Turso instances, server secret manager and AI quota. Enable email OTP; leave social connections disabled for Free v1. Record actual regions/retention from provider settings. Configure hosting promotion protections; do not auto-promote Dev/main pushes.
2. Configure the selected log collector for **Production service and runner sources**. Parse only JSON events below; explicitly project allowlisted fields before transport. Drop unknown/non-JSON SDK logs, URL/query/body/headers, email/user IDs, study material, prompts and raw AI content. Keep access/retention owner approved. Never blindly forward stdout/stderr.
3. Label source in collector metadata: API, deletion runner, operations-status, migration, backup, restore. Endpoint and runner both emit `deletion_worker`; count heartbeat from **runner source only**, avoiding duplicate outcome counts. A startup/config failure may emit no application record: monitor process exit/scheduler failure/missing heartbeat too.
4. Configure the exact rules in [operations](production-operations-readiness.md), including missing records. Set actual receiver in provider UI; credential/webhook URL is stored there or in collector secret manager. Configure delivery failures/escalation; no app change is needed for a log-based provider.
5. Test synthetic closed-schema events using the provider's test/ingest facility in an isolated test stream, then a controlled staging failure/recovery. Verify receipt and acknowledgement, including heartbeat/backup-age alerts. Record evidence IDs without message contents or addresses in Git.
6. Install reviewed runner command/environment through the chosen scheduler only after authorization; initial templates remain commented. Provision guarded `ops:status` every five minutes using reviewed DB target credentials; it is read-only. Schedule encrypted backup + restore verification + offsite copy according to approved objectives. A CLI `backup/ok` means local snapshot creation, **not** offsite durability; record/monitor copy verification and the last usable backup separately.

Collector projection contract (all other keys dropped):

| Event | Fields to retain / rules use |
| --- | --- |
| `request_failed` | `event,status,durationMs` (status 401/403 or 5xx); optionally UUID `requestId` for restricted correlation |
| `api_failed`, `ai_denied`, `ai_unknown`, `ai_complete` | `event,endpoint,status,durationMs,costMicros,inputTokens,outputTokens` as numeric metadata/closed endpoint; alert on failure, not token content |
| `ai_diagnostic` | `event,reason,category,providerCode,status,providerStatus,durationMs,costMicros`; reasons/codes are closed vocabulary in `lib/ai/diagnostics.ts`. Drop keyHash/providerRequestId/IDs from general alert transport |
| `operation` | `event,operation,outcome`; vocabulary in `lib/operations.ts`; failure/retry plus job exit are actionable |
| `operations_status` | `event`; numeric `ai.{unresolved,unknown_count,expired_dispatches,expired_reservations,oldest_ms}` and `deletion.{pending,retry_count,due,apple_blocked,oldest_ms}` only |

Client diagnostic sink is currently no-op; these paths cover server/CLI operations, not an installed mobile crash service. No native crash provider/account is selected or required by invented scope.
