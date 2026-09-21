# Patch release readiness audit — 2026-09-21

Audited actual fetched `origin/Dev` **7e5335b240ffec3512cae717904333f496188de4** in a new clean worktree/branch `release/testflight-readiness-20260921`. No Production deployment/DB access, Apple operation, push, merge or main modification. [Master ordered runbook](testflight-go-live-runbook.md) · [current validation](release-readiness-validation-20260921.md).

**Repository preparation complete for this pass; live TestFlight readiness remains blocked by B–E.** Actual values may reveal provider/device issues requiring fixes; no claim of guaranteed upload or review approval.

## A–E blocker classification

| Class | Current status / remaining work | Acceptance / authoritative detail |
| --- | --- | --- |
| **A — entirely code/repo now** | Completed: production config/secret guards and protected-CI wiring; offline operational handoff validation; disabled worker template; monitored failure contracts; isolated encrypted restore/application invariants; one master runbook; Apple/metadata/device checklists | [Validation evidence](release-readiness-validation-20260921.md). No UI/learning/schema/migration/native behavior changed. Subsequent application of actual owner values/approved assets is B-dependent work |
| **B — Yota supplies values** | Actual API/web/support/privacy host, provider ownership, responders/alert destination choice, backup objectives/custody, legal/public fields, brand approval, reviewer mailbox/sample-content rights, metadata | [Owner checklist](release-owner-inputs.md). `lib/public-pages/config.ts` is still draft with **19 null fields**; final prose/version/consent review needed before publishing, not just a flag change |
| **C — external Production service configuration** | DNS/hosting/Clerk OTP and mail delivery/Turso/schema/AI keys & quota; scheduler and heartbeat; log drain/alert delivery; independent backup storage/key retrieval/restore timings/deletion+AI reconciliation | [Configuration contract](production-configuration-contract.md), [operations](production-operations-readiness.md), [recovery](production-recovery-rehearsal.md). Both hosted policy sections empty; operational reference fields empty. Evidence is required, not merely passing syntax checks |
| **D — Apple enrollment/access** | Membership, actual Team/App ID Prefix, register main/Widget/group, profiles/signing, Clerk iOS registration, Connect app/roles/compliance, Validate/upload/Internal group | Source locations/commands in [master](testflight-go-live-runbook.md). IDs are candidates, Team unset; no identifiers/accounts changed |
| **E — physical-device testing** | Signed iPhone/iPad core flow, native OTP/Keychain, notification/Widget/App Group/deep link behavior, consent/deletion, offline/reinstall/account isolation; exact TestFlight installation/update | [Two-stage device matrix](physical-device-release-qa.md): pre-archive signed Release plus exact uploaded build; **all NOT RUN** |

## Retired stale blockers / scope corrections

- Topic input is implemented (1–200 characters); Free v1 learning and frozen UI are already integrated. No separate CLI1/CLI3 merge or unfinished Topic contract is required.
- File import is **PDF, DOCX, PPTX, TXT, Markdown, CSV**, 10 MB/file, at most five attachments; extraction/source limits apply. It is not OCR. Flashcards/Multiple Choice, History/Review and Streak/Retention are current scope.
- Fill in the Blank, Advanced Lesson/LEARN/EXPLAIN/APPLY/Tutor/Deep Session, Pro, Creator/Business, video/YouTube and sharing are deferred, not TestFlight blockers.
- Native email-OTP/Keychain code, consent/deletion/AI control, deletion caller and local recovery tooling already exist; external validation is still needed. A no-op client diagnostics sink is not an invented requirement to buy a crash service.
- Sign in with Apple is not required by the current email-only implementation; leave social connections disabled. Existing Apple-linked jobs correctly fail/retry without revocation support and must not be falsely completed.
- Final store screenshots/marketing artwork and external beta/App Store review are later gates. They do not prevent setting up Internal TestFlight. Final icon/splash approval remains an owner branding decision; current assets are Capacitor defaults.

## Current native / service facts

