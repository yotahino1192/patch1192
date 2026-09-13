# Public legal / support content

- `content.ts`: framework-independent Japanese document data. Keep descriptions aligned with implemented behavior; do not add planned collection or legal promises.
- `config.ts`: public, non-secret operator/contact/retention/legal placeholders. `null` is explicitly displayed as undecided; there is no dummy contact or submission form.
- `app/public-pages/document-body.tsx`: reusable renderer without routing/auth/storage dependencies. Public routes use h2; existing in-app `LegalContent` uses h3 beneath its h2.
- `app/public-pages/public-document.tsx`: Web navigation, table of contents and scoped styling only. Capacitor can reuse the content and renderer without this Next.js shell.

## Before publication

The current text is a preparation draft, not approved final legal terms. A human must confirm every config field, review all three documents (including preparation notices and Terms wording), and decide the final terms before setting `publicationStatus: 'published'`. The status does not rewrite or approve the text. Never put a secret into this config: it is public and bundled for in-app display.

All three routes currently use `noindex, nofollow`. Indexing is enabled only when the status is published, every field is populated without placeholder markers, and the contact email has a valid format. This mechanical check does not establish legal completeness. No canonical URL is fabricated.

## Verification (Node 22)

```sh
PATCH_ENV=development npm run check
PATCH_ENV=development node tests/public-pages-browser.mjs
```

The browser test runs against the preceding build with isolated local Chrome and temporary paths. It verifies anonymous access, metadata, headings, anchors, 320/768/1280 pixel reflow, keyboard focus, JavaScript-disabled content, and absence of auth/API requests or DB creation. It does not use real credentials or production services. Existing auth/privacy/onboarding browser tests and `mobile:build:local` cover the shared in-app renderer.

## Current implementation baseline and boundaries

Updated against Dev `0ebaa56b0fb996844899d0dbf4264bf395b96ff2`, preserving the existing public-pages commit and merging Dev into this worktree only. No merge back into Dev or deployment is included.

- Retention disclosures follow `db/retention-schema.ts`, `lib/retention-platform.ts`, the native snapshot allow-list and `docs/retention.md`: account-scoped study evidence, timezone/preferences, same-day local notifications, limited Widget snapshots, and cleanup on logout/switch/deletion. APNs registration is explicitly absent; signed-device App Group acceptance remains pending.
- AI and deletion descriptions follow `lib/privacy-policy.ts`, the AI request ledger and `lib/deletion-worker.ts`. This content update does not change consent versions, AI scope, API behavior or deletion rules. Final publication still requires a human decision on the policy/consent version workflow.
- `LegalContent` uses the same content inside the existing Web/Capacitor panels. Internal cross-references switch documents in React and focus the target heading, without navigating a Capacitor WebView to a Web-only route. Public pages retain ordinary links and work without JavaScript. External provider links remain ordinary HTTPS links.
- Public typography and colors use the existing global design tokens; styles are scoped to these pages.

Verified with Node 22.23.2: `npm run check` (185/185 tests; TypeScript; lint 0 errors / 41 existing warnings; production Web build), `mobile:build:local`, `node tests/public-pages-browser.mjs`, and all existing auth/privacy/onboarding browser suites. Public browser checks include embedded document navigation/focus and duplicate-anchor prevention. Screenshots at 320 and 1280 pixels were visually reviewed. No live Clerk/AI calls, production DB access, native signing or deployment was performed.
