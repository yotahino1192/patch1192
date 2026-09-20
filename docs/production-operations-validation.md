# Production operations validation — 2026-09-21

Branch: `codex/patch-production-readiness`; isolated worktree `/private/tmp/patch-production-readiness`. Base and remotely reconfirmed Dev: `716d298d8361d217eb1c16ec898a1958861a91bc`. No merge/push/deploy, production DB/provider operations or Apple account operations performed.

## Executed results

| Check | Result |
| --- | --- |
| Node / locked dependencies | Node 22.23.2; isolated `npm ci --ignore-scripts --no-audit --no-fund` succeeded |
| Typecheck | PASS (`next typegen`, `tsc --noEmit`) |
| Lint | PASS, zero errors; 13 existing unused-variable warnings in app/language, app/page, lib/workspace |
| Full unit suite | **258/258 PASS**; environment, worker targeting/auth/outcome, aggregate monitoring privacy/read-only behavior, CLI diagnostics, auth observability and all existing lifecycle/AI/infra/domain/retention regressions |
| Web build | PASS, production-mode Next build using explicit development deployment identity; web artifact sealed |
| Mobile / local iOS sync | PASS, development artifact sealed and synced; existing >500KB Vite chunk warning |
| Simulator | PASS, Xcode 26.1.1 / SDK 26.1, Debug generic iOS Simulator, `CODE_SIGNING_ALLOWED=NO`, isolated DerivedData |
| Copied / compiled bundle | PASS exact mobile artifact inventory/hashes; native release gate correctly rejected Debug Simulator app (`IOS_DEBUG_ENABLED`) |
| Local recovery rehearsal | **2/2 PASS** via `npm run db:rehearse-local`; encrypted backups, isolated file restores, exact hashes/rows/schema/integrity and real application readers/invariants, mocked deletion provider |
| Auth browser | PASS: auth gate, scoped hydration/reload, account switch, stale native response, logout and interrupted logout |
| Privacy browser | PASS: consent, in-flight revoke/switch/logout cancellation, deletion reverification UX, lost receipt recovery and scoped cleanup |
| Production release validation | Correctly **BLOCKED** with empty production environment: `CONFIG_INVALID:API_ORIGIN`. Synthetic offline release positive/negative tests passed within suite; no invented production credentials |
| Release scope / source diff | No changes to UI, domain/learning, AI control/provider/recovery, deletion-worker lifecycle algorithm, DB/schema, retention, native/mobile config, version/build or legal published values |

First complete test run exposed an extra generic success log breaking existing `ai:control status` JSON parsing. Corrected command wrapper to emit new records only for explicitly named infrastructure operations. The complete rerun passed all 258 tests; no existing AI CLI output contract was weakened.

Builds before the branch commit validate the code changes but initially record the base SHA. Web/mobile/Simulator artifacts must be rebuilt on the committed HEAD (and again after any integration merge); artifacts are ignored, not committed. These are local development artifacts, never distributable production candidates. Final copied/compiled mobile artifact hashes and Simulator rejection by the release gate are checked separately after build.

Local logs (not committed): `/private/tmp/patch-production-check-final.log`, `patch-production-mobile.log`, `patch-production-simulator.log`, `patch-production-restore.log`, `patch-production-auth.log`, `patch-production-privacy.log`. They are local evidence, not external monitoring setup.

## Remaining blockers / integration boundary

- Production/staging public policy, live provider credentials/ownership, mail delivery, schema setup and authorized smoke tests are still external work. New worker secret requirement also affects **staging** builds/DB CLIs; configure before integration there.
- Scheduler template is disabled. Persistent jobs can continue without the app **only after** an authorized runner is operational. Real scheduler heartbeat, throughput, alert delivery and provider-outage drill remain unverified.
- No monitoring provider/alert recipient, backup retention/custody/offsite storage, production-sized restore, RPO/RTO or remote cutover implementation verified.
- AI unknown stays reserved until safe operator reconciliation. Add Material fix `ab8192c` was inspected read-only; its control/diagnostics/operator code remains identical at that branch's later `70061ea` (Dev merge). It is not in this branch's Dev baseline. No self-service resolution or feature integration added.
- Legal fields remain draft. [Owner input list](release-owner-inputs.md) classifies all 19 fields and other release values.
- Apple membership, final IDs/Team/App Group, signing, Clerk native registration, optional Apple revocation, real-device QA, final icon/splash/screenshots/metadata and store review remain outstanding. Advanced Lesson/Pro/Creator/Video are not Free v1 blockers.
- No physical device, distributable signing, archive validation by Apple, upload, TestFlight or App Store success claimed.

Other sessions advanced Add Material to `70061ea` and Home to `33e3e5d` during this work. Only their references/diffs were read; no checkout, edit, test, commit or merge was executed on those branches. Main remains `dd5d6d7a02fcdf6109e032173232ce03f9feee37`.
