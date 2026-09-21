# Production / TestFlight operations readiness

Current scope and integration status: [Free v1 release scope](free-v1-release-scope.md). Its full deferred list applies to QA, screenshots, metadata and blockers. Short topic input remains an unresolved CLI3 contract at Dev `d9e304f`; older baseline/test observations below are historical, not proof of that feature or current production readiness.

Original operations baseline: Dev `716d298d8361d217eb1c16ec898a1958861a91bc`. Current integration baseline: Dev `d9e304f980711f7c9859b156b89efce4d36cd063`, which already includes CLI2 operations and CLI1 UI. This follow-up updates release documentation only; no live service, production DB, scheduler, Apple or deployment action is included. See [validation record](production-operations-validation.md) for historical executed checks and [owner inputs](release-owner-inputs.md) for unresolved values.

## Configuration contract

Current Free v1 / TestFlight scope: Topic/Text/PDF input; **Flashcards and Multiple Choice only**; History/Review; Streak/Retention. Fill in the Blank is future work, with no implementation or preparation in this release task, and **not a TestFlight or App Store blocker**. Operational readiness requirements otherwise remain unchanged.

**CODE COMPLETE:** explicit `PATCH_ENV` identity; exact per-environment public allowlists; server/mobile separation; production live Clerk key/issuer matching; remote Turso allowlist and token shape; models allowlist; bypass/debug/secret-leak rejection; offline web/mobile/native artifact gates. Added required worker secret in **staging and production**: independently generated random 32–256 base64url/hex characters, no whitespace/known placeholders/repeated single character. This is a shape check, not entropy or provider authentication proof. Development and mobile public validation do not require server secrets.

**EXTERNAL CONFIGURATION REQUIRED:** policy is intentionally empty. Do not enter example domains or fake keys to pass release checks. Server validation now blocks any staging/production build or DB CLI missing the worker secret; provision it in the build/server environment before integrating this branch. No version/build, mobile config, schema, UI or learning semantics changed.

Manual sequence, after separate service-operation authorization:

1. Choose production API/web DNS and Clerk production instance. Verify domain ownership, DNS, mail delivery, email OTP sign-in/sign-up and fresh deletion reverification. Confirm social connections disabled for the initial email-only scope; Apple-linked deletion remains blocked without token revocation implementation.
2. Choose a distinct production Turso database and record its exact URL and stable `databaseId`. Staging must use distinct DB, Clerk instance and credentials; compare the reviewed policy entries explicitly (the validator does not prove account isolation). Approve regions separately. Never point local/CI tests at production.
3. Review `config/release-policy.json`: API origins, web origins, Clerk issuers, database URLs/ID and allowed models for each environment. Supply `PATCH_API_ORIGIN`, `VERCEL_PROJECT_PRODUCTION_URL`, `AUTH_ALLOWED_ORIGINS` without paths/trailing slash/wildcards, and matching `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER`.
4. Through the chosen secret manager inject server-only `CLERK_SECRET_KEY`, `TURSO_AUTH_TOKEN`, `OPENAI_API_KEY`, `ACCOUNT_DELETION_WORKER_SECRET`; set `TURSO_DATABASE_URL`, both `OPENAI_*_MODEL` and explicit `AI_ENABLED`. Do not set `CLERK_JWT_KEY` for release. Generate the worker key outside Git and share it only with its runner; rotate both together. No shell tracing or secrets in commands/logs/issues. Rotate/revoke on exposure. Backup key/ID belong only to backup/recovery operators, not mobile.
5. Mobile receives only `PATCH_ENV`, `PATCH_API_URL`, `PATCH_CLERK_PUBLISHABLE_KEY`, `PATCH_CLERK_ISSUER`; same production API and Clerk instance as server. Never copy the server environment into mobile.
6. On the reviewed final commit run Node 22 `npm run check:env`, web build, `npm run ios:sync`, `npm run check:release` and archive validation in the TestFlight runbook. Keep environment identity explicit and DEBUG/test bypasses absent. These commands do not prove credentials work, migrations are applied or services have been deployed.
7. Separately authorize schema/provider setup and staging → production smoke tests; verify mail, consent, one AI generation, deletion through completion, monitoring delivery, restore evidence and rollback ownership before beta.

## Deletion runner

