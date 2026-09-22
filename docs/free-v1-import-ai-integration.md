# Free v1 import / MCQ integration verification — 2026-09-23

## Physical iPhone verification (reported by the user)

Checkpoint: `707c1479895a308ae4f86b682034fea783f71725`.

- Native Files picker: PDF selection, text extraction, and continuation to Customize passed without a file-read error.
- Native Files picker: TXT passed.
- Text → Multiple Choice → Generate Patch → Review → Save → Study passed, including valid choices and grading.
- This confirms PDF/TXT on the physical picker. It does not extend that physical-picker claim to DOCX/PPTX/MD/CSV.

## Dev integration preflight

Fetched `origin/Dev`: `5768c6bce7f19fb70a7e274c7f2d3789675f73b2`.
That commit is already an ancestor of the checkpoint; merging it into the diagnosis branch returned “Already up to date.” No conflicts or newer remote changes were found.

An isolated worktree was used so personal Xcode signing and icon changes in existing worktrees stayed local.
One older integration test omitted the `contentRevision` required by the existing Dev review endpoint and correctly received HTTP 409. Its request now includes the fixture card's actual revision and review count. No application validation was weakened or changed for integration.

## Regression results

- Typecheck: passed.
- ESLint: zero errors, 11 existing warnings.
- Full unit suite: 331 passed, zero failed; includes MCQ contracts, Flashcards, idempotency, unknown handling, budget accounting, native timeouts, auth, Study and Retention.
- Web build and Development mobile build / `ios:sync:local`: passed; artifact inventories validated.
- Unsigned Debug iPhoneOS arm64 build (App and PatchWidget): passed.
- Chrome document import and macOS WKWebView `capacitor://` import: PDF, DOCX, PPTX, TXT, MD, CSV produced expected synthetic text and continued; malformed/unsupported inputs and size/count limits passed.
- Browser suites passed: document import, Build Patch, Build Review, auth, privacy, reliability, Patch integration, UI phase 1, onboarding, domain lesson, and My Lesson.
- Build Review covers fixture-provider Flashcard/MCQ generation, Review/Save/Study, grading, interrupted responses, same-key retry and exactly-once completion.
- Some older browser fixtures emitted Vite font allowlist warnings with the shared dependency symlink; their functional assertions passed. Dedicated import/UI/Review suites and native builds also passed.

No additional real-provider call, Production deployment, Production database access, or main-branch change was performed for this integration verification.
