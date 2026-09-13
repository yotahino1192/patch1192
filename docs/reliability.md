# Reliability / Error Handling

Baseline: Dev `11eda5d72a2d770a59cfb7fad733b70d2835946b`. No changes to business rules, DB schema, Retention calculations, consent requirements, deletion authorization or AI billing rules.

## Boundaries

- `lib/reliability/errors.ts`: closed error categories, safe Japanese messages, response parsing and explicit retry policy. HTTP code and existing application `code` stay available for review-conflict reconciliation. Never display an external response's raw `error` string through the common parser.
- `transport.ts`: one network dispatch, 30-second general API deadline / 75-second AI deadline (including body consumption), 15-second native token lookup deadline. Abort-aware even when native HTTP ignores cancellation. A local timeout is not proof the server cancelled or rolled back. No automatic retries, including reads.
- `network.ts`: offline/reconnect/pageshow/visible signals only, plus a single-flight helper. Existing Retention foreground/read refresh remains unchanged; connectivity events do not queue mutations or replay them.
- `observability.ts`: provider-neutral optional callback, default no-op. Only fixed event/kind, numeric status/duration and UUID request ID pass. Never pass Error objects, tokens, keys, emails, IP addresses, URLs/query strings, user IDs, material/chat content or request/response bodies. Application global error listeners report only a fixed event and keep the current screen; fatal render boundaries offer recovery.
- `server.ts`: all API route exports share a safe exception envelope, no-store and X-Request-ID. Existing handlers/auth/lifecycle checks are unchanged. Unexpected failures return generic 503; server 5xx logging only serializes the allowlisted diagnostic. Framework/development tooling and hosting-provider logs are outside this application's logging adapter; configure any future provider to disable automatic body/PII collection.

## Recovery and safety

- An API outage during bootstrap shows the existing locked auth/loading UI. SDK initialization/token waits have deadlines; a stalled Web SDK displays a login recheck after 15 seconds. Offline launch never trusts a cached identity to open private data. There is no new offline authentication or persisted full API cache.
- Already displayed materials and study drafts remain mounted during network/AI failure. Card reading/flipping can continue where the current UI permits it; grading, session start, persistence and AI still require their existing server acceptance. No new offline review queue or local Streak computation is introduced.
- A failed data reload retains the old loaded data and workspace. Repeated reload clicks cannot start overlapping explicit reload requests. Successful recovery uses the existing reconciliation and stable pending operation IDs.
- Retry policy has `automatic: false` for every category. Manual GET/HEAD retry is eligible for transient failures; 401 requires authentication, 403/404 require access/state review, 409 requires reconciliation, AI unknown is never automatically retried. Mutation recovery must retain its existing operation ID and reconcile first; the generic transport never mints a replacement mutation ID. Existing `sendAi` retains its key on timeout/unknown.
- Retry-After is bounded to 24 hours and enforced in memory for the same account/session/method/API URL. This is a UI guard, not a replacement for authoritative server quota/concurrency limits. Cooldown entries are bounded to 256, and may reset after process restart.
- AccountScope remains the authority: invalidate/abort on departure, assert again after token/response/body. Transport failures from a departed scope become StaleAccountError rather than leaking an earlier account's error/result.
- Malformed workspace envelopes are never trusted for authentication. Before overwrite, keep one original at `patch:workspace:v2:<userId>:recovery`; if saving that copy fails, do not overwrite. The existing account cleanup deletes this copy too. It is never logged or uploaded. The warning remains while the copy exists. Automatic repair of arbitrary malformed field contents and an export/recovery editor are not provided.
- React render errors show Retry, Reload and Home with a warning about unsaved edits. Retrying remounts through the original auth gate; it does not clear storage. Next route/global error fallbacks cover Web; the mobile HTML has a static startup/reload screen if entry loading fails. Async global errors preserve current UI and show a dismissible message. These boundaries do not promise recovery from an OS process termination or a Web page that has never been cached and cannot load at all.

## Health / readiness

- `GET /api/health`: public process liveness, `{status:"ok"}`, no auth/DB/provider calls.
- `GET /api/ready`: public `{status:"ready"}` (200) or `{status:"unavailable"}` (503), no DB content, configuration or provider details. Calls the existing read-only schema validation; no migration or DDL. 2-second response deadline, 5-second cache, maximum one in-flight validation per process. A hung validation is not multiplied by probes. It is not a Clerk/OpenAI availability check or a distributed rate limiter.
- Both are no-store and carry X-Request-ID. Do not use readiness as authorization or to run migrations. Investigate failures with correlation IDs in sanitized server logs and the existing explicit migration/runbook tooling.

## Verification (Node 22, isolated development settings)

```
PATCH_ENV=development npm run check
PATCH_ENV=development node scripts/check-reliability-browser.mjs
PATCH_ENV=development node scripts/check-reliability-http.mjs
PATCH_ENV=development npm run test:auth-browser
PATCH_ENV=development npm run test:privacy-browser
PATCH_ENV=development npm run test:onboarding-browser
PATCH_ENV=development node tests/public-pages-browser.mjs
PATCH_ENV=development npm run mobile:build:local
```

No live Clerk/OpenAI/Turso credentials are required for tests. Keep test servers/profiles isolated; do not run migrations against a hosted database. Real signed iOS/device offline/foreground behavior, provider outage drills, Sentry configuration, offline service-worker caching and production deployment are follow-up work.

Integration hotspots: small edits in app/page.tsx (response parsing, reload guard, boundary), auth-provider.tsx (safe SDK wait), account-scope/storage and use-workspace (preserve scope and recovery copy), mobile/index.html, and API export wrappers. Merge these alongside Integration changes without replacing handlers, privacy guards, pending operation IDs or Retention code. DB schema/Retention algorithms/native Swift code are unchanged.

## Checkpoint validation

Node 22: typecheck, lint (0 errors; 41 pre-existing warnings), all 199 unit/DB tests, Web build, mobile local build, Swift snapshot tests, auth/privacy/onboarding/Public Pages browser suites, new reliability browser and HTTP suites passed. Browser recovery checks include offline launch, API outage, reconnect without replay, failed reload, repeated retry, fatal recovery and preserved drafts. The existing onboarding loss-of-response assertion now expects the sanitized message while still proving only one set was saved.

At checkpoint, the separate Integration worktree also has edits in app/page.tsx, the AI route files and scripts/check-onboarding.mjs. These are known manual merge review points; its worktree and changes were not modified or imported here. Dev is not merged by this task.
