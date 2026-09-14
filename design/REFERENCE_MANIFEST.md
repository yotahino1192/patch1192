# Patch UI phase 1 references

Technical authority: Dev `50ef68714c295fd484a5d1375c99c35dacd81919`, existing AppData/Continue Learning/Retention/Domain APIs. Designer input checkpoint: `66aeaee`. Original `source/Prompt Lists.docx` is preserved unchanged. Duplicate `.png.png` extensions were normalized on the UI branch only.

| Reference | Screen/state and visual influence | Product mapping |
| --- | --- | --- |
| `references/home-empty-reference.png` | Early Home; large greeting, standing mascot, whitespace, pill CTA | MAP: real profile; import plus existing sample action. No uploaded material does not imply no learnable cards. |
| `references/home-active-normal.png` | Active Home; mascot/bubble, white streak card, green circular CTA, light path | MAP: recent real sets, explicitly labelled “Recently studied”; Continue resolver. No completed-Lesson claims for sets. |
| `references/home-hot-streak.png` | Orange/gold streak, filled check circles | SAFE: server `hot`, `achievedDays`, `streak`; no UI qualification/threshold calculation. |
| `references/home-broken-streak.png` | Grey streak and retained historical checks | SAFE: server `broken`; no reset in UI. |
| `references/lesson-preview.png` | Rounded overlay sheet, dimmed Home, title, mascot, primary CTA | MAP: real set title/summary and session remaining count; read-only Domain Lesson estimate for saved sessions. No lesson creation until Start. |
| `references/lesson-complete.png` | Celebration pose, results card, streak confirmation, green Home CTA | MAP: completed cards and recall retries, existing Undo/AI recap/next review; server completion is distinct from short practice. |
| `references/post-lesson-home.png` | Calm done circle, updated greeting/streak, optional actions | MAP: authoritative `completed`; continue and long-term review only when their current destinations exist. |
| `source/Prompt Lists.docx` | Original handoff including embedded Create/AI/upload context | Older semantics are subordinate to current contracts. Create/global navigation changes deferred. |

## Asset provenance

- Standing: existing `public/loop-companion.jpeg`, reused unchanged.
- Reading: `public/patch/mascot-reading.png`, isolated from the approved active Home reference (original crop x42/y92/w268/h253); removed only external near-white pixels and a stray bubble edge. Artwork is not redrawn.
- Celebration: `public/patch/mascot-celebrate.png`, isolated from completion (x89/y152/w663/h597), same external-background treatment.
- Simple book/check/calendar/flame/arrows/navigation: lightweight vectors in `app/patch-ui.tsx`, following the supplied shapes and colors.
- Higher-quality transparent masters requested in `ASSET_REQUESTS.md`; current crop limitations are documented, not silently substituted.

## SAFE / MAP / DEFER

SAFE: whitespace, hierarchy, mint/white cards, modal treatment, actual streak flags/history, original assets.

MAP: recent sets replace ungrounded sequential Lesson nodes; no green completion badges are assigned merely because a set was studied. Existing resolver chooses the real next destination; preview Start enters the existing study handler for sets/review or resumes the current session. No navigation IA or domain model changes. Expired snapshots show a refresh state instead of a completed-today claim.

DEFER: prescribed chapters, milestones, locked future lessons and cross-Lesson sequence (not provided by the current Home contract); concept/weak-spot/new-concept results (not in the existing Study result); duration for an uncreated session (planning would mutate); discovery/AI/Create redesign. Domain has ordered activities within individual Lessons, not the illustrated chapter map.

## Verification entry points

`npm run test:ui-browser` renders actual Home/Shell/Study components through a test-only Vite entry at 393×852 and checks 320/430/768 widths. Captures go to ignored `outputs/ui-phase1/`. No fixture is imported into production. `test:onboarding-browser` additionally verifies preview open/close against real authenticated APIs and an isolated database. Final results are in `UI_PHASE1_QA.md`.
