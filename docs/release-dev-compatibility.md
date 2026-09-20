# Dev compatibility review — 2026-09-20

This supersedes the original branch-baseline assumption in the first release audit. **Do not merge the preserved original branch.** The current `codex/patch-release-preparation` is rebuilt on current Dev with only release-preparation changes. No merge into Dev, push or deployment was performed.

## Exact revisions and ancestry

| Ref at review | Revision | Finding |
| --- | --- | --- |
| Dev / freshly fetched origin/Dev | cb2a0f282758c2cd5460c5b18e11a4198dada9e8 | Both agree; FETCH_HEAD agrees. Dev reflog last advanced September 15; no advance since release work started September 20 |
| Original preparation HEAD | 925ee9b27d79de3282b4be4cd506d5f67fb45b47 | Based on d382da8, which was **nine UI commits ahead of Dev**. Original Dev...HEAD count: 0 / 10. Merging it as-is would also merge Home/startup/auth-shell/UI-test changes |
| codex/patch-add-material | ab8192cc72318cb7f5c44ca6cf109a7020a804f4 | Advanced during review from 71ee30a by committing AI recovery/diagnostics work. Trial merge repeated against ab8192c: clean, product paths preserved. Only untracked AGENTS.md/CLAUDE.md remain at final status; no writes or live-worktree test commands |
| codex/patch-home-composition | 88f2b4979ca4b220844364eb20665e296cd0652b | Ancestor of original preparation baseline, not yet in Dev |
| Preserved original | codex/patch-release-preparation-before-dev-925ee9b | Retains original 925ee9b and inherited UI history for recovery/reference only |
| Current preparation implementation | 2b8f301 + 7c57605 on cb2a0f2 | Original release patch replayed onto latest Dev; follow-up moves npm script position to avoid UI-branch conflict. Later review commit changes documentation only |

Fetching origin/Dev found no incoming Dev commits to merge: an ordinary merge would have said “already up to date” and left the inherited UI scope problem. With a clean, unpushed preparation branch and preserved original ref, `git rebase --onto origin/Dev d382da8 codex/patch-release-preparation` conservatively replayed only the release commit. It applied cleanly. No UI commits were cherry-picked or merged; no other branch was reset or rewritten.

## Conflicts and product scope

| Comparison | Before / resolution | Current result |
| --- | --- | --- |
| Latest Dev | No textual conflict, but nine unwanted inherited UI commits | Preparation diff now limited to release docs, native metadata/project/version config, build validation/sealing and tests |
| Add Material | Both branches appended npm scripts after test:integration-browser; trial merge showed **package.json conflict** | Moved check:ios-release beside check:release. Command unchanged; Add Material scripts untouched. git merge-tree succeeds without conflict; merged package retains both UI test commands and release check |
| Home composition | No release-file overlap; original branch implicitly included its UI work | Trial merge succeeds; preparation does not import its screens/artwork into Dev |
| iOS/mobile config | Native project, Capacitor config, native bridges and lockfile did not change between Dev and the original d382da8 baseline. mobile/index.html did have inherited startup UI changes | Only intended native release config differs from Dev; mobile/index.html, all other mobile sources, capacitor.config.ts and dependency lockfile match Dev exactly |
| Moving Add Material work | Initially uncommitted auth/privacy/generation/provider/AI changes were committed as ab8192c during review | Repeated trial merge on ab8192c succeeds and preserves those product paths byte-for-byte. Its full separate AI/UI suite was not rerun here; the preparation candidate was tested. Future changes require another comparison |

`git merge-tree --write-tree --name-only` was used for trial merges; it creates Git objects, not worktree merges or branch updates. Beyond “no conflict,” each merged tree was compared to its UI branch for `app/`, `lib/`, `db/`, `drizzle/`, `features/`, `mobile/`, `public/`, capacitor.config.ts and package-lock.json: **zero difference**. The preparation branch itself has zero difference against Dev in those product paths. No schema/migration, auth/AI/retention/domain behavior or UI styling changes are introduced by this branch.

## Version/build and guard effects on UI branches

