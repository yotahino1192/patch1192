# Production / TestFlight operations readiness

Current integration baseline: fetched `origin/Dev` **8ab9f4847c67c27e322c70366c834f40b2e6ce51** (2026-09-21), including Free v1 reliability fixes. See [integration validation](testflight-readiness-integration.md). Topic input and Free v1 learning/UI are integrated. See the [master go-live runbook](testflight-go-live-runbook.md) and [Free v1 scope](free-v1-release-scope.md); deferred features are not release blockers.

Current evidence: [2026-09-21 validation](release-readiness-validation-20260921.md). Configuration variable/CI mapping and external destination setup are maintained once in the [configuration contract](production-configuration-contract.md). This document owns worker/alert/recovery behavior; [master](testflight-go-live-runbook.md) owns release order.

## Configuration contract

`check:env` validates explicit deployment identity, canonical HTTPS/DNS origins, approved Clerk/Turso/models, provider credential format, independent worker secret and explicit hosted `AI_ENABLED`. `check:release` adds sealed artifact/secret/schema gates. `check:operations` separately validates reviewed operational references, schedules/objectives and evidence references; it does not authenticate a provider or prove those references are true. Empty checked-in values intentionally block readiness. See the [exact variable list](production-configuration-contract.md).

## Deletion runner

**CODE COMPLETE:** `npm run ops:deletion-worker -- --execute --confirm-env staging|production` performs one POST to the exact allowlisted API, with bearer secret from environment, redirects forbidden and a 55-second timeout. No automatic HTTP retry. `config/deletion-worker.crontab.example` is entirely commented, never installed by build/deploy. `vercel.json` is unchanged. The runner needs Node 22, this reviewed checkout/dependencies, environment and secret-manager integration; it does not need DB credentials. Do not put `--execute` in CI validation.

**EXTERNAL CONFIGURATION REQUIRED:** choose an always-on scheduler, runner service identity, owner, log sink and alert receiver. Proposed initial cadence: once a minute, independent of user app lifetime. One call handles at most one job: nominal capacity ≤60/hour, so watch queue age and increase scheduled capacity only after load/lease review. Do not use a browser, app background task or generic GET-only cron against this POST endpoint. The local template is preparation, not an enabled production schedule.

Existing authoritative behavior remains: persistent jobs; immediate lifecycle/tombstone fence; 120-second transaction-acquired lease; idempotent DB scrub and Clerk removal (404 accepted); failure becomes retry with exponential delay starting ~60 seconds, doubling to six-hour cap plus <10-second jitter. Interrupted callers leave a lease recoverable by a later tick. HTTP 200 can carry `state=retry`; runner emits retry and exits 1 so scheduling/monitoring must inspect outcome, not just HTTP status. Do not replay a timed-out request immediately; let the next scheduled tick obey the DB lease/backoff.

Completion means job `completed`, Clerk removed, `users.lifecycle_state=deleted`, auth identity removed, private rows scrubbed, and intentional tombstone/accounting records retained. Apple-linked accounts require real revocation integration and remain retrying; never mark completed manually to hide this blocker. Test app closure, runner outage/recovery, repeated calls, lease expiry and provider outage in staging with disposable accounts before enabling production.


### Safe manual verification (future authorized service work)

Local/mock coverage, no scheduler or provider contact:

```sh
PATCH_ENV=development node --test tests/infra-operations.test.mjs tests/privacy-lifecycle.test.mjs
```

Before enabling a schedule, on **staging** with reviewed public policy and securely injected runner variables:

1. Verify missing auth is rejected (does not enqueue or process a job):

   ```sh
   curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
     --request POST "$PATCH_API_ORIGIN/api/internal/account-deletions"
   ```

   Expected **401**. A redirect, 200 or any other result fails the check; do not forward a secret to investigate an unreviewed redirect.
2. With operator DB environment, run `npm run ops:status -- --allow-remote --confirm-db "$DB_ID"`. Review queue ownership/target; the worker chooses the oldest due job, not a supplied account. Use a staging queue containing only approved disposable accounts.
3. Request deletion through ordinary UI with fresh email reverification, save only restricted evidence, close app, then explicitly invoke:

   ```sh
   npm run ops:deletion-worker -- --execute --confirm-env staging
   ```

   **This mutates the selected queued account.** Exit 0 with `idle` means no eligible job, not proof of completion; `completed` needs the matching lifecycle/provider evidence. `retry` or failed exits 1. No body, receipt or secret is printed by this runner.
4. Verify completed receipt/lifecycle, Clerk removal, learning-row removal, stale JWT/late-write rejection and other-user isolation. Reinvoke only according to schedule/backoff. Repeat provider outage, runner outage, restart and lease expiry tests; restore provider and observe eventual completion without app running. Do not simulate outages by breaking Production credentials.
5. Record completion/outage evidence and enable staging scheduler. Confirm runner heartbeat while queue is empty. Only after separate Production authorization repeat controlled checks on reviewed Production queue and use `--confirm-env production` with `PATCH_ENV=production`.

