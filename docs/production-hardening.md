> Integration update: latest Dev `7f93af45ef22466d70b2bab9e27022dd49993366` is now merged into this implementation. Privacy migration 0008 is unchanged; the unapplied AI migration is 0009. Historical branch-conflict/untouched-file statements below describe the original implementation only. The integration contract is recorded at the end of this document.

# Production Backend Hardening

Implementation branch: `codex/production-hardening`, based on latest Dev `1e84fca44895061eebc06440e5d43f0c9fc2d251` (which includes Phase 2A `c774ed0863d8eb25cddc6db35022e6f124b6fb44`). No Dev merge or deployment is part of this change. This runbook extends [the infrastructure runbook](production-infrastructure.md).

## AI admission and billing

All authenticated `/api/ai/cards` and `/api/ai/chat` POSTs require `Idempotency-Key` (16–128 ASCII alphanumeric, `_` or `-`; UUID recommended). Identity comes exclusively from Clerk through the internal user UUID. There is no plan-upgrade input or public quota-setting endpoint: every account is Free.

| Scope | Cards | Chat |
|---|---:|---:|
| Free / rolling minute | 2 | 6 |
| Free / rolling hour | 5 | 30 |
| Free / rolling 24 hours | 10 | 60 |
| Free / rolling 31 days | 100 | 1000 |
| Global / rolling minute | 10 | 20 |
| Input token upper bound | 24,000 | 12,000 |
| Output tokens (including reasoning) | 6,000 | 1,800 |

Combined Free cost: $0.15 / rolling 24 hours, $1 / rolling 31 days; concurrency 1 across both endpoints. Global combined requests: 30/minute, 1,000/hour, 5,000/day; cost $1/hour, $5/day, $30/31 days. Global concurrency is 10. Rolling 31 days is deliberately more conservative than resetting on the first day of a calendar month. DB time defines admission windows; clients cannot supply time or entitlement.

A database write transaction first checks the existing key, then admits under all applicable global/user limits and records the maximum charge. Database write serialization is the distributed lock, not a process-local counter. SQLite local operations also serialize on each connection. The ledger indexes time, user/time, state and unique user/key. No transaction spans an OpenAI call. Failed reservation/dispatch DB access is fail-closed.

