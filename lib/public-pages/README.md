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
