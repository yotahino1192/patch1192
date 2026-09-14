# UI phase 1 verification

Baseline: Dev `50ef687`, 224 tests. Designer inputs preserved at `66aeaee`. Implementation is isolated on `codex/ui-phase1` in `~/Documents/Yota-ui-phase1`.

## Results

- Node 22.23.2: full suite **229/229 PASS** (224 retained, five presentation/domain-mapping checks added).
- Typecheck PASS. Lint: **0 errors, 39 existing warnings** (baseline 41); no unrelated warning cleanup.
- Guarded production Web compilation, environment/schema/secret checks and artifact seal: PASS. Local development configuration only.
- Mobile development bundle + artifact seal + Capacitor sync: PASS.
- Unsigned generic iOS Simulator App build, including embedded PatchWidget: PASS. Existing cached Swift packages; no signing/Team/Apple configuration changes.
- Swift Retention/Widget policy executable: PASS.
- Browser regressions: auth, privacy/deletion/AI consent, onboarding/Study/Retention/deep links, reliability, public pages: PASS. Health/readiness HTTP: PASS.
- UI browser: actual Home/Shell/Study components, all seven states, 393×852 captures; 320×568, 430×852, 768×852 reflow; English/Japanese and long name: PASS. Native dialog opening/closing/Escape/Start, saved-session GET-only duration, and rejection of a late previous-session estimate: PASS.
- Actual API browser coverage: preview title follows the Continue resolver (due review can outrank new material), opening/closing does not create a session, Start enters the existing Study UI and creates the session through its existing handler.

Browser runs use isolated identities/databases and test-only SDK/native boundaries. Visual fixtures are only under `tests/fixtures`; production entrypoints do not import them. Initial harness issues from shared dependency paths and asynchronous navigation were corrected before passing runs. No production DB, deployment, migration, secrets, main branch or Developer settings were modified.

## Visual review

Reviewed `outputs/ui-phase1/{empty,normal,hot,broken,completed,complete,stale}-393.png`, `preview-393.png`, `resume-preview-393.png`, `preview-ja-long-320.png` against the supplied images. Captures/measurements are reproducible via `npm run test:ui-browser` and remain ignored development output.

Corrected CSS precedence, completion/early-state whitespace, button sizing, narrow Japanese label wrapping, mascot crop edge, vector navigation scale/colors, and iPhone safe-area spacing. Preserved current four navigation destinations and Settings access.

Remaining intentional differences: recently studied sets instead of unsupported sequential chapters/locks/milestones; Today’s Due/ToDo and real paused-session access remain available; two supported result metrics instead of three invented concept metrics; existing Undo, next-review and AI recap may extend completion below the initial viewport. New sessions have no duration until planning; saved sessions use the read-only Domain estimate. Original standing art has a sticker border; reference-extracted reading/celebration art retains some paper texture. See `ASSET_REQUESTS.md` for transparent master specifications.

## Final visual and interaction review — 2026-09-14

Reviewed implementation baseline `f8ae32b` against every supplied state at 393×852. Fresh actual-component captures are in `outputs/ui-final-before/` and `outputs/ui-final-after/`; the latter also contains 320×568 and 430×852 captures, a long Japanese sheet before/after scrolling, and Home reached through the real completion component's Home action. These are test-only display fixtures, not hardcoded production state. Actual authenticated API flow is additionally covered by the onboarding browser regression.

### Fixed

- Reduced oversized circular Continue CTA from 176px to 146px including its mint outline, and done status from 166px to 138px. Tightened recent-set rows, two-line labels, streak height and spacing; full set names remain in the accessible button text/title. The completed Home's available continuation action is now visible above navigation at 393×852.
- Aligned greeting horizontally/vertically, enlarged the early standing mascot and moved its CTA from approximately y537 to y559, near the reference y557. Adjusted button typeface/weight, completion heading, success line height and results-card spacing.
- Moved preview above the dimmed navigation, removed the browser's narrower default dialog width, and bounded its height by viewport/safe-area insets. Long content scrolls to an operable Start action at 320×568.
- Refined the nested flame and Continue chevron as SVG; restored small hot-streak/completion accent rays using CSS. Filled the gap beneath the fixed navigation to prevent underlying text showing through. Reduced navigation label size at <=360px to prevent English labels crowding each other.
- Documented exact filenames, references, dimensions, alpha requirements and current defects for three mascot masters in `ASSET_REQUESTS.md`. No better originals were present; no generic substitute was introduced.

### Preserved differences

