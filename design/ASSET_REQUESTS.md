# Patch mascot artwork integration

Original artwork integration baseline: `ac0f6d1` (final reading artwork), branch `codex/ui-phase1`. Original Downloads files and all designer source/reference files are preserved.

| Target | Status | Source in `~/Downloads` (2026-09-14 JST) | Format / use |
| --- | --- | --- | --- |
| `public/patch/mascot-standing.png` | **RESOLVED** | `fd3f9c3a-9198-462f-819d-e8884bdb18a4.png`, 19:04:12 | 1254×1254 PNG with alpha; early/empty Home. Thin brown arms, circular mint hands, mint feet, ground shadow. |
| `public/patch/mascot-reading.png` | **RESOLVED** | `patch-2.png`, 21:56 | 1254×1254 RGBA PNG with real alpha transparency; seated reading pose with green book, mint hands/feet and ground shadow. Replaces the temporary crop for active/completed Home; used in My Lesson Preview until the 2026-09-17 update. |
| `public/patch/mascot-celebrate.png` | **RESOLVED** | `9c8934c2-a9a8-4c47-b577-3e6f184636db.png`, 19:11:01 | 1254×1254 PNG with alpha; Lesson Complete. Separate thin brown arms and round mint hands, mint feet, confetti and mint ground shadow. |

## Provenance and presentation

All three final assets were copied byte-for-byte, without cropping, background processing or artwork edits. Their source SHA-256 hashes are:

- Standing: `991fbba528213e76e3f35f9a3dc2208d887f542e301f1d441657f9bfc8d8794e`
- Celebrate: `53be855c03808f5c63c873f23a4323a321acddabb29736f476d70409052ed1be`
- Reading: `055aedb6aad662578cc33b96fe8df214398d838a2372a98e9917ceeff4499331`

`app/mascot.tsx` remains the only UI asset registry. It now uses only the three canonical PNG filenames and no longer falls back to `/loop-companion.jpeg`. The old standing original is retained as a source asset; it is not rendered by the Phase 1 UI. The old reading and celebration crops were replaced in place; none of the three poses uses temporary artwork. The separate original Widget artwork and native Retention integration are unchanged.

`app/mascot.css` owns fitting, dimensions and positions. Stable presentation canvases remain standing 1:1, reading 268:253 and celebrate 663:597. Centered `object-fit: contain` keeps full artwork visible. Celebrate uses a 1.1 visual scale to compensate for the supplied square canvas padding without changing its layout box or moving the title/results/CTA. No new image shadow or accent overlay is added.

## References and completion

Design references remain unchanged: `design/references/home-empty-reference.png`, `home-active-normal.png`, `lesson-preview.png`, `lesson-complete.png`, and the original `design/source/Prompt Lists.docx`.

The final transparent reading export was supplied as `patch-2.png` and integrated without image editing. All three mascot requests are now **RESOLVED**. Earlier nontransparent candidates and generated attempts were not used. The existing canonical asset mapping, presentation boxes and screen layouts are unchanged.

## 2026-09-17 Home and preview refresh

Home retains the approved reading asset. Lesson Preview now uses `public/patch/mascot-happy.png`, copied byte-for-byte from `~/Downloads/Happy Patch.png` (2026-09-17 18:43 JST), 1125×1398 PNG with alpha. Source and repository SHA-256: `4edf9dfa054dd0fa7abcbb1bc5b1cdf797aec478260cd0ec836956c14d5cfdc5`.

The asset registry now has four poses; Happy is reserved for Lesson Preview. No generation, cropping, recoloring, or background processing was applied. Standing and celebration artwork remain unchanged. The reading mascot's Home presentation is more compact; the Happy preview uses its native aspect ratio with responsive containment.

## 2026-09-17 startup splash

`public/patch/mascot-hello.png` was copied byte-for-byte from `~/Downloads/Hello Patch.png` (2026-09-17 18:43 JST), 1245×1263 transparent PNG. Its waving pose matches the approved startup reference more closely than the existing standing pose. Source/repository SHA-256: `c2398394e10f36d3776bee0be9f05da248995c7b92ecb294fd7432618e03f6c6`.

The registry now includes Hello as the fifth pose, used only by startup. The mobile initial HTML references the same canonical file before React loads. Other mascot artwork is unchanged. No cropping, background processing or generated artwork was used.
