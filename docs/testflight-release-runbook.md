# TestFlight → App Store runbook

Prepared 2026-09-20. All account/signing/upload actions below are **future actions**. No authorization to execute account operations, deploy, push or merge is implied by this runbook. Dependency/blocker IDs refer to [release readiness](release-readiness-audit.md). Use a separately integrated, reviewed candidate after the active UI work is complete; never build an archive from a moving worktree.

| Step | Owner | Action and acceptance / dependency |
| --- | --- | --- |
| 1. Enrollment | **YOTA MANUAL ACTION** | Enroll the chosen person/legal entity in Apple Developer Program; complete identity checks and agreements. Record active membership/Team ID. R07. |
| 2. Final Bundle ID | **YOTA MANUAL ACTION** + **CODEX CAN DO** | Yota confirms ownership/availability of `com.patch.learning` (candidate only). Codex can align Capacitor appId, App/Widget product IDs, both group entitlements and Shared/RetentionSnapshot.swift group if renamed. Search old IDs; no unintended mismatch. |
| 3. Team / Signing | **YOTA MANUAL ACTION** | Select same Team for App and PatchWidget; obtain valid signing identity/profiles using Xcode. Check Release target settings too. No secrets committed; no free-personal-team assumption for group/distribution. App ID creation in step 4 and group in step 5 must complete before signature is final. |
| 4. App IDs | **YOTA MANUAL ACTION** | Register explicit main and `.widget` extension IDs; enable only required App Groups. Create App Store Connect app record against final main ID when available. No Push/Associated Domains/camera/mic/photo/background additions. |
| 5. App Group | **YOTA MANUAL ACTION** + **CODEX CAN DO** | Current Widget needs `group.com.patch.learning.retention`. Register and associate with **both** IDs, regenerate profiles. Codex verifies source/signed entitlement agreement. Acceptance: real-device app writes and Widget reads isolated snapshot; logout clears it. |
| 6. Clerk production iOS | **YOTA MANUAL ACTION** + **CODEX CAN DO** | Register actual App ID Prefix + Bundle ID in Clerk production Native applications; verify production domain/DNS/email delivery and email-code sign-in/sign-up/reverification. App ID Prefix is not assumed equal to Team ID. Align API/web/mobile key/issuer. Codex checks source config without seeing private keys. Current flow uses native email OTP, not hosted OAuth/passkeys; do not add Associated Domains solely by copying a quickstart. Validate this flow on device. |
| 7. Sign in with Apple decision | **YOTA MANUAL ACTION** | Recommended initial scope: existing email OTP. Record social connections disabled in production. If Apple is included, stop and open implementation work for entitlement, native auth, Clerk Apple credentials/relay setup and deletion token revocation; current worker cannot complete Apple-linked deletion. No “configured” claim until tested. |
| 8. Production environment / services | **YOTA MANUAL ACTION** + **CODEX CAN DO** | R02–R05: supply reviewed public release-policy values, inject secrets outside Git, configure backend DB/schema using separately authorized operations, deletion POST scheduler, monitoring and backup/restore rehearsal. Codex can validate with commands below once supplied. Confirm readiness and real email/AI/deletion; offline gates alone cannot authenticate providers. |
| 9. Release build | **CODEX CAN DO** | On clean final commit with Node 22, run quality checks and production web/mobile builds; `ios:sync` seals then copies mobile bundle. Increment `ios/version.xcconfig` before commit/build; both targets inherit version/build. Production checks must pass without changing metadata, fixture keys or bypassing Xcode phase. |
| 10. Archive | **CODEX CAN DO** after **YOTA MANUAL ACTION** for signing | Choose App scheme, Release, Any iOS Device (not Simulator); Product → Archive. Or use example below with actual identity already configured. No `CODE_SIGNING_ALLOWED=NO` for a distributable archive. Save commit/version/toolchain/evidence. |
| 11. Validate | **CODEX CAN DO** + **YOTA MANUAL ACTION** | Offline `.app` check first, then signature/profile/entitlements and privacy report review. Yota uses Organizer Validate App; inspect every warning. Verify SDK manifests in device archive, icon, URL scheme, App Group and export compliance. A green local script does not replace Apple's validation. |
| 12. Upload | **YOTA MANUAL ACTION** | Organizer Distribute App → App Store Connect → Upload, with intended app/team/version. Keep upload report; do not substitute Debug bundle or skip guards. |
| 13. Processing | **YOTA MANUAL ACTION** | Wait for Connect processing; resolve manifest/compliance/signing errors; answer encryption questions truthfully. Confirm exact build appears and is eligible for internal testing. |
| 14. Internal TestFlight | **YOTA MANUAL ACTION** | Add eligible App Store Connect users to internal group, select build, provide “What to Test” and working production backend. Install using TestFlight. See Apple's [internal tester instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/). |
| 15. Physical-device QA | **YOTA MANUAL ACTION** + **CODEX CAN DO** for diagnostics/fixes | Execute [checklist](physical-device-release-qa.md), both iPhone and iPad while advertised. Record failures, not assumptions. Widget/notification/reinstall/reverification especially require signed devices. |
| 16. Release regression | **CODEX CAN DO** + **YOTA MANUAL ACTION** | After UI integration/fixes, rerun automated gates and critical real-device flows against the exact uploaded build. Changed commit/config/version requires rebuild, reseal, archive and new TestFlight build. |
| 17. External beta decision | **YOTA MANUAL ACTION** | Optional; choose testers, beta description/feedback email/privacy details and reviewer credentials, then submit for Beta App Review if required. Internal testing is not equivalent to external beta approval. |
| 18. Store submission | **YOTA MANUAL ACTION** | R10/R13/R14: complete store metadata, labels, age rating, countries/price/copyright, support/privacy URLs, screenshots and review notes; rehearse reviewer login/deletion; select tested build, choose release timing and submit. Keep backend, mailboxes and support available through review. |

