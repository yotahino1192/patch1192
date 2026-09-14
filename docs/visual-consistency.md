# Patch main-screen visual consistency

Baseline: `Dev` at `1983b07`. Working branch: `codex/patch-visual-consistency`.

Sets, set detail/editing, material import/card candidate review, Records, and the
Settings dialog now share Home's white surfaces, mint accents, soft borders,
and body-font headings. The main tabs share Home's floating bottom navigation
and SVG icons. Set icons and metadata, search results, folders, card rows, chart
bars, and primary/secondary buttons receive scoped presentation changes.

The Home token block and navigation CSS are reused through `patch-main-shell`.
The secondary-screen scope uses darker supporting text for readability. The
existing PatchIcon component gains a folder glyph. No new component layer or
external dependency is introduced. Home's layout is retained; its normal 393px
screenshot matched the baseline byte-for-byte in the first post-change run.

## Behavior boundaries

Product behavior, IA, API/backend/domain, database/schema/migrations, auth,
ownership, AI consent, Retention, Streak qualification, Due Count, and Continue
Learning changes: **NONE**. Only JSX presentation and CSS changed in application
code. Existing handlers, data calculations, labels, and action targets remain.
Legacy assets remain available to other consumers.

## Validation

- `npm run test:unit`: 250 passed, 0 failed/skipped.
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 13 existing unused-variable warnings. The edited
  browser script's pre-existing unused-expression warning was removed.
- `npm run build`: passed; web artifact sealed. Initial sandboxed attempt could
  not fetch Google Fonts; rerun with network access succeeded.
- `npm run mobile:build:local`: passed; development mobile artifact sealed.
  Existing large-bundle warning remains. No distribution/release build or iOS
  device test was performed.
- `npm run test:ui-browser`: passed. Real screen components in isolated display
  fixtures cover 320/393/430/768px, long Japanese labels, English, empty Sets,
  search-to-detail, folder/move forms, editor, set/card study targets, last-card
  reachability above navigation, import gating, Settings, and all existing Home,
  preview/completion/focus/authoritative-streak cases.
- `PATCH_ENV=development NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' npm run test:integration-browser`:
  passed using an isolated DB and test signing key. Home -> Preview -> U2 six
  activities -> durable completion -> Home; consent, retry/lost response,
  reload/resume, account/logout isolation, and unchanged Continue/Due/Streak.

Selected mobile screenshots and validation logs are retained locally under
`outputs/visual-consistency/` (gitignored). Browser QA used Chromium mobile
viewports, not a physical iOS device.

## Deferred visual work

Auth/onboarding and legacy card-study/AI conversation screens still have their
own older styling. U2 Lesson's existing presentation and behavior remain intact.
Public legal/support pages and detailed account/privacy/deletion flows were not
individually restyled or visually audited in this pass. No merge or deployment.
