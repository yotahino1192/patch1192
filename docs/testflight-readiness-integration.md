# TestFlight / Production-readiness integration — 2026-09-21

Fetched Dev before: **8ab9f4847c67c27e322c70366c834f40b2e6ce51** (local Dev = origin/Dev). Verified readiness branch `release/testflight-readiness-20260921` at **d5ef61d3d18f8cf756a8e821c972fcf6960f6fd0** with a clean working tree; Dev worktree was clean too.

Latest Dev was merged into the readiness branch at `5285f51b2803acb7039c5951fb145067bdc1e67f` without conflicts. The 15 files introduced/changed by the reliability integration match Dev exactly, including UI, server Study Session behavior, ownership/revision fences, Retention/Streak, Explain/AI Hardening and their regression tests. Relative to Dev, the original readiness patch remains limited to release/infrastructure, validation/operations and documentation. This follow-up adds only integration documentation; no product feature, UI, DB/schema/migration or native behavior changes.

## Validation

Node **22.23.2**, existing isolated dependencies with unchanged lockfile. All automated checks use explicit development identity and isolated fixtures; browser live AI is explicitly disabled (`PATCH_LIVE_AI_QA=0`). No Production DB or external auth/AI provider operation is used.

| Check / command | Result |
| --- | --- |
| `PATCH_ENV=development npm run check` | PASS: typecheck, lint, full unit suite and Web build |
| Full `tests/*.test.mjs` suite | **302/302 PASS**, zero skipped, including reliability regressions and encrypted MCQ/provenance/deletion restoration |
| Lint | Zero errors; 11 pre-existing unused-variable warnings |
| `PATCH_ENV=development node --test tests/infra-*.test.mjs tests/privacy-lifecycle.test.mjs tests/ios-release.test.mjs` | **48/48 PASS**: Production positive/negative guards, migration checks, deletion auth/leases/retries/isolation, backup/restore, operational status/config and native release guards |
| Backup/restore within those suites | Both isolated restore cases pass: encrypted snapshot, exact schema/rows/rowids, real application reads/replay/undo/session, consent/deletion fences; wrong-key/tamper rejected. No Production data |
| `PATCH_ENV=development npm run ios:sync:local` | PASS: mobile build/seal/sync; existing Vite large-chunk warning |
| Xcode Debug generic iOS Simulator | **BUILD SUCCEEDED**, Xcode 26.1.1 / SDK 26.1, `CODE_SIGNING_ALLOWED=NO`, dedicated DerivedData and isolated SPM checkout |
| Browser: auth / privacy / onboarding / build-review | All PASS; the last includes Topic/Text/PDF × Flashcards/MCQ, offline/retry/lost response, selected-answer reload, same-key replay, Continue/Explain cancellation and exactly-once completion |
| `env -u DEBUG PATCH_ENV=production npm run check:release` | Expected **BLOCKED**, exit 1: `CONFIG_INVALID:API_ORIGIN` because real Production values are absent. Synthetic complete Production checks pass; no guard weakened |
| `npm run check:operations` | Expected **BLOCKED**, exit 1: actual monitoring/scheduler/backup values and evidence references are still empty |
| `npm run check:ios-release -- --app <Debug-Simulator-App.app>` | Expected **BLOCKED**: `IOS_DEBUG_ENABLED`; development bundle inventory/hashes pass independently |
| Source/diff checks | All 15 reliability files equal latest Dev; every non-document readiness change equals approved checkpoint `d5ef61d`; no new product changes; `git diff --check` clean |

The integration documentation is the only follow-up change after those code tests. Web/mobile/Simulator artifacts are rebuilt on the final integration commit and checked for matching commit SHA and exact inventories before Dev promotion. Dev can fast-forward to the same validated branch commit; a new merge artifact is not substituted.

Local logs use `/private/tmp/patch-readiness-integration-`: `check.log`, `guards.log`, `release.log`, `operations.log`, `mobile.log`, `simulator.log`, `native-guard.log`, `auth-browser.log`, `privacy-browser.log`, `onboarding-browser.log`, `review-browser.log`. Final committed artifacts/sanity logs use `final-` after that prefix. Outputs are ignored, not tracked deliverables or uploadable Production artifacts.

## Promotion and remaining gates

Promotion is limited to Dev and explicit `git push origin Dev:Dev` after a fresh fetch/clean-tree/ref comparison and final sanity. main remains `dd5d6d7a02fcdf6109e032173232ce03f9feee37`; no Production deployment or Apple account changes. Verify remote Dev equals the promoted local commit after push; the final task report records that exact SHA/result.

Yota still supplies real origins/provider identities, secrets through secret management, 19 legal values, branding/reviewer access and operational owners/objectives. External configuration still includes Clerk/Turso/AI, authenticated deletion scheduling, alert delivery, backup custody/offsite verification and Production recovery rehearsal. Apple membership/IDs/App Group/signing/Validate/upload and signed physical-device QA remain unperformed. These do not require reverting completed reliability fixes or enabling deferred features.

[Master runbook](testflight-go-live-runbook.md) · [A–E blockers](release-readiness-audit.md) · [original preparation evidence](release-readiness-validation-20260921.md).
