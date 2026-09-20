# Add Material checkpoint

This records the first-half checkpoint `b343bbb`. The subsequent Review/Ready implementation is documented in [add-material-review-checkpoint.md](add-material-review-checkpoint.md).

Branch: `codex/patch-add-material`, based on `d382da8` (current Home reference work).
Worktree: `/private/tmp/patch-add-material`. The original worktree, Dev, main and production are unchanged. No push or deployment.

## Implemented

Prompt 01–07: Destination (new/existing), material input (empty/accepted files), Customize (whole/focus), and generation-only Preparing. Successful generation hands the actual cards, summary and source to the existing editable review/save screen. Nothing is saved by selecting files or generating.

One account-scoped workspace holds the step, destination, retained existing selection, text, extracted attachments with size/status/errors, detail, format, coverage, retained focus, generation status/key/fingerprint and result. Back, settings, navigation and component remount preserve the draft. Old workspace drafts remain readable. Interrupted file parsing becomes an explicit reselect-file error.

Generation remains an explicit event using `useApi` → PrivacyProvider → account transport → `/api/ai/cards` → existing durable AI admission/provider. A synchronous lock prevents double submit. A persisted operation UUID is reused after uncertain failure/reload; there are no automatic retries. A completed unchanged draft is reused. Current-input and component/account fences reject stale results. Preparing has no active Back/Cancel action; failure offers Retry and Back to Customize. Leaving through existing app navigation does not resubmit work.

## Contract mapping and deferred work

- **SAFE:** 3-step UI, native picker, selection, focus input, per-file validation, failure recovery, retained draft, accessibility, mobile layout and supplied mascots.
- **MAP:** Existing destinations are the real owned `AppData.sets` shown in the current Patches library. Existing `saveSet` / `addCardsToSet` saving is retained; appending does not rename the destination or replace cards/progress. No sample names are shipped as production data.
- **MAP:** Detail uses `要点のみ` / `標準` / `詳しく`; format uses `一問一答` / `4択問題`. One optional `focus` field (1–1,000 characters) is added to the **existing** cards endpoint and provider preparation. It is separate from source text, is omitted in whole mode, and is treated only as a source-bound filter. No second AI request, new endpoint or model is introduced.
- **MAP:** The existing parser accepts PDF, DOCX, PPTX, TXT, MD and CSV, at most 5 files, 10 MB each, text PDFs up to 200 pages. Source input must contain 80–30,000 combined characters. Limits are now shared between parser/UI/cards route. Existing AI admission also has a stricter aggregate UTF-8 input budget; copy and a specific recoverable error explain that shorter excerpts may be necessary.
- **DEFER:** Short-topic-only knowledge generation conflicts with the existing source-only instruction and minimum 80-character contract. It is not padded with invented source text or routed through another AI call. Short input is explained and blocked; material coverage is hidden if a short input reaches Customize through restored state.
- **DEFER:** Automatically turning generated cards into U2 Patch/Source/Objective/Activity/Lesson entities needs a separate domain workflow. This change keeps the currently working collection-based create/append pipeline. It does not claim to create a U2 Lesson.
- **OUT OF SCOPE:** Prompt 08–11 redesign, outcome reconciliation, preference sheet, final Ready design and a new save idempotency contract. The existing review/save UI remains available as the handoff.

Authentication, ownership, account isolation, AI consent, Retention, Streak qualification, Due Count and Continue Learning contracts are unchanged. DB/schema/migrations: **NONE**. Dependencies: **NONE**.

## Visual references and assets

The actual seven matching Downloads files were named `prompt1.png` … `prompt7.png`, not `patch1*` … `patch7*`. All seven were inspected alongside Prompt 01–07 in `Add Material Prompt.docx`. The separate `patch-1` / `patch-2` / `patch-3` files were not treated as screen references.

Destination reuses `public/patch/mascot-hello.png`, identical to Downloads `Hello Patch.png`. Preparing uses Downloads `Finding Patch.png`, copied unchanged to `public/patch/mascot-finding.png` (1269×1239, transparent PNG; SHA-256 `173f761a60af8e2f9b9766a989891b846c12b1ce893769aca70fe552be50772c`). No asset generation, cropping, recoloring, or new unresolved asset request. The supplied export differs slightly from the screen illustration; it is used as the approved standalone artwork.

The UI uses shared evergreen/mint/blue-gray tokens, scoped navy reference text, real controls and the existing icon system. OS status/home bars are not drawn into the app. Profile opens the existing settings dialog. Step 1 keeps the existing navigation; steps 2/3 and Preparing hide it. Extra input-limit/help/error copy is intentional. The accepted-file QA fixture is a real text file, not a fake PDF.

## Validation

- Node 22.23.2: `PATCH_ENV=development npm run check` — typecheck, lint, **257 tests**, Web build and artifact seal pass. Lint retains 13 pre-existing unused-binding warnings, zero errors.
- `npm run mobile:build:local` — passes with existing large-chunk warning; mobile artifact sealed.
- `npm run test:build-patch-browser` — Prompt 01–07, real file parser, destination loading/error/empty, per-file errors, no generation on upload, strict-mode duplicate guard, uncertain retry identity, remount/stale results, actual draft handoff and no premature save.
- Screenshots compared at 390×844. Additional 320×568, 430×844 and 768×844 layouts, long focus, reduced viewport/keyboard-height simulation, enlarged text and reduced motion. No horizontal overflow; actions and focused fields remain reachable. Actual iPhone software keyboard/VoiceOver have not been exercised on hardware.
- Existing UI, authenticated U2 integration, auth and privacy browser suites pass. Shared worktree dependencies produce font allow-list warnings in older auth/privacy harnesses; the dedicated visual harness uses the correct asset allow-list.
- Existing onboarding regression passes after updating it to wait for the current Home/completion components rather than obsolete Japanese headings. Its assertions for Day 1 and Retention remain intact.

Reproduce new UI QA with `npm run test:build-patch-browser`; screenshots are generated under `outputs/add-material/` (ignored). Tests use isolated fixtures and never contact the live AI provider or production database.
