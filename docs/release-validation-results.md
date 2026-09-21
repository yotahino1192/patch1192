> Historical implementation/validation record. Current blockers and command order are in [the master runbook](testflight-go-live-runbook.md); current evidence is in [the 2026-09-21 pass](release-readiness-validation-20260921.md). Old missing-feature statements below are not current blockers.

# Release preparation validation — 2026-09-20

**Historical first-pass results.** For the current Dev-based candidate, see [Dev compatibility review](release-dev-compatibility.md).

Original baseline d382da8; changes on codex/patch-release-preparation in `/private/tmp/patch-release-preparation`. Checked with Node **22.23.2**, Xcode **26.1.1 (17B100)** and Simulator SDK **26.1**. Tests below ran on the release-preparation code, before the final documentation commit. These are development/local checks, not a production release certificate.

| Check | Observed result |
| --- | --- |
| Dependency install | `npm ci --ignore-scripts --no-audit --no-fund` succeeded with locked dependencies using Node 22 and network access; first restricted-network attempt failed. No lockfile/dependency changes |
| Typecheck | `PATCH_ENV=development npm run typecheck` (inside npm run check): PASS |
| Lint | `npm run lint`: PASS, 0 errors / **13 existing unused-variable warnings** in app/language.tsx, app/page.tsx and lib/workspace.ts. Protected UI files unchanged |
| Unit suite | `PATCH_ENV=development npm run test:unit`: **253 passed, 0 failed, 0 skipped**. Includes 3 new native release/sealing tests; existing environment, auth, privacy, domain, migration and restore suites run locally |
| Web build | `PATCH_ENV=development npm run build`: PASS, WEB_ARTIFACT_SEALED. Initial restricted run failed fetching Google Fonts; network-enabled retry succeeded |
| Mobile build / sync | `PATCH_ENV=development npm run ios:sync:local`: PASS, MOBILE_ARTIFACT_SEALED. Existing >500 kB chunk warning; no new UI optimization attempted |
| Copied bundle integrity | validateArtifact on `ios/App/App/public`, expected environment development: PASS after stub fix. Before fix, sync introduced unsealed zero-byte cordova.js and cordova_plugins.js; regression test now verifies exact inventory and rejects tampering |
| Simulator Debug build | Isolated `xcodebuild ... -configuration Debug -destination 'generic/platform=iOS Simulator' ... CODE_SIGNING_ALLOWED=NO build`: PASS. First sandbox attempt could not access Xcode/Swift caches/CoreSimulator; approved cache/service access retry succeeded |
| Built native inspection | App and embedded Widget both **1.0 (1)**, minimum OS **17.0**, families **[1,2]**; App URL name resolves to bundle ID, scheme patch, capability arm64. App, Clerk_ClerkKit.bundle, Capacitor.framework and Cordova.framework each contain PrivacyInfo.xcprivacy; no ClerkKitUI/Nuke/PhoneNumberKit resource bundle in built app |
| Release shell preflight with development bundle | Expected rejection: IOS_NATIVE_CONFIG_VALID followed by **ARTIFACT_METADATA_INVALID**, exit 1. Production gate not bypassed |
| Xcode Release negative test | Expected rejection, exit 65: Verify mobile bundle emitted IOS_NATIVE_CONFIG_VALID then ARTIFACT_METADATA_INVALID. Release Widget Info.plist still confirms inherited 1.0 (1). No bypass/production credentials used |
| Production mobile configuration | `PATCH_ENV=production npm run mobile:build`: expected refusal **CONFIG_INVALID:API_ORIGIN** with absent real config |
| Production offline release gate | `PATCH_ENV=production npm run check:release`: inherited DEBUG initially rejected; clean command environment (`env -u DEBUG`) then rejected **CONFIG_INVALID:API_ORIGIN**. This is a negative test, not a successful production check |
| Secret scan / plist / diff | npm run scan:secrets: SECRET_SCAN_OK; plutil Info.plist and project syntax valid; git diff --check passes |
| Final `.app` release validator | Logic covered by tests (remote-server/debug overrides, version/identity mismatch, SDK/capabilities/resources, sealed-file tampering). Real production device archive positive path **NOT RUN**, since production config/signing is unavailable |
| Browser interaction / physical device / App Store | Browser interaction not rerun for this non-UI change; physical device, signed device archive, Apple Validate, upload, TestFlight and App Review **NOT RUN** |

The original `npm run check` composite exited nonzero solely at its final web build's blocked font download; its typecheck, lint and initial 252 tests passed. The separate successful web build and final 253-test run are reported individually instead of claiming the initial composite passed.

Raw local logs (not committed): `/private/tmp/patch-release-check.log`, `patch-release-unit-final.log`, `patch-release-lint-final.log`, `patch-release-web.log`, `patch-release-mobile-final.log`, `patch-release-ios.log`, `patch-release-ios-final.log`, `patch-release-ios-release.log`, `patch-release-prod-check-clean.log`, `patch-release-prod-mobile.log`. Logs may be temporary; this file preserves conclusions.

## Change inventory

- Native config: `ios/version.xcconfig` (new single version/build source), `ios/debug.xcconfig`, `ios/App/App.xcodeproj/project.pbxproj`, `ios/App/App/Info.plist` (derived URL name, arm64 capability).
- Build guards: `scripts/infra/ios-release.mjs`, `scripts/check-ios-release.mjs`, `scripts/check-ios-bundle.sh`, `scripts/seal-mobile-artifact.mjs`, `package.json` (`check:ios-release`), `tests/ios-release.test.mjs`.
- Documents: `release-readiness-audit.md`, `testflight-release-runbook.md`, `app-store-metadata-draft.md`, `physical-device-release-qa.md`, `store-asset-inventory.md`, this file.

No Add Material/Review/Ready/Home/Lesson/shared styling, domain/streak logic, DB schema/migrations, production DB/secrets, other worktrees or main/Dev branch changed. Worktree/branch created from the supplied clean checkout, and only the scoped release changes are committed. No merge/push/deploy/account operations.

Before creating an actual candidate, commit all selected changes then rebuild/reseal at that commit: the existing artifact guard deliberately rejects artifacts with another HEAD SHA. Reaudit dependencies, generated bundles, public disclosures and screen instructions after integrating the other session's UI.
