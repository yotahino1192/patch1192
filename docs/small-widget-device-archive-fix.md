# Small Widget physical-device archive failure (2026-09-23)

## Observed failure and evidence

The user reported the old Small gallery card and a black Home Screen tile on an iPhone 11 Pro. The initial physical-device visual verification failed, regardless of earlier ImageRenderer checks. The user subsequently confirmed that checkpoint `4aa6225` passes on the physical iPhone.

The 00:54 Xcode Debug product was built from the Small Widget worktree. Its embedded extension contains the current Small view symbols, all five compiled catalog assets, four UIAppFonts resources, and the correct `com.patch.learning.widget` identifier / `group.com.patch.learning.retention` entitlement. The active extension process was inside the installed App bundle. An old extension binary was not the cause.

Actual device logs (JST):

- 00:54:58.735, PatchWidget: `Widget archival failed due to image being too large [1] - (1254, 1254), totalArea: 1572516 > max[1001127.600000]`. Snapshot and timeline archive requests repeatedly failed with `WidgetKit.WidgetArchiver.ArchivingError.imageTooLarge`; chronod subsequently reported timeline reload failure and an empty view.
- Gallery snapshot/placeholder cache modification dates predate this install. New archive failures prevented successful replacement. All three provider paths already use the same current Small view; there is no separate legacy Small preview path.
- 00:55:12.409, WidgetRenderer: `FontParser could not open filePath .../PatchWidget.appex/Fonts/MPLUSRounded1c-Bold.ttf: [2: No such file or directory]`, followed by `CodablePlatformFont.Error.invalidFont`. The referenced application-container UUID belonged to a previous installation, not the then-current installed bundle. This is a stale archived font path, not proof of a broken font file in the current bundle.
- Medium snapshot logging also reported `No image named 'companion.jpeg' found in asset catalog`. The JPEG is a loose bundled resource, so it now uses the same UIImage loader as the Small fallback.
- No recent PatchWidget process crash was present in the device crash index. App Group snapshot file existence was confirmed. No snapshot contents or authentication values are logged here.

## Minimal fix

`PatchWidgetResources.image` rasterizes loaded artwork to at most 600×600 actual pixels before constructing `Image(uiImage:)`. A SwiftUI frame or `scaledToFill` alone does not reduce archived bitmap dimensions. Explicit renderer scale 1 makes this independent of 2x/3x screens. Original catalog PNGs are unchanged. The shared companion fallback is bounded too; failed lookups return nil and Small retains its existing white background / text fallback.

Custom fonts, names and sizes remain unchanged. UIFont lookup is checked before using a custom font, with a rounded bold system number / regular system message fallback. This guard does not repair old system-owned archives; a fresh successful WidgetKit archive is still needed after reinstall.

Debug-only resource diagnostics record provider path, font resolution, resource availability and actual archive bitmap dimensions, without snapshot contents. Resource inspection does not eagerly rasterize every state.

Placeholder, snapshot and timeline entry creation, refresh scheduling, state resolver, 8-to-5 mapping, typography layout and App Group remain unchanged. Medium composition, text, dimensions and colors are unchanged; only the shared loose-image loading fix applies. Final App Icon and all five source PNGs are preserved. Personal signing settings remain local.

## Validation

- Signed Debug `App` + `PatchWidget` build for iphoneos: passed; signatures validate on disk. Same existing personal team, device registration and App Group as the previously working build.
- Five catalog images match the original Downloads files byte-for-byte. All five entries are in the built Assets.car. Four TTF resources and UIAppFonts entries are present.
- Simulator native QA: 128 renders, eight states, five artwork mappings, English/Japanese, light/dark, four sizes, streak edge cases; all six image bitmaps are bounded; missing image and font fallbacks pass. This harness is not a WidgetKit remote-renderer test.
- Native Swift RetentionSnapshot tests: passed.
- Full unit suite: 331 passed, 0 failed, including the integrated PDF/MCQ/timeout coverage.
- Final device install (01:14:51 JST) and app launch (01:15:56 JST) succeeded without uninstalling the app or deleting its data. A transient iOS signature/trust launch rejection cleared on retry with no signing change; app launch succeeded.
- Physical-device acceptance: the user confirmed checkpoint `4aa6225` on the actual iPhone: Small displays correctly without a black screen, the new design and final illustration are visible, streak/message alignment is correct, the App Icon is correct, and adding from the Widget gallery works normally. This is user-confirmed visual acceptance, not a claim of a separately captured post-fix runtime log.

Final embedded extension artifact SHA-256 (for matching subsequent diagnostics):

- `PatchWidget`: `d4284bc62702c6907db9ee80218bf07faee2f6fe80a32bff733e4f128cc3fb31`
- `PatchWidget.debug.dylib`: `277441d68c542587fb7b08bf3d0273f7376d00506b413cb24c7b279c04ceee09`
- `Assets.car`: `79d9daf8dafdda94bc5a26d71e3f28d8c474215611e94ca94b22ce29ec7e962c`

## If a stale preview recurs

Open Patch once, then open Add Widget → Patch and add Small. If an existing tile or gallery still shows an old cached preview, remove only that widget, close/reopen the gallery and add it again. Do not uninstall the app or reset the phone as a first step. If black/old output persists, collect the new provider marker `small-widget-archive-v1` and WidgetKit errors before escalating cache recovery.

Physical-device acceptance is complete for the checks explicitly reported by the user above.

Xcode project: `/private/tmp/patch-small-widget-design/ios/App/App.xcodeproj`; Scheme App, Run Debug, connected iPhone, existing personal team for App and PatchWidget. Dev integration is authorized after final regression. No changes to main or Production.

## Final Dev integration regression (2026-09-23)

Fetched `origin/Dev` immediately before integration: `184f221d8a7f5b3147952d8429d30c2204094ffc`. It is already an ancestor of the Widget branch; no additional source merge or conflict resolution was needed. Product source remains identical to physical-verified checkpoint `4aa6225`.

- `PATCH_ENV=development npm test`: Web build and artifact seal passed; 331/331 tests passed, 0 skipped.
- `scripts/check-small-widget.py`: 128 renders passed, including archive bitmap bounds and missing-font/image fallbacks. Native Swift RetentionSnapshot tests passed.
- `PATCH_ENV=development npm run ios:sync:local`: Development mobile build/seal and Capacitor sync passed.
- `App` scheme Debug builds: generic iOS Simulator and signed generic iOS both passed, including PatchWidget. Deep/strict signature verification passed.
- Built extension contains all five catalog assets and all four registered fonts. App target selects AppIcon; its source bytes match the physical-verified final icon. All five PNGs match the supplied originals.
- App and Widget signed App Group remains `group.com.patch.learning.retention`. Medium view comparison is identical to Dev apart from the already verified shared companion resource-loader fix. PDF/MCQ/iOS-timeout source is identical to latest Dev.
- Personal Development signing is excluded from shared commits and preserved in the local stash named `widget-personal-signing-before-dev-integration` and a private patch backup. Existing local Development environment symlink is retained. Device builds used a command-line team override; no personal signing setting was added to the project.

Merge scope is Dev only. No deployment, main update, or Production database operation is part of this integration.
