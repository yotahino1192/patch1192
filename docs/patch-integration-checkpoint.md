# Patch UI Phase 1 + U2 integration checkpoint

Date: 2026-09-14. Branch: `codex/patch-integration-checkpoint`. Worktree: `/private/tmp/patch-integration-checkpoint`.

## Sources and history

- Fetched `origin/Dev`: `50ef687`. Latest local Dev: `66aeaee`, which includes that remote baseline plus preserved designer references. The dedicated worktree starts from `66aeaee`.
- UI Phase 1: `076a35c`, merged with history in `622afb9`.
- U2: `f4588a2`, including its existing Lesson Shell ancestry, merged with history in `da6f516`.
- No textual merge conflicts. Git combined `app/page.tsx` and `tests/workflow-rendering.test.mjs` cleanly. The remaining work was explicit integration of the Home/Preview and completion boundaries.
- Dev, main, both source branches and production are unchanged. This is a local checkpoint, not a deployment or release approval.

## Working flow

Home → an existing assigned My Lesson → Phase 1 Lesson Preview → Start → real U2 Lesson Shell → Learn / Recall / Choice / Explain / Apply → server-confirmed completion → Phase 1 Lesson Complete → Home.

`AvailableLessons` uses existing authenticated `patches` and `lessons` queries. It lists CREATED/ACTIVE non-legacy Lessons belonging to active Patches; completed and abandoned Lessons are absent. Choosing a Lesson is explicit. The original Home Continue Learning CTA, review/set priority and paused legacy sessions retain their existing behavior. No new daily selection policy or card-to-Activity conversion is implied.

Opening/closing the preview only reads metadata. Start selects the real Lesson ID via the existing `LessonEntry`; loading validates ownership, content and assignments before the existing `startLesson` command. The URL-based entry remains available. Separate preview heading IDs preserve accessible dialog labels when both previews are mounted.

U2's adapter, reducer, five renderers, AI Help and checkpoint remain authoritative for activity interaction. The host supplies a completion rendering slot after the adapter confirms COMPLETED. It reuses Phase 1 mascot/results/streak presentation, labels the count as activities, and derives retry count from this Lesson's non-undone INCORRECT Attempts. Objective descriptions remain in an expandable section; elapsed time is explicitly device-local. Standalone U2 consumers retain their prior completion component.

## Boundaries preserved

- Integration-specific API/backend changes: **NONE**. The existing U2 addition to `/api/ai/chat` for Lesson context is inherited from `f4588a2`; this integration adds no endpoint or request shape.
- Domain command/query/entity, grading and persistence changes: **NONE**. `retryCount` is a UI view-model value derived from existing Attempt records.
- DB/schema/migration changes: **NONE**, including relative to Dev. No migration was added or edited. Browser tests apply the existing migrations only to temporary test databases.
- Auth, account scope, ownership, consent, logout/deletion cleanup and cancellation remain in the existing providers/transports. Production does not import test fixtures or mock adapters.
- New Domain Lessons retain `qualifies=0` and `earned_day=null`. Their completion does not create legacy reviews, increment Streak, set completed-today, or alter Due Count. Completion and return to Home request the existing authoritative Retention refresh.
- A learner who has already completed an existing qualifying review still sees Phase 1's completed-today Home. A U2-only completion returns to the normal Home unless the server says the daily goal was achieved. No new qualification policy was introduced.
- The three final mascot PNGs are byte-identical to `076a35c`. Existing UI Phase 1 layout/CSS is preserved; the added assigned-Lesson section uses its existing action-card styles and a scoped section margin.

## Material integration changes

`app/home-screen.tsx`, new `features/my-lesson/available-lessons.tsx`, `app/lesson-preview.tsx`, `app/page.tsx`, LessonEntry/DomainLesson/LessonExperience completion-slot wiring, new `app/domain-lesson-completion.tsx`, `app/lesson-completion.tsx`, adapter completion metrics, small translation/CSS additions, documentation, the integration browser fixture/script and its package command. No broad cleanup or refactoring was performed.

