# Patch artwork refinements

Final visual QA reconfirmed the repository and original handoff contain no cleaner approved pose masters. Existing character artwork remains in use; no generic substitutes were introduced. Supply the following final assets with **fully transparent backgrounds** (no white/paper matte). Keep the approved silhouette, brown linework, mint/peach palette, accent rays and intentional mint ground shadow.

| Status | Target filename | Reference image | Used at | Recommended output | Visual description / current problem |
| --- | --- | --- | --- | --- | --- |
| **PENDING FINAL ARTWORK** | `public/patch/mascot-standing.png` | `design/references/home-empty-reference.png` | Early/empty Home, approximately 264×264 CSS px | Transparent PNG, 792×792 px, export PNG from the original vector if available | Standing Patch, arms down, mint body, peach face panels, antennae and mint ground shadow. Current `public/loop-companion.jpeg` has a visible white sticker outline, gray drop shadow and different proportions. Deliver the approved reference pose without sticker/paper edges; the shared renderer already requests the final PNG first and falls back to this JPEG while it is absent. |
| **PENDING FINAL ARTWORK** | `public/patch/mascot-reading.png` | `design/references/home-active-normal.png`; `design/references/lesson-preview.png` | Active/completed Home and My Lesson Preview, approximately 116×110 / 105×99 CSS px | Transparent PNG, 804×759 px, export PNG from the original vector if available | Seated Patch holding an open green book, yellow accent rays and mint ground shadow. Current reference crop is 268×253 px and retains paper texture/edge remnants; cleaner alpha and a high-resolution master are needed. Preserve pose and art bounds so replacement does not change placement. |
| **PENDING FINAL ARTWORK** | `public/patch/mascot-celebrate.png` | `design/references/lesson-complete.png` | Lesson Complete, approximately 310×280 CSS px | Transparent PNG, 1326×1194 px, export PNG from the original vector if available | Jumping Patch with raised arms, colorful confetti and mint ground shadow. Current 663×597 px reference crop retains paper texture around the silhouette and confetti. Deliver standalone art with clean alpha and no rectangular background. |

Simple UI icons remain local SVGs. Final QA refined the nested orange/yellow flame and the circular Continue chevron directly in code. Unsupported chapter/milestone/lock illustrations are not requested because those concepts are not part of the current domain.

## Replacement contract

All three variants are **PENDING FINAL ARTWORK**. The existing reading/celebrate PNGs are temporary reference crops despite already having the final filenames.

- Add `public/patch/mascot-standing.png`; overwrite `public/patch/mascot-reading.png` and `public/patch/mascot-celebrate.png`. No component/path edits are needed. Reload local development; rebuild Web/mobile normally to ship the new files (and sync Capacitor when packaging iOS).
- `app/mascot.tsx` is the only UI asset registry and renderer. It always requests the final filename. Standing falls back once to `/loop-companion.jpeg` if its PNG cannot load. Reading and celebrate use their currently working PNG placeholders in place until replaced; no duplicate crop copies are maintained.
- Stable presentation canvases are standing **1:1**, reading **268:253**, and celebrate **663:597**. Explicit aspect ratios reserve the same space before/after loading; `object-fit: contain` and centered positioning fit incoming pixels without cropping or moving adjacent UI. Match these canvas ratios and retain the reference art's bounds/padding for best results.
- `app/mascot.css` owns every mascot size, placement and existing responsive rule. Any later minor size tuning belongs there, not in each screen. No new shadow, color filter, blend mode or accent-ray overlay is applied to the mascot. Include the intentional ground shadow/rays/confetti inside each transparent PNG canvas; keep paper/sticker backgrounds out. Greeting/CTA/completion-heading accent rays are separate existing UI decoration and remain unchanged.

## Current usage inventory

| Component | Variant / state | Current working artwork |
| --- | --- | --- |
| `app/home-screen.tsx` | Standing, early/empty Home | Final PNG URL with existing `public/loop-companion.jpeg` fallback |
| `app/home-screen.tsx` | Reading, active/hot/broken/completed Home | Temporary `public/patch/mascot-reading.png` |
| `app/lesson-preview.tsx` | Reading, My Lesson Preview | Same shared reading variant and temporary PNG |
| `app/lesson-completion.tsx` | Celebrate, Lesson Complete | Temporary `public/patch/mascot-celebrate.png` |

Repository audit also found the separate pre-existing native Widget `ios/App/PatchWidget/companion.jpeg`. It is original bundled Widget artwork, not a Phase 1 reference crop; its native rendering and Retention integration are unchanged. Unused legacy companion CSS does not add another runtime mascot reference.