## Local commands — before enrollment

Use Node 22 on PATH. No production values or live accounts are needed for these **development** checks:

```sh
npm ci
PATCH_ENV=development npm run typecheck
npm run lint
PATCH_ENV=development npm run test:unit
PATCH_ENV=development npm run build
PATCH_ENV=development npm run ios:sync:local
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/patch-release-derived \
  -clonedSourcePackagesDirPath /private/tmp/patch-release-spm \
  -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
```

Provide isolated resolved SPM packages at the path above, or perform a separate package-resolution step there from the checked-in lockfile. Do not reuse another session's writable DerivedData/SPM checkout. Simulator build does not exercise real auth, background delivery or App Group provisioning.

## Production commands — only after R02/R07/R08 are satisfied

Set actual values in appropriate ignored local environment files or approved CI/secret manager. Server names: PATCH_ENV=production, PATCH_API_ORIGIN, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_ISSUER, CLERK_SECRET_KEY, AUTH_ALLOWED_ORIGINS, VERCEL_PROJECT_PRODUCTION_URL, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, OPENAI_API_KEY, OPENAI_CARD_MODEL, OPENAI_CHAT_MODEL. Mobile reads **only** PATCH_ENV, PATCH_API_URL, PATCH_CLERK_PUBLISHABLE_KEY, PATCH_CLERK_ISSUER from `mobile/.env.production.local` or environment. All endpoints must match `config/release-policy.json`. Also configure ACCOUNT_DELETION_WORKER_SECRET and its caller; existing check:env does **not** prove the worker secret or scheduler is present.

```sh
npm run check:env
npm run build
npm run ios:sync
npm run check:release
```

Run with explicit production environment; do not set production globally for development-only unit fixtures. `check:release` is offline, scans artifacts and rehearses schema in memory; it does not migrate/validate the live DB or test remote credentials. Follow `docs/production-infrastructure.md` with fresh target review for any later authorized DB operations. Do not run remote write commands as part of this pre-enrollment task.

Once Xcode signing is set up, a future archive command is:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /private/tmp/Patch-release.xcarchive archive
npm run check:ios-release -- --app /private/tmp/Patch-release.xcarchive/Products/Applications/App.app
```

Use a new archive path per candidate. Make Node 22 available to Xcode's Run Script environment (opening Xcode from a configured shell is one option). Xcode Release checks the copied bundle and generated native config. The final command deliberately rejects Simulator/old-SDK artifacts and does not validate signing or provisioning. Inspect App and `.appex` using `codesign -d --entitlements :-` and each `embedded.mobileprovision` with `security cms -D -i`, locally without publishing certificate/profile contents. App/group identifiers and version/build must agree with Connect. Generate Xcode's archive Privacy Report and compare it to the audit and privacy labels.

Never manually edit `patch-build.json`, reseal an unexplained copied bundle, disable Release verification or use fake allowlist entries to obtain a green check. Every code/config commit changes the expected SHA; rebuild after the final commit.

Clerk reference: [iOS quickstart / native application registration](https://clerk.com/docs/ios/getting-started/quickstart), [production deployment](https://clerk.com/docs/guides/development/deployment/production). Recheck dashboard requirements when performing enrollment-dependent work.