**CODE COMPLETE:** `npm run ops:deletion-worker -- --execute --confirm-env staging|production` performs one POST to the exact allowlisted API, with bearer secret from environment, redirects forbidden and a 55-second timeout. No automatic HTTP retry. `config/deletion-worker.crontab.example` is entirely commented, never installed by build/deploy. `vercel.json` is unchanged. The runner needs Node 22, this reviewed checkout/dependencies, environment and secret-manager integration; it does not need DB credentials. Do not put `--execute` in CI validation.

**EXTERNAL CONFIGURATION REQUIRED:** choose an always-on scheduler, runner service identity, owner, log sink and alert receiver. Proposed initial cadence: once a minute, independent of user app lifetime. One call handles at most one job: nominal capacity ≤60/hour, so watch queue age and increase scheduled capacity only after load/lease review. Do not use a browser, app background task or generic GET-only cron against this POST endpoint. The local template is preparation, not an enabled production schedule.

Existing authoritative behavior remains: persistent jobs; immediate lifecycle/tombstone fence; 120-second transaction-acquired lease; idempotent DB scrub and Clerk removal (404 accepted); failure becomes retry with exponential delay starting ~60 seconds, doubling to six-hour cap plus <10-second jitter. Interrupted callers leave a lease recoverable by a later tick. HTTP 200 can carry `state=retry`; runner emits retry and exits 1 so scheduling/monitoring must inspect outcome, not just HTTP status. Do not replay a timed-out request immediately; let the next scheduled tick obey the DB lease/backoff.

Completion means job `completed`, Clerk removed, `users.lifecycle_state=deleted`, auth identity removed, private rows scrubbed, and intentional tombstone/accounting records retained. Apple-linked accounts require real revocation integration and remain retrying; never mark completed manually to hide this blocker. Test app closure, runner outage/recovery, repeated calls, lease expiry and provider outage in staging with disposable accounts before enabling production.

## Monitoring and alerts

**CODE COMPLETE:** existing API structured failures now include 401/403 as well as 5xx, with status/duration/random request ID only. Readiness DB failure emits `operation/database_check/failed`. Deletion route emits `idle/completed/retry/failed`; migration, backup, restore-check and DB validation commands emit named `operation` outcomes. Existing AI `ai_denied`, `ai_unknown`, `ai_complete` remain authoritative. New records contain no user IDs, URLs, material, prompts, responses, emails or credentials; no token values are introduced. Existing AI usage counters are numeric accounting metadata, not token strings.

`npm run ops:status` uses existing guarded DB targeting and schema validation, **read-only** aggregates: unresolved/unknown AI, expired dispatch/reservation leases, oldest age; pending/retry/due deletion, oldest age, Apple blockers. It does not expire reservations, retry AI, release cost or change jobs. Includes expired dispatch markers even without new traffic. Exit 1 for unknown/expired AI, Apple blockers or deletion age >1 hour; DB failure also exits 1. Aggregate scans should initially run every five minutes; measure production cost before expanding frequency. Monitor absence of records too.

**EXTERNAL CONFIGURATION REQUIRED:** select log/alert provider, access/retention policy, responder and escalation channel. Ingest only reviewed structured fields. Disable automatic request bodies, headers, query strings, session replay and error-body capture; never forward raw stdout wholesale from provider SDKs. Existing CLI error codes are supplemental; alerts should match the closed `operation` records. Avoid public dashboards of aggregate counts. Initial engineering thresholds below are provisional, not legal/service promises:

| Signal | Initial rule | Response |
| --- | --- | --- |
| API 5xx | ≥5 in 5 min or readiness fails twice | Investigate service/DB availability; stop rollout |
| Auth 401/403 | ≥20 in 5 min or >3× established baseline | Check Clerk key/issuer/session rollout; never bypass auth |
| AI failures | ≥5 denied in 5 min; any unknown | Check quota/provider/DB; review unknown before any resolution |
| AI unresolved | Any unknown, expired dispatch or expired reservation | Run guarded status; follow safe resolution below |
| DB | Any database_check failed / ops query failed | Check connection/schema/service status, no automatic migrate |
| Deletion | Retry repeating on 3 ticks; age >1h; any Apple blocker | Owner investigates provider/backlog; no lifecycle bypass |
| Worker heartbeat | No runner outcome for >5 min | Scheduler/secret/service incident, even with empty queue |
| Migration | Any migration failed | Stop release; inspect safe migration state, no blind rerun |
| Backup | Any backup failed OR no success within approved interval | Check custody/storage/permissions; do not delete last good copy |
| Restore | Any restore_check failed or overdue rehearsal | Block release/recovery cutover until investigated |

