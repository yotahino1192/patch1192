# Integration stabilization — 2026-09-13

Base: Dev `11eda5d72a2d770a59cfb7fad733b70d2835946b`. Branch: `codex/integration-stabilization`. This checkpoint is not merged into Dev or deployed. No schema migration, hosted data, authentication configuration, Apple Team, UI redesign or dependency changes.

## Changes and invariants

- A successful AI response header no longer clears the retry key before the complete JSON body arrives. An unreadable/truncated body keeps the operation key for an explicit retry. There is no automatic OpenAI retry.
- PrivacyProvider invalidates in-flight results on withdrawal (including another browser tab's pending withdrawal), account departure and cleanup. A revision fence checks both HTTP completion and JSON consumption, including native HTTP that ignores AbortSignal. Regrant does not revive an old result.
- Aborted AI requests send a best-effort authenticated `POST /api/ai/cancel` with the original operation key and captured account/session credentials. The cancellation endpoint requires an active authenticated user but no AI consent. It can only cancel that user's operation; it never deletes previously committed history.
- The existing `ai_operations` table stores `cancel:<SHA-256 operation key>` markers. Admission, provider dispatch and result transactions check the marker. This also handles cancellation arriving before the original request. No existing migration was edited. Existing account deletion purges these owner-scoped markers.
- The server also checks Request.signal before dispatch and around result finalization. A canceled reservation is released only before dispatch. In-flight/unknown requests keep concurrency and conservative cost reservations until resolved: canceling repeatedly cannot bypass the concurrent provider-call limit. Cancellation never assumes that already transmitted OpenAI data or incurred cost can be recalled.
- Native Deep Links enter an account-scoped inbox. Transient API failures keep the intent and retry with 1–30 second backoff, within the existing five-minute validity period. Authentication, resource ownership validation, deleted-resource fallback and the shared Continue resolver remain unchanged. Queue size is capped at 16; successful handling consumes an intent.

- Public-page browser teardown waits for its own Chrome/server exit and retries temporary-directory removal, avoiding a shutdown/write race. The signup fixture persists its simulated SDK session across reload; no production authentication bypass was added.

## Regression coverage

| Flow | Verification |
| --- | --- |
| Email signup → verification → onboarding → first Study → Day 1 → Home | Existing full application browser fixture now starts from the signup UI; Clerk SDK is simulated and real API/isolated DB handles learning |
| Existing learner → Continue → Study/Undo → Streak/Due → notification/Widget | Retention DB/native-adapter integration and onboarding browser suite; snapshot, warning cancellation and Undo recalculation |
| AT_RISK / LAST_CHANCE / completed / broken / stale, DST/travel | JS Retention tests and Swift snapshot/notification-policy executable |
| A logout/switch → B; stale responses, restore and cleanup | Auth browser + account-scope tests; privacy browser additionally holds an AI response across switch and logout |
| Consent unset/denied/revoked, AI generation/chat/summary | AI routes/control + privacy lifecycle tests; denied/revoked have zero provider calls; in-flight revoke is also exercised in browser |
| AI timeout, duplicate request, truncated response, cancellation | Client, real route and transactional ledger tests with fake provider; cancel-before-admission, replay, conservative budgets and concurrency |
| Deleting → protected API stop → worker retry → cleanup | Privacy lifecycle/AI route/Retention tests; failures, generation fences, scoped deletion, B and loop-owner preservation |
| Pre-login/deleted/foreign Deep Links; API outage | Continue resolver + new inbox tests; browser injects one 503 after native dequeue and verifies eventual navigation |
| Public Privacy/Terms/Support | Public-page browser tests: unauthenticated delivery, headings, links and responsive views; shared app renderer |
| Production guardrails / explicit migration / backup restore | Existing infrastructure tests, build checks and artifact sealing; isolated fixtures only |

## Limits and release acceptance

- Cancellation is best effort over the network. If an abort/cancel cannot reach the server (offline, connection loss or session already revoked), an already dispatched operation can still finish and commit under its original owner. The client never applies its stale response. Server-observed consent withdrawal/deletion and delivered cancellation are transactional fences. Do not promise offline server-side cancellation or removal of data already sent to OpenAI.
- The new retry inbox is memory-only. An app process termination after native dequeue and before successful resolution can lose that intent; a new tap works. It does not persist cross-account resource identifiers in unscoped storage.
- Browser authentication/native transports are controlled fixtures, not a test of production Clerk or iOS OS scheduling. Live email delivery, persistent native session/reauthentication, offline restart, physical notification taps and Widget App Group sharing need device acceptance.
- Builds are development-configured production Web compilation, local mobile bundle and unsigned Debug Simulator App/Widget compilation. They do not establish signed Release/Archive/TestFlight readiness. Personal Apple Developer signing/App Group setup remains pending; no company Team was used.
- Public legal/contact placeholders, production provider/environment allowlists, hosted explicit migrations, backup recovery acceptance and deletion-worker scheduling still require their existing release runbooks. No external service was configured here.

Exact verified commands/results are recorded in STATUS.md after the final run.
