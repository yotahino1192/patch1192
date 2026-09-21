# Release-readiness validation — 2026-09-21

Base verified after `git fetch origin`: local Dev and origin/Dev both **7e5335b240ffec3512cae717904333f496188de4**. New branch `release/testflight-readiness-20260921`, worktree `/Users/hinoyouta/Documents/Yota-parallel/.worktrees/testflight-readiness`; initial status clean. One checkpoint commit holds this pass; no merge/push/deploy, Production DB, Apple account or main operation.

## Results

| Validation | Observed result |
| --- | --- |
| Toolchain/dependencies | Node **22.23.2**, lockfile `npm ci --ignore-scripts --no-audit --no-fund` successful in isolated worktree |
| `PATCH_ENV=development npm run typecheck` | PASS (`next typegen`, `tsc --noEmit`) |
| `npm run lint` | PASS: 0 errors; **11 existing** unused-variable warnings in app/language, app/page and lib/workspace |
| `PATCH_ENV=development npm run test:unit` | **297/297 PASS**, 0 skipped; includes auth/privacy/deletion, AI, current Free v1 and production positive/negative guards |
| `PATCH_ENV=development npm run test:infra` | **33/33 PASS**: production config/secret/artifact/migration/runtime/operational and restore tests |
| Final affected operations tests | **6/6 PASS** after final reference-format and worker canonical-origin regression assertions |
| `PATCH_ENV=development npm run db:rehearse-local` | **2/2 PASS**: real encrypted temporary snapshots, scratch restore, schema/FK/integrity/exact rows/rowids, real app reads/replay/undo/session, consent/deletion isolation and mocked provider, wrong-key/tamper failures |
| Additional Free v1 restoration | Full suite passes existing MCQ receipt/replay, topic provenance and deletion/other-account preservation after encrypted restore (`tests/free-v1-learning.test.mjs`) |
| `PATCH_ENV=development npm run build` | PASS: Next optimized build with explicit **development deployment identity**, sealed Web artifact; not a Production-configured candidate |
| `PATCH_ENV=development npm run ios:sync:local` | PASS: development mobile build/seal/sync; existing Vite >500 KB chunk warning |
| Simulator compilation | PASS: Xcode **26.1.1**, SDK **26.1**, Debug generic iOS Simulator, `CODE_SIGNING_ALLOWED=NO`; private DerivedData/SPM copy; four SPM checkout revisions match committed lockfile |
| Native release guard | Debug Simulator `.app` correctly rejected with `IOS_DEBUG_ENABLED`; copied/compiled development artifact inventory and hashes verified independently |
| Empty Production release gate | Correctly BLOCKED, exit 1: `CONFIG_INVALID:API_ORIGIN` with ambient DEBUG unset. Original ambient DEBUG also correctly rejected (`CONFIG_INVALID:DEBUG`); no bypass added |
| Operational handoff gate | Correctly BLOCKED, exit 1: missing monitoring receiver/responder/evidence, scheduler/evidence, backup storage/custody/objectives/evidence references; synthetic complete handoff passes offline tests |
| Schema/secret/diff checks | PASS in build prechecks plus final review; no fixture values or credentials committed; no schema/migration changes |
| Device / signing / Archive / Apple Validate / upload / TestFlight | **NOT RUN** — external values, Apple access and physical devices required |

Initial `npm ci` could not complete within sandbox network restrictions. Web build initially failed to fetch existing Google Fonts; Xcode initially could not write its system Swift caches. Retried with permitted dependency/font access and local Xcode cache use; builds passed. No product/guard changes were made to bypass these environmental failures. No remote provider or DB was contacted by unit/recovery fixtures.

## Scope and evidence limits

This patch only changes release configuration guards/CI, operational configuration validation/templates/tests and documentation. App UI, learning/grading/session/retention, native runtime, DB/schema/migrations, public legal values, version/build and production policy values are unchanged. Native icon/splash hashes match the prior inspected release assets and remain owner-unapproved Capacitor defaults.

Generated build artifacts are ignored. They are rebuilt on the checkpoint HEAD to bind their metadata to that commit; any later integration/config commit requires another rebuild. These local development/Simulator artifacts are not uploadable Production artifacts. Positive Production release tests use isolated synthetic artifacts/configuration; no fake live values were entered into repository policy.

No browser-only smoke run is claimed for this pass; existing browser checks remain in CI. No real mail/AI/Clerk/Turso/scheduler/log provider/offsite backup behavior or production-sized recovery timings were verified. Scratch restores are deleted; production replacement import/cutover and post-snapshot reconciliation remain service-specific operational preparation after provider selection. Monitor and evidence references prove handoff completeness only, not authenticity/health of those services.

Local logs (not committed): `/private/tmp/patch-readiness-check.log`, `patch-readiness-infra.log`, `patch-readiness-operations-final.log`, `patch-readiness-restore.log`, `patch-readiness-web.log`, `patch-readiness-mobile.log`, `patch-readiness-simulator.log`, `patch-readiness-release-negative-clean.log`, `patch-readiness-operations-negative.log`. Final artifact verification/build logs use the same prefix with `checkpoint`.

[Master next steps](testflight-go-live-runbook.md) · [remaining A–E blockers](release-readiness-audit.md).
