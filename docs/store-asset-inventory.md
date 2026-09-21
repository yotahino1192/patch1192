# Store asset inventory — 2026-09-21

Current integration baseline: fetched `origin/Dev` **8ab9f4847c67c27e322c70366c834f40b2e6ce51** (2026-09-21), including Free v1 reliability fixes. See [integration validation](testflight-readiness-integration.md). Topic input and Free v1 learning/UI are integrated. See the [master go-live runbook](testflight-go-live-runbook.md) and [Free v1 scope](free-v1-release-scope.md); deferred features are not release blockers.

No final screenshots or artwork generated. Asset paths and content hashes at `7e5335b` match the previously inspected native icon/splash. Free v1 UI integration is complete; use the exact candidate for captures. Yota must approve final branding and rights. Store screenshots/optional promotional art are not Internal TestFlight blockers; clearly track them for external publication.

| Asset | Existing evidence | Remaining action / owner |
| --- | --- | --- |
| App Icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`: 1024×1024, no alpha, universal iOS slot. **Visually inspected: default blue Capacitor mark/grid** | Yota approves final Patch icon and rights; Codex can replace image without UI work, then check catalog/rendering/device appearance. Current image is not release branding |
| Launch / splash | LaunchScreen.storyboard loads Splash using scaleAspectFill; three 2732×2732 opaque PNGs. **Visually inspected base image: white with default Capacitor mark** | Approve final static startup appearance; replace assets later and verify all variants, aspect ratios, dark/light and transition into final app UI |
| Existing brand material | `public/patch/mascot-standing.png`, `mascot-reading.png`, `mascot-celebrate.png`, design references; Widget `companion.jpeg` | Source material, not automatically approved app icon or store assets. Confirm ownership/style/product decision before reuse |
| Screenshots | Design/QA references in repository, but no certified final App Store candidate set | Complete signed-device QA and approve sample content; capture exact release candidate with approved sample data |
| Promotional artwork / preview | No approved final store set established | Optional; Yota chooses whether needed. Do not block initial release on optional artwork or invent features in promotional visuals |

## Capture plan for the frozen candidate

Free v1 study screenshots cover **Flashcards and Multiple Choice only**. Fill in the Blank is future work: no screenshot, metadata or asset preparation is required for this release, and its absence is **not a TestFlight or App Store blocker**.

| Screen | Required state/data | Release prerequisite |
| --- | --- | --- |
| Home / Continue Learning | One saved study material, clear in-progress activity, accurate day's progress; no private account data | Home and continuation regressions pass |
| Add Material | Rights-cleared short study text or supported document, filled valid state | Integrated workflow device QA passes; only currently supported formats |
| Generated Review / destination/save | Coherent generated cards matching source, correct destination and final save action | Review/Ready final UI and durable save pass; no fabricated AI results presented as a real screenshot |
| Free v1 study | Readable Flashcards and Multiple Choice questions/answers and final study controls using sample cards | QA for these two formats passes without domain changes |
| Completion / progress | Legitimately completed Study Set with expected Streak/progress | Actual completion state; do not falsify history |
| Optional Widget | Small/Medium Widget showing valid signed-device snapshot | App Group and Widget device QA pass |
| Consent / privacy (review evidence) | First-use AI consent and settings/deletion path, no credentials | Match published policy; these need not all be marketing screenshots |

Current supported device scope requires planning for **iPhone and iPad**. Capture a large iPhone in the 6.9-inch group (e.g. 1320×2868 portrait) and 13-inch iPad (e.g. 2064×2752 portrait); landscape equivalents if showcasing landscape. Smaller devices still need layout QA. Apple's accepted screenshot groups/sizes can change: verify the [official screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) at capture/upload time; current list allows 6.5-inch iPhone screenshots if 6.9-inch are absent and requires a 13-inch group for iPad apps.

Each capture set records version/build/commit, device/OS, locale and approved copy/data. Use clean status bars, no development banners, inboxes, verification codes, debug credentials or identifiable third-party material. Verify translations, clipping and legibility at store preview size. Do not use intermediate screen designs as final store claims. Yota makes any change to iPad/orientation support explicitly before captures; this branch preserves that product scope.