Model is pinned to `gpt-5-nano`, not client-selectable. Runtime rejects other model overrides even in development. Conservative standard pricing: input $0.05 / 1M tokens, output $0.40 / 1M, per [official model documentation](https://developers.openai.com/api/docs/models/gpt-5-nano), verified 2026-09-13. Cost uses integer micro-USD, rounded upward per request. Cached input is charged conservatively at the uncached rate. Maximum reservations: cards $0.0036, chat $0.00132. Actual reported input/output usage settles a success; absent usage retains the maximum. An unexpectedly larger successful charge stops AI in the DB. Review pricing before release and after provider pricing changes; app accounting is a conservative budget estimate, not a replacement for provider billing/invoice reconciliation, taxes or currency conversion.

Input limit counts the UTF-8 byte length of the complete serialized provider request plus a 512-token protocol allowance as a conservative token upper bound. It includes instructions, structured schema and all selected history; it can reject text below the nominal token limit, especially Japanese. It makes no paid token-count request and does not silently truncate to fit. Existing context selection (last 8 messages/source excerpt) remains. JSON requests have a 128 KiB transport limit. Output limits are imposed on the Responses request. `store:false`, 45-second timeout, redirects disabled and **zero retries**; no SDK retry policy or background resend is used.

## Idempotency and state transitions

The unique key is `(internal user UUID, SHA-256(Idempotency-Key))`; endpoint and canonical full submitted JSON form the payload fingerprint. Reordered object properties replay successfully. The same key on another endpoint or with different submitted fields returns 409. Another account cannot read the first account's result. Raw keys and inputs are not stored in the ledger. Successful result JSON is stored for replay and must be protected like ordinary user content; it is not logged.

- `reserved`: maximum costs/count/concurrency admitted, dispatch lease 30 seconds.
- `dispatching`: committed immediately before the single network send, lease 120 seconds. A late reserved worker cannot dispatch after expiry.
- `succeeded`: response and actual usage committed. Chat's two history rows and success/result commit in the **same transaction** with an ownership recheck.
- `failed_pre_dispatch`: no provider send; cost released, count retained, same key remains terminal.
- `failed_final`: known provider rejection (including 429 and completed non-success response); maximum charge retained conservatively, concurrency released. Same key cannot dispatch again.
- `unknown`: network/45-second timeout, HTTP 408/5xx, unreadable provider response, or uncertain local persistence after sending. Maximum charge and concurrency stay reserved. Expired dispatching records are never automatically replayed or refunded.
- `expired`: successful replay payload older than 24 hours is erased on the next AI admission, returning 410 for that key. Lightweight key/hash tombstones are never automatically deleted. No same-key regeneration after expiry.

Sweeps run inside admission transactions. Idle databases may retain result payloads longer than 24 hours until the next admission; this is a replay-cache policy, not the separate product privacy/retention policy. Unknown cost/concurrency is included even when its timestamp ages out of budget windows. This favors stopping over overspending, and can block one user indefinitely pending operator review. It also caps request concurrency across process restarts.

A lost response to the success COMMIT is never used as a reason to call OpenAI again: replay reads the committed result if present, otherwise the request remains unknown. There is no claim of provider-wide exactly-once delivery across disaster recovery or unrelated calls outside this service.

Client transport stores only a body/account/URL digest and UUID in `sessionStorage`; same payload retry after a network failure or page reload reuses the key. No body is stored there. Successful requests remove the pending identity so an explicit later user action may create a new operation. Unknown/in-progress and ambiguous 5xx preserve it and never trigger an automatic retry. Account switches use separate digests. Storage failure aborts before dispatch. A new browser tab/device, cleared browser storage, or an intentionally new key is a new operation; quotas still apply. API integrators must persist their own key for the logical operation.

Errors are no-store: missing key 400, changed payload/in-progress/terminal key 409, replay expired 410, quota/concurrency 429 (`Retry-After: 60` is only a lower-bound hint; longer windows may still block), unavailable/unknown 503, aggregate input too large 413. Confirmed terminal responses clear the client pending key so a later explicit user action can start a new operation; the helper never sends that new operation automatically. A fresh request after a known failure requires an explicit new operation/key; do not automatically create one after unknown.

## Emergency stop and reconciliation

`AI_ENABLED=false` blocks new admissions/dispatches in that deployment. `npm run ai:control -- stop` changes the shared DB gate immediately across processes. Neither kills a provider request already sent. `status` prints only state/count/cost aggregates. Remote/production writes retain the infrastructure CLI's explicit target and maintenance confirmation guards. The commands below are operator instructions; no production command was executed for this implementation.

1. On spend surge, unknown spike, repeated provider 429/5xx or abuse, stop AI and alert the operator. Keep non-AI review available if safe. If a general incident affects writes, block all application traffic at the platform (GET can also provision profiles/plans).
2. Inspect ledger through privileged DB tooling without copying result bodies, keys, emails or identities to logs/issues. Match incident time and provider billing/activity. Do not assume timeout means no charge or no work.
3. Wait past the dispatch lease, confirm the provider request is definitively finished and no worker can still commit. Only then use `ai:control -- resolve-final --request <internal-request-uuid> --confirm-provider-final --retain-maximum-cost` with required remote confirmations. This keeps the conservative charge/tombstone and releases concurrency; it does not regenerate or refund.
4. `ai:control -- resume --confirm-reviewed` refuses while reserved/dispatching/unknown requests remain. Confirm recovery, provider limits, budget and abuse response before resuming; existing rolling cost limits still apply. Restore `AI_ENABLED=true` only after review.

Never delete ledger rows to reset quotas. Restrict CLI/DB credentials to operators. Future Premium limits need a server-controlled entitlement source and separate review; this branch exposes no upgrade path.

## Migration, backup and disaster recovery

Request paths issue no DDL and do not import the runner. Schema manifest/checksum and actual schema are checked on database access, including after a prior successful check; mismatches return 503 instead of repairing. Full introspection adds DB round trips: validate hosted latency before rollout. New schema is isolated in `db/ai-schema.ts`; migration 0008 adds ledger/control with FK, unique keys, state/endpoint/cost constraints and gate seed. No existing migration is rewritten.

Use the explicit runner's checksum, drift rejection, lease/fencing, per-migration transaction, commit uncertainty reconciliation and schema validation. Do not run `drizzle push` or DDL from application startup. Dedicated migration credentials, one operator pipeline, no concurrent deployments. Privacy/Retention migrations must be renumbered only if unapplied, with snapshots/journal/schema manifest regenerated together.

Release sequence: **write/AI freeze → encrypted backup → isolated restore validation → migrate restored clone (dry-run rehearsal) → explicit live migration → schema/ownership validation → immutable application deploy → smoke test → resume**. Existing backups created before migration 0008 remain valid prefix restores; migrate the isolated clone to the candidate version before testing it. A dry run never operates on the live target.

Backup uses AES-256-GCM, authenticated manifest, SHA-256 and 0600 permissions; it contains all tables, including AI tombstones, reservations, usage and replay results. Restore preserves rowids and now defers foreign-key checks within the restore transaction, then validates at commit, integrity, ownership, exact rows and schema. The isolated test restores AI replay without calling OpenAI again, alongside review operation replay/undo and sessions. `db:restore-check` destroys its temporary target; it is not a production restore/deploy command.

Recommended small-scale policy: pre-release backup every migration, independent encrypted backup every 6 hours, daily copies 30 days, weekly copies 12 weeks, weekly isolated restore exercise; provider PITR complements this where the subscribed plan supports it. Target RPO ≤6h for independent backups and RTO ≤4h; these are objectives to measure in a hosted rehearsal, not guaranteed SLAs. Backup storage, scheduler, encryption-key custody/rotation, PITR subscription and outage restore target remain operational setup.

Bad migration: failed transaction rolls back; committed migration uses a forward fix or compatible application rollback. Accidental deletion, operator error or corrupt data: freeze, restore to a new isolated DB, validate and assess lost later writes before promotion. Turso outage: fail closed, never silently fall back to local SQLite. Application bug: freeze writes/AI and preserve evidence/ledger before a forward fix.

**Restoring an old ledger can lose keys and spend created after the snapshot. Keep AI disabled throughout disaster recovery. Reconcile the entire backup-to-incident interval against provider usage and preserve/reimport later ledger/tombstone records from surviving storage before considering replay. If these cannot be recovered, do not enable AI until a separately reviewed recovery/key epoch procedure exists. This branch does not implement that disaster-recovery epoch.** Maximum-cost holds alone cannot reconstruct lost history. Account deletion/consent tombstones must also be reconciled by the Privacy owner before serving restored data.

## Logging, monitoring and secrets

`logEvent` emits only enumerated event/endpoint plus finite numeric status, duration, tokens and micro-cost. It cannot serialize arbitrary error objects, unknown fields, bodies, URLs, keys, tokens, source material, conversation, email or IP. AI/data route catches no longer print raw exceptions. Never add request/response capture or auth headers to this helper. Provider error bodies/refusals are not surfaced as error messages. Configure platform access logs to omit query strings, raw IP and auth headers; code cannot control an external platform's default logs.

Alert policy for deployment: any unknown/DB/migration/backup failure; >5% AI/API failures over 5min with ≥20 requests; sustained 429 or concurrency rejection surge; spend at 50/80/95% of global limits; stale backup >6h; frontend/API latency regression. The hard DB limits work without a monitoring vendor. Aggregate `ai:control status` and fixed log events feed the operator's monitor. Auth failures and general traffic/bots should be monitored at the edge without recording raw IP. Do not trust spoofable forwarded IP headers for account quotas. Edge WAF/CAPTCHA/bot throttling and account-creation abuse monitoring remain external rollout work; authenticated quotas protect AI spend even for multiple fresh accounts via the global budget.

Sentry has value for sanitized error codes, release correlation and frontend crash counts, but vendor installation/configuration is not performed here. Before enabling: disable default PII, request bodies/headers, breadcrumbs with content, session replay and automatic user identity; use an explicit beforeSend allowlist. Native iOS crash tooling, privacy/consent and retention remain owned by other workstreams.

Use isolated Clerk/Turso/OpenAI projects or credentials per environment, hosting secret storage for runtime credentials, and protected CI release secrets only. Never expose server values with `NEXT_PUBLIC_`/`PATCH_` client defines. Backup encryption key is separate from DB credentials and backup storage; rotate with key IDs and retain old decryption keys for the backup retention window. No real keys were copied into this worktree.

## Release checks and verification

Infrastructure guards reject production test Clerk key/development issuer, unallowlisted API/Web/DB, localhost/dummy origins/local DB, test auth/bypass and development flags; static client dependency graph rejects server imports/env access; artifact inventory ties build config/hash to commit and checks injected server secret values. Additional production artifact URL-literal checks reject local/dummy/development Clerk targets. This intentionally may fail a dependency containing a forbidden URL literal; inspect the artifact rather than weakening the check silently. Synthetic positive/negative fixtures exercise the guards; real production allowlists remain empty and cannot be bypassed by a successful development build.

CI Node 22 runs `check` (typecheck, lint, all unit tests, Web build), schema/secret scans, mobile local build, infrastructure tests and auth/onboarding browser regressions using isolated fixtures. Protected manual production artifact validation still has no deploy or remote DB step.

Local verification uses mocks and isolated SQLite only. Required commands: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` (all included in `npm run check`), `npm run test:auth-browser`, `npm run test:onboarding-browser`. Additional `test:ai` covers each Free/global count/cost window, concurrency across independent connections, key conflicts/replay/account isolation, zero retry for provider 429/5xx/timeout, fail-closed DB, lease fencing, unknown, lost COMMIT, atomic chat persistence, client retry storage and secret-free logging. Infrastructure tests cover drift/duplicate runner/lease loss and encrypted restore.

Integration hotspots: both AI route files and `lib/openai.ts` with Consent; shared DB client/API input/data logging and test setup; migration journal/snapshot/manifest/config with Privacy/Retention; package scripts/CI. `app/page.tsx`, settings, auth provider, account lifecycle, consent, retention/streak, widget/notification and Apple settings are untouched. Merge Consent so auth and consent/ownership checks happen before dispatch and replay visibility follows its policy; never bypass `runAi` for consent-approved calls.

### Concurrent Dev update

While this worktree was being implemented, another CLI advanced Dev to `7f93af45ef22466d70b2bab9e27022dd49993366` with Privacy/Account Lifecycle. This worktree intentionally remains based on its start-of-task Dev `1e84fca`; it has not merged or overwritten those changes. Both branches introduce migration 0008 and its snapshot, so integration must renumber the unapplied AI migration and regenerate the combined journal/snapshot/manifest. Resolve both AI routes around the privacy gateway/consent guard without bypassing admission. The account deletion pipeline must explicitly account for the new `ai_requests.user_id` FK and sensitive replay result payloads before production rollout; that lifecycle integration is intentionally not implemented in this branch. Also reconcile backup/scan changes, package scripts and infrastructure test fixtures.

Local verification: Node 22, `npm run check` passed with 152/152 unit tests, typecheck, Web build and lint (0 errors; 41 existing warnings). Auth and onboarding browser regressions and mobile local build passed; final artifact rebuild is recorded in the task result. No live provider requests, production DB/configuration, billing, deployment or Dev/main merge occurred.

## Integrated Consent / Lifecycle contract

The single durable AI gateway now performs authentication (route), active lifecycle + current consent, resource/input/provider-size validation, idempotency/legacy-operation lookup, atomic quota reservation, a second lifecycle/consent check immediately before dispatch, then another generation/consent-revision check inside the atomic result/usage transaction. Replay is also guarded by active lifecycle and the original consent revision. Revocation/regrant cannot expose an older cached response. Inputs rejected before reservation consume no ledger slots. Generation, chat and lesson-summary share this path; the legacy gateway only re-exports it.

Privacy UI operationId and the transport Idempotency-Key stay stable across uncertain retries even if the UI generates a fresh UUID. No automatic retry occurs. Account scope/stale-response checks from Dev remain intact; an already-aborted scope cannot start a delayed native dispatch.

Deletion purges AI replay content and both input/key fingerprints. The existing user lifecycle tombstone retains only minimal ledger references, endpoint/time, usage, cost and execution state for anti-abuse/billing continuity. It does not refund global spend. Reserved unsent work releases cost; in-flight unknown work keeps its maximum hold. Confirmed post-flight rejection releases concurrency without persisting content. Unknown holds require the existing operator reconciliation. Minimal accounting metadata/tombstones are not a full user-data archive; their access and retention policy must be reviewed before production, as with deletion tombstones. Deletion triggers reject attempts to reintroduce AI result content after the account becomes inactive.

Old `ai_operations` rows from Privacy-only Dev are consulted so deployment cannot replay an already-started provider operation under a new key. No applied migration is rewritten: the upgrade test migrates the exact 0000–0008 prefix, preserves history/checksums/data, then applies 0009 and verifies old-operation suppression. Isolated restore tests preserve both Privacy evidence/deletion progress and the AI ledger.

Remaining production operations are unchanged: external credentials/allowlists, monitoring and scheduler configuration, hosted migration/restore rehearsal, and disaster recovery of ledger history lost after a snapshot (recovery epoch). These are not performed by this integration. Normal Consent/Lifecycle/AI integration and deletion content cleanup are implemented, not deferred.
