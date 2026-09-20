# Home reference fidelity checkpoint — 2026-09-17

Base: `9e730e1` (Home composition + startup splash). Branch: `codex/patch-home-reference`.

## Changes

- Generated rounded Evergreen Patch wordmark; approved reading mascot retained with refined scale/placement.
- Speech bubble proportions, compact one-line streak heading, weekday spacing and connected achieved-day circles aligned to the reference. Hot/broken/stale state still comes only from the authoritative snapshot.
- Real recent sets use reference-style node positions and one continuous Mint curve. History counts 0–3 adapt without adding curriculum entities.
- Smaller circular Today’s Lesson focal area, white book/rays, tighter title hierarchy and Peach action. New sessions say Start lesson; saved sessions retain Continue learning. The existing handlers and lesson selection are unchanged.
- Home profile silhouette opens the existing Settings/Account dialog. Navigation icons now use document, circled-plus and outlined progress shapes. Labels and destinations remain unchanged.

## Intentional differences / limitations

- The current data describes recently studied sets, not completed Lesson entities. The heading remains Recently studied and no unsupported completion badges are drawn.
- Existing Due Count / Today’s ToDo entry remains visible. This adds a line not present in the reference.
- No fabricated 7-minute duration: authoritative saved estimates remain in Preview. Names, titles, streaks and context come from real data. Screenshot-comparison names/titles exist only in the test fixture.
- The generated wordmark approximates the reference. Original designer font/vector files were not supplied. Generated book candidates retained glow after correction attempts; clean SVG/CSS is used instead and the unsuitable images are not in the repository.
- Long names/titles and smaller screens wrap/scroll as needed. Main action hit areas remain usable rather than forcing screenshot-specific coordinates.
- No changes to APIs, backend, DB/schema, auth, account isolation, AI consent or Retention/Streak qualification. No navigation destination or product information-architecture change.

## Validation

Node 22.23.2:
- `npm run check`: PASS, 250/250 tests, typecheck and web build. Lint: 13 pre-existing warnings, 0 errors. The new-session button label assertion was updated; resume coverage still requires Continue learning.
- `npm run test:ui-browser`: PASS; navigation and Settings, 320/393/430/768 widths, all Home states, long names/titles, history counts, preview focus/actions and asset stability.
- `npm run test:integration-browser`: PASS; real Home → Preview → U2 activities → Complete → Home, draft/reload/resume, consent, errors/retry and account isolation.
- `npm run mobile:build:local`: PASS; existing large-chunk warning.
- Final CSS web build: PASS.
- Final visual captures: `outputs/ui-phase1/final-*` (local, not committed), including comparison-only fixture content and real UI layouts at 320/393/430 widths.

No merge or push. Existing untracked AGENTS.md, CLAUDE.md and scripts/seed-qa-set.mjs remain excluded.
