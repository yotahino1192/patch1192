# Patch — TestFlight go-live master runbook

Readiness checkpoint `d5ef61d` integrated with fetched `origin/Dev` **8ab9f4847c67c27e322c70366c834f40b2e6ce51**, 2026-09-21; Free v1 reliability fixes are preserved. Free v1: Topic/Text/currently supported files → Flashcards/Multiple Choice → History/Review, Streak/Retention. UI/learning integration is complete; deferred features are not gates. [Current A–E audit](release-readiness-audit.md) · [integration validation](testflight-readiness-integration.md).

**Not yet cleared for TestFlight.** Real external values, service evidence, Apple access and device QA remain. This pass performs no deployment, Production DB operation or Apple account operation. Steps below are future operator actions; live mutations require authorization for their actual target. Do not weaken guards or insert fake values to turn checks green.

## Exact future order

| Step | Action / owner | Acceptance |
| --- | --- | --- |
| 1. Yota supplies values | Complete [owner checklist](release-owner-inputs.md) and [configuration contract](production-configuration-contract.md): real origins/instances, secret custody, legal fields, operational owners/objectives, brand decisions. Secrets via secret manager only | Reviewed public policy; all 19 legal fields and publication wording approved; no invented contacts/regions/retention |
| 2. Production environment setup | Operator prepares hosting/DNS, Clerk email OTP, isolated Turso/schema and AI configuration; log/alert destination, deletion scheduler, backup storage/custody. Use staging rehearsals first; authorize actual Production deployment/migrations separately | Correct credentials/allowlists, promotion protection and service owners. Review exact DB migration/rollback and backup steps before live writes |
| 3. Production verification | Run offline release gates; separately authorized read-only DB/readiness and disposable-account auth/AI/deletion checks, alert delivery and isolated backup restore. Complete `config/production-operations.json` references | Real OTP/AI/deletion complete, healthy schema/readiness, delivered alerts, usable offsite backup + restore evidence; `check:operations` passes. Code checks alone are insufficient |
| 4. Apple Developer setup | Yota obtains membership/access, confirms Bundle IDs and App Group, creates App Store Connect app, records Team ID and actual App ID Prefix; registers Clerk native application | Main/Widget IDs and group available; agreements/roles valid; Clerk production maps real prefix + Bundle ID |
| 5. Signing | Set same Team for App/Widget, App Groups in both profiles; approve assets; set version/build in `ios/version.xcconfig`, commit final candidate; build/sync with real Production public values | Correct signed entitlements/identities, matching app/widget version/build; no server override, no Release bypass |
| 6. Physical-device QA before archive | Signed **Release** install using development/ad-hoc provisioning on owned registered devices, production bundle; execute [matrix](physical-device-release-qa.md) on iPhone/iPad | Core flow, real email/Keychain, Widget/App Group, notifications/deep links, consent/deletion pass; record coverage gaps. Fixes require new reviewed candidate |
| 7. Archive | Clean final commit → Production build/sync/check → App scheme, Release, Any iOS Device → Product → Archive | New archive for exact commit/build; `.app` release gate passes; never archive Simulator/unsigned Debug as distribution artifact |
| 8. Validate | Inspect App/Widget signatures/profiles/entitlements, archive Privacy Report and SDK manifests; Organizer → Validate App | Apple validation succeeds; resolve warnings/compliance; local gate does not validate account/provisioning |
| 9. Upload | Organizer → Distribute App → App Store Connect → Upload; Yota/operator checks app/team/build | Processing completes, compliance questions truthfully answered, expected build appears |
| 10. Internal TestFlight | Connect → app → TestFlight → internal group → eligible Connect users → build + What to Test | Invitations accepted; real backend/mail available. Internal testing is distinct from external beta review |
| 11. First tester QA | Install via TestFlight; rerun full core flow and critical matrix, fresh/update/reinstall, A/B isolation, deletion with app closed; record build/device/OS/issues | Exact distributed candidate passes, critical failures resolved; any changed code/config requires new build number + archive/upload |

Store metadata/privacy inventory, test mailbox and review notes: [draft](app-store-metadata-draft.md). Asset and screenshot plan: [inventory](store-asset-inventory.md). Full marketing screenshots and external beta/App Store review are later publication work; do not block Internal TestFlight on optional promotional assets or deferred features.

## Safe local validation now (no credentials)

Node 22 on PATH, isolated worktree without Production env files/credentials:

```sh
npm ci --ignore-scripts --no-audit --no-fund
PATCH_ENV=development npm run check
PATCH_ENV=development npm run test:infra
PATCH_ENV=development npm run db:rehearse-local
PATCH_ENV=development npm run ios:sync:local
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/patch-release-derived \
  -clonedSourcePackagesDirPath /private/tmp/patch-release-spm \
  -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
```

Use new isolated DerivedData/SPM paths for each pass; first resolve packages from committed `Package.resolved` into that SPM path if not available. Don't mutate another session's caches. Simulator is compile coverage only. Empty Production config must fail `PATCH_ENV=production npm run check:release`; incomplete operational references must fail `npm run check:operations`.

## Commands after actual values are supplied

For steps 3 and 7, use the [exact environment contract](production-configuration-contract.md); server/mobile receive their own variables. No secrets in argv or shell tracing. Run on committed HEAD; rebuild after any commit/config change.

```sh
npm run check:env
npm run build
npm run ios:sync
npm run check:release
npm run check:operations
```

For the later **authorized** live verification, set `DB_ID` to the reviewed databaseId; no `--url` overrides. These DB commands are read-only; health endpoints cannot prove provider credentials or complete deletions:

```sh
npm run db:validate -- --allow-remote --confirm-db "$DB_ID"
npm run ops:status -- --allow-remote --confirm-db "$DB_ID"
curl --fail --silent --show-error "$PATCH_API_ORIGIN/api/health"
curl --fail --silent --show-error "$PATCH_API_ORIGIN/api/ready"
```

Deletion worker manual verification and backup/restore have their own exact safeguards in [operations](production-operations-readiness.md) and [recovery rehearsal](production-recovery-rehearsal.md). **Worker invocation mutates queued accounts**, even without a job ID; never call it a dry-run.

## Apple source locations and archive commands

Expected IDs are **unregistered candidates**: `com.patch.learning`, `com.patch.learning.widget`, `group.com.patch.learning.retention`. Team is unset; no Apple account has been accessed. If Yota changes them, update all locations coherently:

| Setting | Source |
| --- | --- |
| Capacitor main ID | `capacitor.config.ts` |
| Product Bundle IDs, signing Team/style, Release configuration, App/Widget targets | `ios/App/App.xcodeproj/project.pbxproj` (Xcode Signing & Capabilities / Build Settings) |
| Both App Group entitlements | `ios/App/App/Retention.entitlements`, `ios/App/PatchWidget/Retention.entitlements` |
| Shared group container name | `ios/App/Shared/RetentionSnapshot.swift` |
| Version/build shared by both targets | `ios/version.xcconfig` — current `1.0 (1)`; increment `CURRENT_PROJECT_VERSION` for every upload; npm version is unrelated |
| App/Widget plist, scheme, launch, privacy | `ios/App/App/Info.plist`, `ios/App/PatchWidget/Info.plist`, `ios/App/App/PrivacyInfo.xcprivacy`, asset catalogs |
| Build/artifact guard | `scripts/check-ios-bundle.sh`, `scripts/check-ios-release.mjs` and Xcode Release shell phase |

Only App Groups are required by Widget sharing. Current notifications are local; no APNs/Push/background mode is needed. `patch://continue` and `patch://review/today` are custom links; no Associated Domains requirement in this email-OTP flow. Sign in with Apple is deferred; social connections must stay disabled because Apple-linked deletion needs a separate revocation implementation. Use actual App ID Prefix, not an assumed Team ID, for [Clerk native registration](https://clerk.com/docs/ios/getting-started/quickstart).

Once signed device QA passes, select a **new** `ARCHIVE_PATH` per build:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE_PATH" archive
npm run check:ios-release -- --app "$ARCHIVE_PATH/Products/Applications/App.app"
codesign --verify --deep --strict "$ARCHIVE_PATH/Products/Applications/App.app"
codesign -d --entitlements :- "$ARCHIVE_PATH/Products/Applications/App.app"
codesign -d --entitlements :- "$ARCHIVE_PATH/Products/Applications/App.app/PlugIns/PatchWidget.appex"
```

Inspect each `embedded.mobileprovision` locally with `security cms -D -i`; don't publish profile/certificate contents. Keep Node 22 on Xcode Run Script PATH. Never manually edit `patch-build.json`, reseal unexplained copied files, disable validation, or use `CODE_SIGNING_ALLOWED=NO` for a distributable archive. Generate the archive Privacy Report and verify actual linked manifests. Current official upload requirement is Xcode 26+ / iOS 26 SDK+; recheck [Apple requirements](https://developer.apple.com/news/upcoming-requirements/) immediately before upload. Internal group procedure: [Apple internal tester guide](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/).
