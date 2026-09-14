# Patch mascot artwork integration

Integration baseline: `1880afa`, branch `codex/ui-phase1`. Original Downloads files and all designer source/reference files are preserved.

| Target | Status | Source in `~/Downloads` (2026-09-14 JST) | Format / use |
| --- | --- | --- | --- |
| `public/patch/mascot-standing.png` | **RESOLVED** | `fd3f9c3a-9198-462f-819d-e8884bdb18a4.png`, 19:04:12 | 1254×1254 PNG with alpha; early/empty Home. Thin brown arms, circular mint hands, mint feet, ground shadow. |
| `public/patch/mascot-reading.png` | **PENDING TRANSPARENT EXPORT** | Candidate `130eca9c-2804-44af-85c0-557fd090e0fa.png`, 19:14:30 | Candidate is 1254×1254 RGB PNG with a white matte and no alpha. Not accepted as final; the prior temporary crop remains for active/completed Home and My Lesson Preview until the transparent export is supplied. |
| `public/patch/mascot-celebrate.png` | **RESOLVED** | `9c8934c2-a9a8-4c47-b577-3e6f184636db.png`, 19:11:01 | 1254×1254 PNG with alpha; Lesson Complete. Separate thin brown arms and round mint hands, mint feet, confetti and mint ground shadow. |

## Provenance and presentation

Standing and celebrate were copied byte-for-byte, without cropping, background processing or artwork edits. Their source SHA-256 hashes are:

- Standing: `991fbba528213e76e3f35f9a3dc2208d887f542e301f1d441657f9bfc8d8794e`
- Celebrate: `53be855c03808f5c63c873f23a4323a321acddabb29736f476d70409052ed1be`

`app/mascot.tsx` remains the only UI asset registry. It now uses only the three canonical PNG filenames and no longer falls back to `/loop-companion.jpeg`. The old standing original is retained as a source asset; it is not rendered by the Phase 1 UI. The old celebration crop was replaced in place. The separate original Widget artwork and native Retention integration are unchanged.

`app/mascot.css` owns fitting, dimensions and positions. Stable presentation canvases remain standing 1:1, reading 268:253 and celebrate 663:597. Centered `object-fit: contain` keeps full artwork visible. Celebrate uses a 1.1 visual scale to compensate for the supplied square canvas padding without changing its layout box or moving the title/results/CTA. No new image shadow or accent overlay is added.

## References and remaining reading requirement

Design references remain unchanged: `design/references/home-empty-reference.png`, `home-active-normal.png`, `lesson-preview.png`, `lesson-complete.png`, and the original `design/source/Prompt Lists.docx`.

The reading export must have real alpha transparency, the seated green-book pose, mint hands/feet, clean dark-brown outlines, and no white/paper rectangle or crop edge. Other PNGs added today in Downloads were checked by time/dimensions/alpha; no alternative transparent reading version was found. The candidate's identity is clear, but its transparency requirement is not satisfied.
