# Add Material Review and Ready checkpoint

Branch: `codex/patch-add-material`, continuing `b343bbb` in `/private/tmp/patch-add-material`. Dev, main, production and the other active worktree remain untouched. No merge, push or deployment.

## Scope and references

Prompt 08, 10 and 11 are implemented. The user's second-half request supersedes the Word document: outcomes and preferences are read-only, actual study Preview is included, and Prompt 09 is excluded. Downloads `prompt8.png` and `prompt10.png` are the visual references. No Prompt 11 image was found; its anchored dropdown follows the written specification and the Review field's visual treatment. The added Preview requires scrolling on a mobile viewport; the final action stays reachable at the bottom.

Ready uses Downloads `Sparkling Patch.png`, copied unchanged to `public/patch/mascot-sparkling.png` (1192×1319 transparent PNG). The existing completion mascot remains unchanged. The quote's small plant is a simple SVG. No unresolved mascot/asset request.

## Behavior

- Review keeps the shared account-scoped generation draft. Inline naming changes only the new collection name. Existing destinations show their real identity without exposing a rename action; switching back restores the new name. The dropdown overlays content, supports keyboard/outside/Escape dismissal, and never generates or saves on selection.
- Outcomes use generated `keyPoints`. Missing outcomes, missing cards, empty new names and invalid multiple-choice options block saving. There are no outcome deletion/edit actions or preference editing controls.
- Preview reads the actual selected generated cards, one at a time. Flashcards reveal the real answer; multiple-choice content displays real options as non-interactive rows with an explicit answer reveal. Previous/Next resets the reveal. Preview uses local React state only; there is no AI call, Attempt, review or Retention command.
- Back returns to Customize with the draft intact. The existing generation fingerprint/cache and stale-response guards remain in place. Changed generation inputs use the existing provider pipeline. Invalid/empty generated content is not reused on the next explicit Generate action; name/destination-only changes still reuse valid content.
- Final save is explicit. A synchronous lock and disabled controls stop duplicate clicks. Recoverable rejected saves retain the draft/name/destination and allow editing and retry. An uncertain result retains the exact pending request across reload; editing/Back stay locked until that same save is retried. This prevents changing the destination or name of a potentially committed request.
- Ready is rendered only from a successful persisted result. It says “ready” for a new Patch and “updated” for an append. The draft is cleared only after that success. Home uses the refreshed server data and the next Add Material starts fresh.
- Start my lesson uses the existing card Study/Retention-start path. The saved card IDs select the newly added material, not older content in the destination. Start failure stays on Ready with retry. This does not create U2 Patch/Objective/Activity/Lesson entities or a new AI job.

## Minimal persistence extension

The existing `/api/data` `saveSet` and `addCardsToSet` actions now accept an optional `operationId` and return `setId`/`cardIds`. Existing callers remain supported. A write transaction binds that operation to the account and exact payload; deterministic existing card primary keys retain the receipt, including after ordinary soft deletion. Replays return the original IDs without duplicating a collection, cards, or appended source text. Reusing an operation with different content fails with 409. The payload digest is salted with the account/operation. Concurrent deliveries and partial-write rollback are covered by real SQLite tests.

There is no new endpoint, DB table, column, migration, dependency or domain entity. Authentication, ownership, AI consent, generation API, Retention/Streak qualification and unrelated Home behavior are unchanged. Saving new material affects available/due cards through the existing behavior; Preview does not.

## Validation

- Node 22: all **262** unit/API tests pass; typecheck and lint pass (zero errors, 13 existing warnings).
- Web build/artifact seal and local mobile build/artifact seal pass (existing mobile chunk-size warning).
- New authenticated full-App browser suite: flashcard/choice Preview; zero progress effects; Back; destination/name retention; overlay; new save and append; rapid submit lock; rejected save; lost response after real commit; reload/same-operation retry; Ready gating; fresh draft after Home; actual lesson start with only new card IDs and start-error recovery.
- Prompt 01–07 browser regression passes with the new Review handoff and recovery from an empty generated result. Existing UI, U2 integration, onboarding, auth and privacy browser regressions pass. Older auth/privacy/onboarding harnesses report font allow-list warnings from shared worktree dependencies; the new visual harness loads the local fonts correctly. With local preview credentials present, the onboarding test explicitly sets `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=''` to keep its test identity isolated.
- Screenshots under ignored `outputs/add-material-review/`: reference-sized Review/Ready/dropdown, flashcard and choice states, 320/390/430/768px widths, enlarged text and reduced-height input checks. Real iPhone keyboard and VoiceOver remain hardware QA items.

## Deferred / intentionally excluded

No Study Preview dependency is deferred: current generated content supports both formats. Prompt 09 is intentionally excluded. The first-half limitation on short-topic generation and the separate U2-domain conversion remain unchanged. Exact Prompt 11 image comparison awaits a supplied reference filename; its documented interactions are implemented.

Commands: `npm run check`, `npm run mobile:build:local`, `npm run test:build-review-browser`, `npm run test:build-patch-browser`, and the existing UI/integration/auth/privacy browser scripts (set `PATCH_ENV=development`).