- App and Widget remain **1.0 (1)**, minimum iOS 17, iPhone/iPad with existing orientations. Only the source of version/build values changes to shared ios/version.xcconfig; Debug/Release inherit the same values. No version bump or ID change was made. Future builds must update the shared file, not independent target overrides.
- CFBundleURLName now expands to the existing bundle ID; `patch` scheme and deep-link routing are unchanged. armv7 requirement becomes arm64, reflecting the already iOS-17/64-bit-only supported hardware. This is native eligibility metadata, not a claim that every packaged byte is unchanged.
- Debug's existing minimal bundle check remains unchanged. New native config validation applies to **Release** and rejects remote server overrides or explicit WebView debugging that could undermine the sealed local bundle. It does not alter Home, Add Material, navigation, generation, saving or Lesson logic.
- Mobile packaging now includes two zero-byte Cordova compatibility stubs **before sealing**. Capacitor already creates those same empty files during sync with the current no-Cordova-plugin setup; the new ordering preserves exact hash validation. Nonempty stubs are rejected for review, not silently overwritten. Adding actual Cordova plugins later needs an explicit release audit.
- After any merge/commit, existing artifacts with the previous commit SHA are intentionally invalid: rerun web/mobile build and ios:sync. Production Release still requires approved real production settings. Do not use development flags or disable the guard to make a UI branch archive pass.
- These settings are local to this preparation branch until integrated. No active UI worktree, its generated artifacts, caches or settings were modified. Trial-merge compatibility is not proof of future uncommitted changes.

## Validation on Dev-based candidate

Toolchain: Node 22.23.2, Xcode 26.1.1 / Simulator SDK 26.1. Dependency lockfile matches Dev and the already-installed locked dependencies. No production credentials/DB or Apple account used.

| Check | Result |
| --- | --- |
| npm run check with PATCH_ENV=development | PASS: typecheck, lint, **253/253 unit tests**, web build and WEB_ARTIFACT_SEALED |
| First attempted check | One ARTIFACT_METADATA_INVALID failure because this session committed script ordering while SHA-bound tests ran. No implementation bypass/fix; complete rerun with stable HEAD passed |
| Lint | 0 errors / 13 existing unused-variable warnings. No product files changed to suppress them |
| npm run ios:sync:local | PASS: mobile build, sealing and native sync; existing large-chunk warning |
| Copied native public bundle | validateArtifact(expected development) PASS with exact inventory and SHA |
| Release preflight against development bundle | Correct refusal: IOS_NATIVE_CONFIG_VALID then ARTIFACT_METADATA_INVALID, exit 1 |
| Simulator Debug build / packaged inspection | PASS, BUILD SUCCEEDED. App and Widget 1.0 (1), minimum 17.0, families [1,2]; four expected manifests present. Final built public bundle hashes match |
| Browser regression | All five PASS: auth, privacy, onboarding, UI phase 1 and Patch integration (existing real-component/API regression fixtures) |
| Secret scan, diff check, final ref comparison | PASS. Dev re-fetched and remains cb2a0f2; Home remains 88f2b49; Add Material latest ab8192c compared again. No product paths differ from Dev in preparation branch |

Browser tests run existing tracked logic through temporary script copies with **only port literals changed** to 23xxx/25xxx/29xxx ranges, preserving relative imports and assertions. Each uses an isolated Chrome profile and, where required, a scratch DB. No production auth bypass or app change is introduced; temporary copies are removed. This avoids fixed-port conflicts with the active UI session. Raw logs use `/private/tmp/patch-release-dev-*.log` and are not committed.

No physical-device, signed distribution archive, Apple Validate, TestFlight, App Store or live-provider checks were performed. Prior release/legal/operational blockers remain; merge readiness is separate from permission/readiness to ship.

## Merge recommendation

**Safe to merge the revised preparation branch into the reviewed Dev cb2a0f2, based on the checks above; not merged.** No unresolved textual conflicts, no inherited UI changes and no new runtime product behavior. Packaging metadata and stricter Release checks have the explicit effects listed above. The original 925ee9b branch history was **not release-only relative to Dev**; use only the revised preparation branch after this review. Re-fetch Dev and compare UI branch tips before an eventual authorized merge if they advance. Do not merge the backup ref or include the nine inherited UI commits implicitly.