| Area | Repository truth |
| --- | --- |
| Native identity | `com.patch.learning`, Widget `com.patch.learning.widget`, group `group.com.patch.learning.retention`; unregistered candidates. iOS/iPadOS minimum 17.0; iPhone/iPad supported |
| Version/build | Shared `ios/version.xcconfig`: **1.0 (1)**. Increment build for every upload; App/Widget match. npm 0.1.0 is separate |
| Signing/capabilities | Team unset, Xcode project settings; both retention entitlements use same App Group. Shared JSON protected file, not group UserDefaults. No APNs/Associated Domains/Apple sign-in entitlement |
| Auth/deep links | ClerkKit 1.5.4 native email OTP/reverification, bundle/domain-scoped app-private Keychain; telemetry disabled. Custom `patch://continue`, `patch://review/today`; schemes are not authentication |
| Runtime config | Explicit deployment identity, canonical exact HTTPS DNS origins, allowlisted DB/models/Clerk issuer; live Clerk in Production; required independent worker secret and explicit hosted AI_ENABLED; provider authenticity verified later |
| Artifact guard | SHA/config/hash inventories, client/server secret scans, copied Capacitor config checks and Xcode Release gate; final device app validator checks SDK/resources/version/manifest but does not validate provisioning |
| Operations | Server/CLI structured metadata only; guarded read-only aggregate status; protected POST worker with durable lease/backoff; encrypted backup + disposable local restore; external destinations/schedules are unconfigured |
| Public disclosures | `/privacy`, `/terms`, `/support` exist without login; draft legal config. AI consent versions `ai-learning-1` / `privacy-draft-1`; `store:false` is not a provider-retention guarantee |

Legacy issue cross-reference for older documents: R01=A; R02=B/C; R03=C; R04=B/C; R05=B/C; R06=B (assets); R07=D; R08=C/D/E; R09=email-only scope decision, not a required Apple implementation; R10=D/B (store); R11=D; R12=E; R13=B/C (review access); R14=B/D/E (later publication). Use A–E above for current planning.

## Privacy manifest / actual SDK audit

Prior native manifest audit retained below: these pinned dependencies/native sources are unchanged on the audited Dev; this pass uses its own copied SPM storage for compilation. Final device archive inspection remains required. Resolved packages are **not automatically linked products**.

| Native component | Included / manifest evidence | Required Reason APIs and conclusion |
| --- | --- | --- |
| Patch App | Own `App/PrivacyInfo.xcprivacy` is in App Resources | Needed: standard UserDefaults stores retention owner + per-day scheduling ledger. Existing **CA92.1** covers app-only preferences; retained unchanged. No tracking flag true. |
| PatchWidget | `PatchWidget.swift` + shared snapshot source, WidgetKit/SwiftUI/Foundation | Reads shared JSON by URL; no UserDefaults, file timestamp/disk-space/boot-time query found. No invented group-UserDefaults reason (1C8F.1), no extra required-reason declaration added. Reassess if implementation changes. |
| Capacitor + Cordova 8.5.2 | SPM prebuilt frameworks, device and simulator slices each contain PrivacyInfo.xcprivacy | Vendor manifests declare no tracking, empty collected-data and accessed-API arrays. npm Capacitor native source spot-check and framework manifest inspected; final device archive aggregation remains required. |
| ClerkKit 1.5.4 | Direct product dependency; `Clerk_ClerkKit.bundle/PrivacyInfo.xcprivacy` | Vendor declares UserDefaults CA92.1. Installation marker uses standard defaults; telemetry throttler also references defaults, but Patch config sets telemetryEnabled=false. Keychain access itself is not one of these required-reason categories. |
| ClerkKitUI, Nuke 13.2.0, PhoneNumberKit 5.0.9 | UI product **not linked**; Nuke/PhoneNumberKit appear in lockfile because ClerkKitUI depends on them | ClerkKitUI has CA92.1, PhoneNumberKit has empty/no-tracking manifest, no Nuke manifest found in checkout. This is not a missing-manifest blocker for current ClerkKit-only build. Reaudit if adding ClerkKitUI. |
| Web JS | React, Clerk React, PDF.js, fflate, fonts and application bundle | npm listing is not a native SDK manifest inventory. Backend libSQL/Drizzle/Clerk backend must not enter client graph (existing secret/client graph checks). Audit actual archive after dependency/UI integration. |

The app manifest currently covers required-reason API access, **not a completed collection disclosure**. It has no `NSPrivacyCollectedDataTypes` key; this does not mean “Data Not Collected.” App Store privacy answers must cover email, account identifiers, user-provided learning/chat content, learning interactions, and relevant provider diagnostics/usage records. Final purpose/linkage/retention and any manifest collection entries require provider settings/legal review. Do not copy generic categories or promise no collection. No advertising/tracking SDK or ATT flow was found in current code. No new privacy capabilities were enabled.

Before upload, inspect **device** archive recursively, compare manifest list with linked frameworks/resources, generate Xcode privacy report, inspect entitlements for App/Widget, and run Apple's Validate/upload processing. A simulator manifest inspection is not proof of store acceptance. See [Apple required-reason API documentation](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).