## Validation

Node 22.23.2, `PATCH_ENV=development`. Signed fixture accounts and isolated SQLite databases; no live AI calls or production credentials. API-backed browser commands also use `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=''` in the test process so the isolated issuer is used.

| Check | Result |
| --- | --- |
| Unit/API tests | **250/250 PASS**; combined UI/U2 suite, with assertions for completion retry metrics |
| Typecheck | PASS |
| Lint | PASS: 0 errors, 39 pre-existing warnings |
| Web build, environment/schema/secret guards, artifact seal | PASS |
| Mobile development bundle and artifact seal | PASS; existing chunk-size warning |
| UI Phase 1 browser | PASS: seven states, 320/393/430/768px, dialog/focus/start, stable asset layout |
| U2 renderer browser | PASS: five types, full six-activity completion, errors, time budget, Help, scope changes |
| Real Domain Lesson browser | PASS: persistence, resume/draft, lost-response/duplicate retry, consent, account/logout isolation |
| New full-App integration E2E | PASS: Home→Preview→real six-activity Lesson→Complete→Home; read-only preview, duplicate taps, wrong-answer retry, uncertain save and completion, reload/draft/resume, Help consent, list retry, stale account results, unchanged Continue/Due/Streak, both unqualified and qualified post-Home |
| Existing onboarding/Study/Retention/deep-link browser | PASS, including once-per-day Streak and signed-out deep-link recovery |
| Auth and privacy/deletion browsers | PASS |
| Reliability browser and HTTP | PASS |
| Public-page browser | PASS |

Reproduce the integration test after a Web build with `npm run test:integration-browser`. Captures are ignored local artifacts under `outputs/integration/`; existing Phase 1 captures are under `outputs/ui-phase1/`.

Visual QA reviewed Home, Preview, all five Activity kinds, AI Help, Complete and both post-Home states at 320×568, 393×852 and 430×852. No horizontal overflow; book/confetti/mascot framing remains intact. Narrow screens scroll to fully visible, unobstructed primary controls, checked by bounding boxes and hit testing. The test also checks unique IDs for the coexisting dialogs. The initial test setup used an invalid short Lesson and was corrected to the existing 5–15 minute / 300–900 second contract without changing product rules. A modal hit-test initially selected the inert Home button; the test now prioritizes the visible dialog action. Web font fetch required network-enabled execution, and dependencies were copied into the isolated worktree to resolve the test server's font allow-list issue.

Swift/Simulator and native runtime interaction were not rerun: no Swift, Widget, native resource, signing or Capacitor configuration changes. Mobile validation here means the development bundle and real browser rendering at mobile widths.

## Remaining work and review readiness

Ready for **repository hygiene review**. This does not mean Dev should be merged or production deployed.

- No Composer/assignment-authoring UI: existing assigned Lessons must already exist. If none exist, the new section is absent and current card/import flows remain available.
- U2 still uses its provisional visual style and partially Japanese-only activity UI. Final visual alignment/i18n is a later task; Phase 1 Home/Preview/Complete visuals are retained.
- Per-Attempt duration remains 0; device draft/time is not synchronized across devices. One checkpoint per account and existing offline/manual retry limits are unchanged.
- New Lesson Streak qualification, AI grading, mastery/Due projection and adaptive composition need separate product/domain decisions. They are intentionally unchanged here.
- Lesson listing uses existing per-Patch reads and refreshes on Home remount/reload. It introduces no new aggregation or live assignment subscription.
- AI Help success in browser E2E uses a test transport response; the existing AI route tests exercise the real server boundary with a mocked upstream provider.

Recommended next step: review the integration diff and repository hygiene on this branch, then decide the next product scope. Do not merge into Dev as part of this checkpoint.