Use `/api/health` for process availability and `/api/ready` for bounded DB readiness; a green health endpoint alone is insufficient. Raw DB errors from individual operations may be indistinguishable from generic API/AI failure by design; correlate time with readiness/provider health, without adding SQL/parameters to logs. Validate notification delivery with synthetic events first; no provider or alert channel has been configured here.

## AI unknown operational audit

On Dev baseline, `unknown` and expired `dispatching` never return to reserved or automatically dispatch again. They retain concurrency and maximum cost reservations. Reusing the key returns unknown/in-progress; a new key can still be blocked by the owner's active operation. Cancel of already dispatched work also retains reservation until reconciliation. Unknown is intentionally capable of blocking further generation.

Add Material fix `ab8192cc72318cb7f5c44ca6cf109a7020a804f4` is now included in Dev `d9e304f` through CLI1 integration. It adds previous-unresolved diagnostics and a **file-DB development-only** `resolve-local-unknown` command with owner/stopped-worker/uncertain-outcome acknowledgements. It retains max cost; production still requires provider-final evidence. This CLI2 update preserves that implementation unchanged. The earlier Dev `716d298` audit predates its integration; no active feature branch is modified here.

Safe operator procedure on baseline (future remote actions require separate authorization):

1. Use `npm run ai:control -- status` and `npm run ops:status` with explicit remote target flags from the recovery guide. Stop new admissions with `ai:control -- stop` if an incident is growing; environment `AI_ENABLED=false` is another fence. Stopping does not cancel already dispatched requests.
2. Identify the internal request UUID using restricted, read-only DB inspection selecting only `id,state,lease_until,cost_micros` for affected operations. Do not dump results, key/payload hashes, owners or material into logs. Baseline status intentionally emits aggregates, so this identification remains an operator step.
3. Wait until the dispatch lease is expired AND verify provider processing is final and the original worker cannot still finalize. An expired lease/timeout alone is **not** evidence of no side effect. If finality cannot be established, leave unknown and escalate; never delete the ledger, zero cost or issue a new key as a workaround.
4. Only with evidence: `npm run ai:control -- resolve-final --request "$REQUEST_ID" --confirm-provider-final --retain-maximum-cost` plus remote/maintenance target flags. This changes one expired unknown/dispatching row to failed_final, releases concurrency, retains charged maximum and terminal idempotency history; it does not regenerate or import results. Keep a restricted approval/evidence record outside general logs.
5. `ai:control -- resume --confirm-reviewed` refuses while any reserved/dispatching/unknown remains. Review budget/provider readiness, then separately resume. User self-service unknown abandonment is not required for Free v1 and is not added here.

## Backup / restore workflow

**CODE COMPLETE:** existing snapshot pins a read transaction; AES-256-GCM, random IV, authenticated manifest, byte/content hashes, version/migration/schema checksums, row counts and rowids. Files are exclusive-created with 0600 mode in 0700 directory. `restore-check` reconstructs in a temporary local DB, validates exact rows, FKs/schema/integrity and deletes scratch in `finally`. Manifest contains metadata/counts (not encrypted); protect it with the ciphertext. Wrong key/tampering fail closed.

Repeatable **isolated local** rehearsal: `PATCH_ENV=development npm run db:rehearse-local`. It creates synthetic in-memory data, a real encrypted temporary backup, restores to a temporary file DB and invokes real application readers/review/session/undo functions. It verifies AI idempotency, consent evidence, tombstone blocking, pending deletion completion using mocked provider, another user's isolation, late-write fences, wrong-key and tamper rejection. Random key never leaves process; all artifacts are removed. This is recovery logic validation, not real Clerk/Turso recovery or measured production RTO.

**EXTERNAL CONFIGURATION REQUIRED:** Yota approves backup frequency/retention, offsite storage, key custody/rotation/recovery, deletion replay retention, RPO/RTO, operator and restore drill date. Production-sized performance, key recovery, offsite copy and failure alerts remain untested. See [production recovery rehearsal](production-recovery-rehearsal.md) for exact guarded future steps. Restoring an old snapshot can resurrect deleted accounts/material or AI eligibility unless subsequent deletion/tombstone and AI reconciliation evidence is applied before traffic. Never cut over straight from restore-check.