- Existing four navigation destinations and Settings remain. Browser screenshots do not fake the iOS status bar/home indicator.
- Current Today’s ToDo and the explicit “Recently studied” label occupy space absent from the reference; the real three most recently studied sets are not a sequential chapter path. No completion badge, locked lesson or milestone was invented.
- Titles, summaries, counts and streak state come from current data. Optional rows appear only when their real destinations exist; saved sessions alone have a read-only duration estimate. Empty Home uses the existing import/sample actions.
- Lesson Complete has two supported results (cards/retries), not three unsupported concept metrics. Existing Study Again, Undo, next-review and AI recap can extend the page; short mobile heights scroll naturally.
- Standing art still has its original sticker edge; reading/celebration crops still retain paper texture. Final transparent masters remain outstanding.

### Interaction evidence

Extended the actual-component browser check to verify trigger focus restoration, inert Home controls while tabbing (browser chrome can receive focus), backdrop dismissal, navigation clearance, long-description scrolling/Start, completion-to-Home, and rerendering directly from updated authoritative hot/broken/completed snapshots. Existing no-write-on-open, saved-session GET estimate and stale estimate rejection checks still pass. No production interaction/domain regression was found; changes are confined to presentation and its regression harness.

### Final validation

- Unit/API tests: **229/229 PASS**; typecheck PASS; final lint **0 errors / 39 pre-existing warnings**.
- Final Web build, guards and artifact seal PASS; final mobile development build, artifact seal and Capacitor sync PASS.
- Unsigned iOS Simulator App + embedded Widget build PASS; Swift Retention/Widget executable PASS. Native runtime visual inspection was not performed in this pass; visual/interaction inspection used actual rendered browser components, including mobile widths.
- UI browser PASS at 320/393/430/768 widths, including all requested states and added interaction checks. Auth, privacy, onboarding/Study/Retention/deep-link, reliability browser, public-page browser and reliability HTTP regressions all PASS.
- Onboarding's first attempts stopped before mounting UI because the local Clerk publishable key did not match the isolated fixture issuer (`CLERK_HOST_MISMATCH`). Re-running with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=''` only in the test process passed; no user environment file or production auth code was changed. A test-fixture render-time assignment flagged by lint was moved into an effect before the passing run.
- Reproduce with Node 22 and `PATCH_ENV=development`. For authenticated fixture regressions, also set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=''` in the command environment. All tests use isolated data; no backend/domain behavior, Dev merge or deployment was introduced.

## Mascot replacement checkpoint — baseline `a792372`

Changed files: `app/mascot.tsx` (new canonical registry/renderer), `app/mascot.css` (new shared presentation rules), `app/globals.css` (imports those rules), `app/patch-ui.tsx` (old renderer removed), `app/home-screen.tsx`, `app/lesson-preview.tsx`, `app/lesson-completion.tsx` (shared renderer imports), `scripts/check-ui-phase1-browser.mjs`, `design/ASSET_REQUESTS.md`, and this QA record.

The three final PNG URLs are centralized. Standing tries its final PNG and falls back once to the existing JPEG; reading/celebrate retain their working crops at the canonical filenames until overwritten. Fixed presentation aspect ratios plus centered `object-fit: contain` preserve the box with differently sized incoming artwork. All mascot placement/size/breakpoint rules are in one stylesheet; artwork owns its ground shadow/rays, with no new overlays. The asset request lists every current usage, all three **PENDING FINAL ARTWORK** statuses and the drop-in replacement steps. No asset pixels or backend/domain/Retention/lesson/navigation/native code changed.

Validation: 229/229 tests PASS; typecheck PASS; lint 0 errors / 39 existing warnings; Web build and artifact seal PASS; mobile development build and artifact seal PASS. UI browser and authenticated onboarding/Study/Retention/deep-link browser regressions PASS. Verified canonical PNG priority, unchanged mascot/neighbor/CTA geometry with a different-aspect-ratio replacement PNG in all three poses and the preview, and bounded fallback behavior even when both standing URLs fail. Replacement image responses exist only in the test server; public files are untouched. CSS is loaded through the existing global stylesheet entry so Node SSR checks remain compatible. Swift/Simulator checks were not rerun because native code/resources and the presentation geometry were unchanged.

Current captures: `outputs/ui-mascot-prep/`. Fresh baseline captures: `outputs/ui-mascot-baseline/`, rendered from `a792372` in a disposable checkout, with the working branch unchanged.

Fresh comparison result: 22/26 captures were pixel-identical excluding the transient right-edge scrollbar. The remaining four had at most 4/255 channel-value differences, consistent with rasterization/scrollbar variation; visual inspection found no position, size or whitespace change. Standing, reading, celebration, preview, completion and responsive states retain the baseline composition. Details are saved in `outputs/ui-mascot-prep/pixel-comparison.json`.
