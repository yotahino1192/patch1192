# Store asset inventory — 2026-09-20

No final screenshots or artwork generated. UI is actively changing in a separate worktree.

| Asset | Existing evidence | Remaining action / owner |
| --- | --- | --- |
| App Icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`: 1024×1024, no alpha, universal iOS slot. **Visually inspected: default blue Capacitor mark/grid** | Yota approves final Patch icon and rights; Codex can replace image without UI work, then check catalog/rendering/device appearance. Current image is not release branding |
| Launch / splash | LaunchScreen.storyboard loads Splash using scaleAspectFill; three 2732×2732 opaque PNGs. **Visually inspected base image: white with default Capacitor mark** | Approve final static startup appearance; replace assets later and verify all variants, aspect ratios, dark/light and transition into final app UI |
| Existing brand material | `public/patch/mascot-hello.png`, `mascot-reading.png`, `mascot-celebrate.png`, design references; Widget `companion.jpeg` | Source material, not automatically approved app icon or store assets. Confirm ownership/style/product decision before reuse |
| Screenshots | Design/QA references in repository, but no certified final App Store candidate set | Wait for UI freeze/integration and signed-device QA; capture exact release candidate with approved sample data |
| Promotional artwork / preview | No approved final store set established | Optional; Yota chooses whether needed. Do not block initial release on optional artwork or invent features in promotional visuals |

## Capture plan after UI freeze

| Screen | Required state/data | Release prerequisite |
| --- | --- | --- |
| Home / Continue Learning | One saved study material, clear in-progress activity, accurate day's progress; no private account data | Home and continuation regressions pass |
| Add Material | Rights-cleared short study text or supported document, filled valid state | Other session's final workflow integrated; no unsupported import claims |
| Generated Review / destination/save | Coherent generated cards matching source, correct destination and final save action | Review/Ready final UI and durable save pass; no fabricated AI results presented as a real screenshot |
| Lesson | Readable question/answer and final study controls using sample cards | Lesson QA passes without domain changes |
| Completion / progress | Legitimately completed Study Set with expected Streak/progress | Actual completion state; do not falsify history |
| Optional Widget | Small/Medium Widget showing valid signed-device snapshot | App Group and Widget device QA pass |
| Consent / privacy (review evidence) | First-use AI consent and settings/deletion path, no credentials | Match published policy; these need not all be marketing screenshots |

Current supported device scope requires planning for **iPhone and iPad**. Capture a large iPhone in the 6.9-inch group (e.g. 1320×2868 portrait) and 13-inch iPad (e.g. 2064×2752 portrait); landscape equivalents if showcasing landscape. Smaller devices still need layout QA. Apple's accepted screenshot groups/sizes can change: verify the [official screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) at capture/upload time; current list allows 6.5-inch iPhone screenshots if 6.9-inch are absent and requires a 13-inch group for iPad apps.

Each capture set records version/build/commit, device/OS, locale and approved copy/data. Use clean status bars, no development banners, inboxes, verification codes, debug credentials or identifiable third-party material. Verify translations, clipping and legibility at store preview size. Do not use another session's intermediate screen as a final store claim. Yota makes any change to iPad/orientation support explicitly before captures; this branch preserves that product scope.
