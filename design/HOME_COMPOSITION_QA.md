# Home composition checkpoint — 2026-09-17

Base: Dev `cb2a0f2`. Work branch: `codex/patch-home-composition`.

## Scope

- Approved Evergreen / Mint / Peach / Leaf Green / Orange / Blue-gray palette on Home and Lesson Preview.
- Compact greeting using the real profile name and existing approved reading mascot.
- Existing authoritative streak states restyled, without changing qualification or deriving achievement from streak length.
- Real recently studied sets presented as an alternating path, without claiming completed Lesson entities or adding curriculum semantics.
- Today’s Lesson contains its real set title, available context/count, and primary action. It uses the existing Continue Learning → Preview flow. Completed-today remains a status; optional learning remains separate.
- Existing Home data has no authoritative duration. No estimate is invented: saved-session estimates remain available through the existing read-only preview request.
- Happy Patch from the 2026-09-17 Downloads export is used in Preview. Original artwork is unchanged; see ASSET_REQUESTS.md.
- Navigation labels, tab count and destinations are unchanged. Patch wordmark is decorative; Settings stays at its existing destination.
- No API, backend, domain, database/schema, authentication, AI consent, Retention or Streak behavior changes.

## Validation

Node 22.23.2:
- `npm run check`: typecheck PASS, lint PASS (13 existing warnings / 0 errors), 250 tests PASS, web build PASS.
- Final CSS web build: PASS.
- `npm run mobile:build:local`: PASS; existing >500 kB chunk warning.
- `npm run test:ui-browser`: PASS. 320 / 393 / 430 / 768 widths; normal, hot, broken, stale, empty, completed and resume states; history counts 0–3; long names/titles; 1-day and 123-day snapshot values; preview focus, close, start and stale estimate response handling.
- `npm run test:integration-browser`: PASS. Real Home → Preview → U2 activities → completion → Home, draft/reload/resume, consent, retry/lost response, account/logout isolation and unchanged Continue/Due/Streak behavior.
- Visual inspection: normal and completed Home, 320px Home, preview, long Japanese Home and preview. At 393×852, the ordinary three-history-item Home CTA is visible without scrolling. Smaller screens and unusually long content scroll; CTA remains reachable above navigation.

Local screenshots are generated under `outputs/ui-phase1` and `outputs/integration` (not committed). No merge or push accompanies this checkpoint. Existing untracked AGENTS.md, CLAUDE.md and scripts/seed-qa-set.mjs are excluded.
