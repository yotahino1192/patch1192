# Startup splash checkpoint — 2026-09-17

Base: `88f2b49` (Home composition). Branch: `codex/patch-startup-splash`.

## Presentation and lifetime

- Full-screen `#12564F`, transparent Hello Patch artwork, white Patch wordmark. No spinner, progress indicator, buttons or technical messages on the normal splash.
- Shared stylesheet for initial mobile HTML and React; responsive layout with safe-area padding and viewport-relative sizing. No image edits or cropping.
- AuthBoundary owns an in-memory presentation flag outside keyed account subtrees. StartupPending replaces only existing initial authentication, account bootstrap and workspace/data waits. It does not initiate, block, reorder or retry any authentication or API operation.
- Sign In, Home/onboarding, direct lesson entry or an existing recovery screen completes the startup lifetime. No minimum display duration or animation delay.
- Existing auth slow/error recovery remains available. If the mobile bundle never mounts, a 15-second failure watchdog replaces the document splash with recovery controls; it does not hold up a successful launch. JavaScript-disabled browsers receive a separate message.
- Ordinary navigation, previews, lesson activities, AI requests, saves, foreground refresh, account switches and post-login loading use existing in-app behavior. No global loading overlay, session persistence changes, API, domain, database or Retention/Streak changes.

## Validation (Node 22.23.2)

- `npm run check`: PASS; typecheck, 250/250 unit tests and web build. Lint has 13 existing warnings, zero errors.
- Final `npm run lint`: PASS, same warnings.
- `npm run mobile:build:local`: PASS; existing large-chunk warning.
- `npm run test:auth-browser`: PASS; StrictMode, startup-only lifetime, foreground and account switching, authenticated and signed-out first screens, logout/reload, stale response isolation, initial mobile document and bundle-failure recovery.
- `npm run test:integration-browser`: PASS; controlled session/account/data startup waits, real Home → Preview → U2 lesson → Complete → Home, reload/resume, AI consent, retry and account isolation. Mutation observers verify no splash is reintroduced during initialized flows.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='' npm run test:onboarding-browser`: PASS. The default local run timed out waiting for the test server with the machine's live Clerk configuration; the isolated mock-SDK configuration used by integration passed. No production credentials or data were used by the successful run.
- `npm run test:privacy-browser`: PASS; consent, revocation, cancellation, deletion/reauth and cleanup.
- Visual QA: 320×568, 393×852, 430×932 and 852×393 Chrome viewports; inspected normal React splash and initial mobile HTML. No horizontal overflow or white rectangle around transparent artwork. Native device/simulator validation was not performed.

Screenshots: `outputs/startup/` (local, not committed). No merge or push. Existing untracked AGENTS.md, CLAUDE.md and scripts/seed-qa-set.mjs remain excluded.
