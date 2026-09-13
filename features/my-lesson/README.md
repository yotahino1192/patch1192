# My Lesson UI Foundation

Independent React feature, not connected to Home, Continue Learning or existing Study. No DB/API/auth/Retention changes. My Lesson is the learning session itself, not a selection screen. Visual styles inherit Patch tokens; layout is provisional pending UI Designer assets.

## Integration

Mount `LessonExperience` with a stable `LessonAdapter`, `sessionKey`, `onHome`, optional `variant` (`normal | firstLesson`) and `onBudgetChange`. Home/Composer chooses the lesson; adapter maps Domain data into `LessonViewModel`. Change `sessionKey` whenever account scope, selected lesson, or adapter changes. This remount aborts pending calls, clears answers/help and ignores stale results. The host must unmount on logout/deletion/consent transitions as appropriate; this mock-only feature does not implement auth or bypass consent.

Adapter methods receive AbortSignal and operationId. Evaluate retries preserve operationId for the same answer; no automatic retry is performed. Real adapters must implement server idempotency and unknown-state semantics before mutation/AI integration. `retainLearning` is idempotent by operationId and accepts a LearningObjective candidate; it must never report adding a card. Help errors preserve the Activity answer, and closing the native modal returns focus to the trigger. Help conversation is session-local, clears on close, and is not persisted.

Five renderers only, one shell/header/footer. Shared states live in state.ts; renderer inputs are controlled. Completion is based on exhausting the supplied activity array, never a five-card checkpoint. Streak and next timing are display-only adapter values. Completed concepts are supplied by Domain, not invented from a local scoring rule. Empty lessons show a normal empty state with Home, not an earned completion.

Time starts when the loaded, nonempty lesson is displayed. A monotonic clock includes AI Help and foreground/background elapsed time; completion freezes actual duration. `onBudgetChange` exposes elapsed/remaining/current estimate and completed/total progress. Reaching zero does not delete activities, dispatch AI, or force completion. Composer budgeting/resume persistence are future integration responsibilities. targetMinutes must be 5–15; short content may finish sooner.

## Preview and tests (Node 22)

- `node scripts/preview-my-lesson.mjs` — loopback-only development harness, no production route. Mock feedback and retained candidates are not persisted.
- `node --test tests/my-lesson.test.mjs`
- `node scripts/check-my-lesson-browser.mjs`

The fixture is outside Next/mobile entry graphs. Do not expose the harness in production. No real AI API is called.

## Designer handoff

Provide final Shell, five Activity content layouts, Help sheet, normal/first Lesson Complete, and loading/empty/error/disabled/selected/feedback states at mobile and web widths. Apply the visual treatment to the scoped CSS/renderers while retaining the state contract, one primary CTA, modal focus behavior and unchanged navigation.


## Real Domain adapter

`DomainLesson` is an unlinked component for the existing Account/Privacy provider tree. It uses `useApiFetch` → `createDomainClient` → `/api/domain`; no repository imports or new production route. Caller supplies the already selected lessonId (Home/Composer selection is out of scope). Account/adapter changes remount the experience and abort old work. The test-only `domain-lesson.html` harness is served by `check-domain-lesson-browser.mjs` against a temporary migrated DB and signed test sessions.

`createDomainLessonAdapter` reads Lesson, ordered LessonActivity, Patch, Objectives, Activities and current non-undone Attempts. It validates all five supported types before starting CREATED → ACTIVE. ACTIVE resumes from successful stored Attempts; an incorrect latest Attempt restores feedback and requires explicit practice. No second study session or local storage is created. Unsent draft text cannot survive full page reload; saved answers/progress do. Legacy sessions are rejected as read-only, leaving their existing service/Study path intact.

LEARN requires an explicit Next to record COMPLETED. Other types save on explicit Submit: CHOICE uses the supplied answer, RECALL uses self-report, EXPLAIN/APPLY explicitly ask the learner to compare against the reference answer and self-assess (no AI grading). INCORRECT does not advance. A fresh review is a new Attempt. Domain transactions remain authoritative for ownership, membership, idempotency and formal completion. After the final saved successful Attempt, advance calls completeLesson and rereads authoritative COMPLETED before rendering Complete. A failed completion call leaves the shell recoverable, never optimistically complete.

Each logical answer uses a deterministic SHA-256 operation ID from lesson/activity/previous Attempt. Two adapters loading the same predecessor cannot create duplicate Attempts, including an in-flight reload. All request fields are frozen for explicit retry; a changed uncertain answer conflicts and requires reloading server state. An in-memory caller-operation receipt also rejects changed payload for the same caller ID. There is no automatic replay, local pending-answer cache, or new session system. Per-answer durationMs is currently 0 (not measured); Complete shows the server startedAt → completedAt wall interval as **Lesson elapsed time**, including Help and time away, not an assertion of foreground-only study time.

ObjectiveState is **read-only** here. Current Domain service intentionally does not update mastery/incorrectCount/lastReviewedAt/nextReviewAt from Attempts; this adapter rereads it after saving and returns it in feedback, without writing a new projection or inventing a mastery/Due formula. Automatic projection is a separate Domain specification/implementation step. Completion's objective count is the distinct Objectives associated with successful Attempts, not a claim that mastery increased. Streak/Due are neither calculated nor modified.

AI Help and retainLearning remain explicitly injected preview callbacks; only those two methods are copied, never mock load/evaluate. No AI POST, real objective save or consent bypass is added.

Additional validation: `node --test tests/domain-lesson.test.mjs` (signed real route + isolated DB), `node scripts/check-domain-lesson-browser.mjs` (actual Next API + React/AccountScope + isolated DB). Existing mock preview/browser tests remain available.

Verification at this checkpoint (Node 22.23.2, isolated development environment): full `npm run check` passed with 236/236 tests; final typecheck/lint (0 errors, 41 pre-existing warnings) and 12 targeted UI/adapter tests passed. Mock and real Domain browser suites, auth/privacy/onboarding+Retention/reliability/public-pages browser suites and health/readiness HTTP checks passed. `ios:sync:local` and Swift snapshot/policy tests passed. Unsigned generic iOS Simulator build succeeded for App and embedded PatchWidget, both arm64/x86_64, with signing disabled and an empty Team. No production navigation change, production DB access, external setup or Dev merge.