Templates remain **disabled**: [deletion cron](../config/deletion-worker.crontab.example), [operations cron](../config/operations.crontab.example). Do not run worker commands during build/CI. The job needs Node 22, locked dependencies, reviewed checkout/policy, egress to API, a scheduler secret injection mechanism and structured collector source labels. Runner receives no DB/provider credentials.

## Monitoring and alerts

**CODE COMPLETE:** existing API structured failures now include 401/403 as well as 5xx, with status/duration/random request ID only. Readiness DB failure emits `operation/database_check/failed`. Deletion route emits `idle/completed/retry/failed`; migration, backup, restore-check and DB validation commands emit named `operation` outcomes. Existing AI `ai_denied`, `ai_unknown`, `ai_complete` remain authoritative. Operation records contain no user IDs, URLs, material, prompts, responses, emails or credentials; no token values are introduced. Existing AI usage counters are numeric accounting metadata, not token strings.

`npm run ops:status` uses existing guarded DB targeting and schema validation, **read-only** aggregates: unresolved/unknown AI, expired dispatch/reservation leases, oldest age; pending/retry/due deletion, oldest age, Apple blockers. It does not expire reservations, retry AI, release cost or change jobs. Includes expired dispatch markers even without new traffic. Exit 1 for unknown/expired AI, Apple blockers or deletion age >1 hour; DB failure also exits 1. Aggregate scans should initially run every five minutes; measure production cost before expanding frequency. Monitor absence of records too.

**EXTERNAL CONFIGURATION REQUIRED:** select log/alert provider, access/retention policy, responder and escalation channel. Ingest only reviewed structured fields. Disable automatic request bodies, headers, query strings, session replay and error-body capture; never forward raw stdout wholesale from provider SDKs. Existing CLI error codes are supplemental; alerts should match the closed `operation` records. Avoid public dashboards of aggregate counts. Initial engineering thresholds below are provisional, not legal/service promises:

| Signal | Initial rule | Response |
| --- | --- | --- |
| API 5xx | ≥5 in 5 min or readiness fails twice | Investigate service/DB availability; stop rollout |
| Auth 401/403 | ≥20 in 5 min or >3× established baseline | Check Clerk key/issuer/session rollout; never bypass auth |
| AI failures | ≥5 `ai_denied` in 5 min; any `ai_unknown`; classify with `ai_diagnostic` reason/category | Check quota/provider/DB; review unknown before any resolution |
| AI unresolved | Any unknown, expired dispatch or expired reservation | Run guarded status; follow safe resolution below |
| DB | Any database_check failed / ops query failed | Check connection/schema/service status, no automatic migrate |
| Deletion | Retry repeating on 3 ticks; age >1h; any Apple blocker | Owner investigates provider/backlog; no lifecycle bypass |
| Worker heartbeat | No runner-source outcome for >5 min (do not count duplicate API-source events) | Scheduler/secret/service incident, even with empty queue |
| Migration | Any migration failed | Stop release; inspect safe migration state, no blind rerun |
| Aggregate heartbeat | No successful operations-status snapshot for >15 min | Check read-only runner/credentials; DB silence must not appear healthy |
| Backup | Any backup failed OR no usable offsite-verified backup within approved `maxSuccessAgeHours` | Check custody/storage/permissions; do not delete last good copy |
| Restore | Any restore_check failed or overdue rehearsal | Block release/recovery cutover until investigated |

Use `/api/health` for process availability and `/api/ready` for bounded DB readiness; a green health endpoint alone is insufficient. Raw DB errors from individual operations may be indistinguishable from generic API/AI failure by design; correlate time with readiness/provider health, without adding SQL/parameters to logs. Validate notification delivery with synthetic events first; no provider or alert channel has been configured here. Follow the [collector projection/destination setup](production-configuration-contract.md); ignore unreviewed stdout, label runner/API sources and monitor scheduler/process failures as well as closed application events.

## AI unknown operational audit

On the current Dev, `unknown` and expired `dispatching` never return to reserved or automatically dispatch again. They retain concurrency and maximum cost reservations. Reusing the key returns unknown/in-progress; a new key can still be blocked by the owner's active operation. Cancel of already dispatched work also retains reservation until reconciliation. Unknown is intentionally capable of blocking further generation.

Current Dev includes previous-unresolved diagnostics and a **file-DB development-only** `resolve-local-unknown` command. Production still requires provider-final evidence and the guarded `resolve-final` operation; local abandonment is never a Production workaround. No learning/AI behavior is changed by this readiness pass.

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
