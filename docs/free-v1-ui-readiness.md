# Free v1 UI checkpoint

## Branches and scope

Inspected current branch history and worktrees before editing. Shared Dev/origin/Dev was `716d298`; Add Material had advanced to `44279fd` beyond the supplied `ab8192c`. Dev was merged into Add Material as `70061ea`, without conflicts. Home started at `88f2b49`, incorporated Dev and its reviewed approved visual/Splash descendants through `d382da8`, then finalized the contained Today action. Active history was preserved. No merge into Dev or push was performed.

The Add Material branch already contained the approved Home/Splash history. Its Today action receives the same small visual change as Home, without blindly merging feature branches. During final verification local Dev advanced to `b51ba1e` (origin/Dev remained `716d298`); this newer Dev was inspected and merged into both branches without conflicts, Add Material merge `0aefecc`. Its operations changes are inherited baseline work, not additional CLI1 scope. Recommended review/merge order: Home, then Add Material; rerun the combined gate before treating Dev as a Free v1 baseline.

## Readiness

- Add Material: existing pasted-source and supported upload flow, destination, Customize, Preparing/recovery, read-only Flashcard/Choice previews, durable Save and Ready preserved. Restored unsupported-format drafts ask the user to choose a supported format. No silent conversion or discard.
- Home: Evergreen/Mint/Peach composition and approved assets preserved. Start/Continue is inside Today's Lesson, including the completed-today state, with a 44px minimum target. Real data, navigation and Continue selection/resume remain unchanged.
- Startup: approved waving mascot and Patch wordmark on Evergreen. Existing bootstrap/session-restore lifecycle has no artificial minimum delay and does not recur on navigation, AI calls or saving. Verified, no auth/lifecycle rewrite.
- Flashcards: clearer question/answer hierarchy, readable spacing, existing reveal/swipe/buttons and persistence retained.
- Multiple choice: four full-width options, A–D markers, persistent selected/correct/incorrect presentation after reveal, question context, existing explicit record/next action. Selecting/revealing alone does not persist an attempt; original verdict/queue logic remains authoritative.
- Complete/History: actual completed card/again counts, existing server Retention/Streak and review schedules. History displays real review counts and Streak, without memory-stage/mastery-like summaries or AI history.
- Advanced Lesson entry/list, Tutor and automatic AI recap are disabled at the production presentation boundary. Existing advanced engines/data are retained for compatibility, not offered as Free v1. Unsupported legacy study cards produce an honest unavailable state; their data/session are not deleted or transformed.

No new API, backend/domain rules, DB/schema/migration, dependency, correctness/Attempt logic, session completion logic, auth/account isolation, consent/hardening, release configuration or Streak/Retention rule changes in this pass. Earlier Add Material persistence/generation changes remain documented in their original checkpoint reports.

## CLI3 contracts / release gaps

1. **Short topic generation is not supported by the current source-only contract.** `/api/ai/cards` requires at least 80 source characters and instructs generation from supplied material. A short-topic mode needs an explicit server/product contract; UI does not pad the source, invent evidence, or bypass validation. Pasted source/PDF/supported files are ready; the complete requested input scope is not release-ready yet.
2. Free v1 currently uses the existing card Study/Retention session, not U2's advanced Lesson entities. Establish that as the intended Free v1 contract or supply an approved adapter; no parallel UI session engine was introduced.
3. Retention remains server-owned: ordinary sessions qualify only when the assigned estimated workload is 300–600 seconds and every assigned card is successfully recalled. Small sets are short practice and do not earn Streak. Actual stopwatch duration is not a gate. The existing initial three-card onboarding exception and once-per-day/undo rules remain intact. Confirm this policy against Free v1's short-material PMF loop before release.
4. Home Preview's existing optional U2 lesson estimate lookup is not a reliable estimate contract for card sessions. Do not fabricate duration/qualification labels. CLI3 should define how authoritative card-session estimates/qualification reach the pre-study UI if required.
5. Define compatibility for pre-existing unsupported card formats/interrupted advanced sessions. Current UI preserves them but does not expose Explain/Apply learning.
6. General history charts retain existing Tokyo-day grouping; Retention uses its authoritative logical-day/timezone rules. This difference is preserved for core review. Add Material also retains existing English copy alongside localized study/Home; localization consistency remains UX work.

## Validation evidence

- Node 22 full `npm run check`: **272 tests passed**, typecheck passed, lint zero errors (12 existing warnings), Web build and artifact seal passed.
- `npm run mobile:build:local`: mobile bundle and artifact seal passed; existing chunk-size warning.
- Real authenticated, isolated-DB browser test: Review/Ready, read-only previews, new/append saves, double submit, rejected save, lost-response/reload/idempotent retry, saved-card-only study start; Flashcard and Choice → real saved Complete → Home/History. No AI calls during study/completion.
- One opt-in real development AI request using a synthetic photosynthesis paragraph and an isolated test account/SQLite DB: **succeeded**, input 494/output 1461 tokens; Preparing → Review → durable Save → Ready. Exactly one AI ledger record, no retry. Audit DB retained locally at `/var/folders/hb/w3gz4lrx7flfpy4stdtzzv8m0000gn/T/patch-review-browser-0iyEZ3/test.db`; personal preview DB was not written.
- Add Material generation/upload/recoverable-error browser suite passed. Legacy U2 browser suite passed using a test-only source transform to enable the retained advanced entry; this is compatibility coverage, not production Free v1 evidence.
- Auth/startup and Privacy/AI-consent browser regressions passed. Older harnesses emit shared-worktree font allow-list warnings; visual suites explicitly serve local fonts.
- Visual checks: 393×852 primary, 320/390/430/768 widths, 150% text, reduced-height keyboard-constrained layout, scroll/CTA/safe-area styling. Screenshots in ignored `outputs/add-material-review`, Home's `outputs/ui-phase1`, and `outputs/startup`. No physical-device, real iOS keyboard or VoiceOver QA claimed.

- Debug iOS Simulator build succeeded with Xcode 26.1.1, generic Simulator destination, signing disabled, and the verified local mobile bundle. No native source/release configuration changes. This is a build check, not physical-device QA.
- Add Material onboarding/Retention deep-link regression passed after updating its old external-CTA selector to the Today-contained action. An earlier run returned 401 at fixture bootstrap; rerunning on a dedicated port passed (test-server overlap suspected, not a demonstrated product auth defect). Home's older onboarding harness also needed its obsolete Japanese label wait replaced by a real Home-screen selector.

After the newer Dev merge: **277 tests passed**, typecheck/lint (12 existing warnings, zero errors), Web/mobile artifact builds and the refreshed Simulator Debug build passed. Both the retained U2 compatibility suite and the real Free v1 Review/Save/Study/Complete/History browser suite passed. The new Free v1 browser loop was adjusted to await React's record-action rendering before clicking, after a timing failure during concurrent asset rebuilds; this is a test synchronization change, not a product state change. Home's final checkpoint is `5d1e851` (258 tests plus its Web/mobile and onboarding gates passed).

UI readiness does not mean TestFlight release readiness until the contracts above are resolved.
