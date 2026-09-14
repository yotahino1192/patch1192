# Conservative repository hygiene checkpoint

Branch: `codex/patch-hygiene`. Worktree: `/private/tmp/patch-hygiene`. Exact starting commit: `520bc9c` on `codex/patch-integration-checkpoint`. Date: 2026-09-14.

## Scope and evidence

Reviewed the tracked file inventory, current UI references, global styles, lint's unused-binding findings, package scripts/dependency references, build/native configuration, documentation entry points and exact duplicate tracked-file hashes. Uncertain candidates were left alone rather than expanding this into architectural cleanup.

### Removed

- 32 obsolete CSS rules (85 lines including emptied media blocks and an obsolete comment) for `companion-greeting`, `companion-image`, `companion-bubble` and the old `home-landscape` element. Current app/mobile/features/test markup does not emit these classes. Home now uses Phase 1 `patch-greeting`, `patch-bubble` and `patch-mascot`. Mixed selectors affecting other UI were not removed.
- Two unused imports in `app/page.tsx`: `GeneratedCard` and `scheduleBinaryReview`. The review module remains imported for the existing queue/verdict logic.
- Nineteen unused language-context destructured bindings in `app/page.tsx`, `app/material-manager.tsx` and `app/set-library.tsx`. Hook calls and every used value remain unchanged.

No complete source file, image, dependency or test was deleted. No shared runtime component was rewritten or consolidated. Repeated obsolete companion CSS was removed together, leaving the existing mascot implementation in place.

### Documentation corrected

- README identifies the current Patch integration and its actual icon/mascot entry points rather than the superseded image-only UI description.
- Local setup describes explicit `db:migrate` for a new DB and schema validation at request time, replacing the incorrect automatic-schema-creation claim. The legacy import section clarifies copy-before-initialization and links the existing reviewed schema-adoption rules; no migration or ownership behavior changed.
- STATUS links the integrated checkpoint and this pass, clearly marking older checkpoint counts and pending features as historical. Historical records themselves remain intact.

### Intentionally retained

- All migrations, manifests, DB tools, legacy import code and historical docs, including the explicitly historical gradient inventory.
- Auth/account isolation, AI safety, retention/streak/continue logic, API routes, Domain, adapters and checkpoint storage. Unused-looking destructuring in workspace code deliberately excludes fields and was not changed.
- U2 mock adapter/preview scripts/fixtures and standalone completion UI: tests and standalone consumers still use them. The Phase 1/U2 completion components have distinct host/standalone responsibilities.
- `public/home-landscape.png`: used by the mascot replacement regression as a different-aspect-ratio image. `public/loop-companion.jpeg` and designer sources: retained originals/provenance; the same JPEG is also bundled for the native Widget.
- Byte-identical iOS splash images and App/Widget entitlements: separate asset scale slots and target configuration paths, not safe duplicates to remove.
- PDF.js CMaps/worker preparation, dynamic icon registries, mobile/iOS resources, compatibility paths and build/release configuration.
- Cloudflare/vinext/RSC development packages and ambient types: not part of the current runtime route, but complete removal of the old toolchain and its transitive/peer configuration is deferred. `@xmldom/xmldom` is directly used by document-import tests. No package or lockfile was changed.
- Native `<img>` uses, compatibility props and the remaining lint warnings. A lint warning alone was not treated as evidence of dead behavior.

Tracked temporary/log/backup files were not found. Generated `.next`, `dist`, `node_modules` and screenshot outputs remain ignored local artifacts, not committed cleanup targets. The dedicated worktree uses a local copy of dependencies so browser font loading does not depend on a sibling worktree allow-list.

## Behavior and validation

Product/API/backend/domain/DB/schema/migration/Retention/Streak behavior changes: **NONE**. No dependency changes, new abstractions or tests that merely mirror the deletions were introduced. Existing regression coverage is used to verify this cleanup.

Visual comparison against the integrated checkpoint's 26 Phase 1 captures excludes the rightmost 8 pixels of transient scrollbar area: 24 captures are pixel-identical; the other two each differ at only 9 pixels by at most 1/255 per channel. Existing mobile layout, mascot positioning and dialogs are unchanged. Captures are in ignored `outputs/ui-phase1/` and `outputs/integration/`.

Node 22.23.2, `PATCH_ENV=development`, isolated fixture databases/accounts and local browser processes. API browser tests set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=''` only in the test process. No live AI or production access.

| Validation | Result |
| --- | --- |
| `npm run check` | PASS: **250/250 tests**, typecheck, lint, Web build, env/schema/secret guards and artifact seal |
| Lint | **0 errors / 18 warnings**, down from 39; 21 unused-import/binding warnings removed, remaining warnings unchanged |
| `npm run mobile:build:local` | PASS including artifact seal; existing chunk-size warning |
| UI Phase 1 browser | PASS: seven states, 320/393/430/768 widths, dialogs/focus, unchanged mascot geometry |
| U2 renderer and real Domain browsers | PASS: five types, six-activity completion, Help, retries, checkpoint restoration, owner isolation |
| Full App integration browser | PASS: Home→Preview→real Lesson→Complete→Home, mobile controls, read-only preview, interrupted/resumed answers, consent, duplicate/lost responses, unchanged Due/Continue/Streak, qualified/unqualified post-Home |
| Onboarding/legacy Study/Retention/deep-link browser | PASS |
| Auth and privacy/deletion browsers | PASS |
| Reliability browser + HTTP | PASS |
| Public-page browser | PASS |

The cleanup caused no observed regression and required no behavior fixes. No test expectations or test implementation were weakened or changed. Swift/Simulator was not rerun because native code/assets/configuration are byte-unchanged; mobile validation used the bundle and actual browser UI at mobile widths.

## Merge readiness

Ready to merge into Dev from the standpoint of this conservative hygiene pass and its regression validation. Dev remains `66aeaee`, included in the `520bc9c` ancestry, and has not been changed. The original integration branch remains `520bc9c`. This pass performs no merge, push, deployment, production change or main update.

Pre-existing integration product boundaries (Composer/assignment authoring, final U2 visuals/i18n, per-Attempt timing, future Lesson qualification policy) remain as documented in `patch-integration-checkpoint.md`. Uncertain broader CSS/toolchain/asset cleanup is deferred; it is not required for this safe cleanup to merge.
