# Phase 2A — Authentication Foundation

Phase 1 `ca7cafd` is included in `codex/auth`. This change adds Email authentication and account isolation only. No production database migration or legacy account assignment has been performed during implementation.

## Architecture and implementation order

1. Add `users` (random internal UUID, created_at) and `auth_identities` (issuer + subject primary key, internal user foreign key, created_at). A write transaction provisions the mapping after credential verification. Email, display name, client IDs, and Clerk unsafe metadata never establish ownership. Different Clerk issuers remain distinct identities; automatic account linking is absent.
2. Protect all current route handlers: `/api/auth/session` GET, `/api/data` GET/POST, `/api/ai/cards` POST, `/api/ai/chat` POST. `requireAuth()` uses Clerk's backend SDK to verify signature, expiry/not-before, issuer, session claims, and browser authorized party. Cookie mutations also require an allowlisted Origin. Missing/invalid credentials return 401 before input parsing or DB access. Configuration failures return 503. API responses are not cached.
3. Resolve the verified identity to `users.id` on the server. Every store operation receives that UUID explicitly. Every business read/update/delete is scoped by `user_id`; referenced folders, sets, cards, source content and AI context are ownership-checked. Foreign resources and nonexistent resources receive the same response. Undo keeps its existing generic conflict behavior for both. There is no client-facing database access or RLS in the existing libSQL architecture: server query scoping is the enforcement boundary.
4. Bootstrap the internal ID using `/api/auth/session`. Requests include `X-Patch-Session` and subsequent requests include `X-Patch-Account`. These are consistency assertions, never credentials. The server compares them against verified claims/mapping. A cookie account switch between dispatch and reception returns `409 ACCOUNT_CHANGED` instead of applying A's action to B.
5. Mount the private React tree only after provider readiness and successful bootstrap. `AccountScope` binds each request and workspace writer to one authenticated session. Departure invalidates it and aborts pending requests; responses and JSON parsing recheck the binding even when Capacitor HTTP cannot cancel an in-flight native operation. Writes are never automatically replayed. An operation already accepted by the server may finish for its original owner; it cannot update the new account's UI or namespace.
6. Add Email sign-up/sign-in, persistent Web/native sessions, current-session logout and the regression tests described below.

## Provider choice after Phase 1

Clerk remains appropriate because the existing React/Next API and libSQL data model can stay in place. Supabase/Firebase Auth could verify identity but add another identity platform without replacing this application's database. Auth.js would require a separate native authentication/token lifecycle implementation. Phase 2A uses `@clerk/react` for the shared SPA boundary, `@clerk/backend` for API verification, and **ClerkKit 1.5.4** directly in Xcode. Next middleware is deliberately not the authorization boundary: every API handler calls `requireAuth`, including AI generation.

ClerkKit 1.5.4 requires iOS 17 and Swift 6.2 tools. The app deployment target is now **17.0** (approved minimum-target change), with Xcode 26.1.1 / Swift 6.2.1 used for verification. Capacitor 8.5.2 and the Phase 1 bundled UI/assets remain in place. The generated CapApp-SPM package is still owned by Capacitor; Clerk is a separate pinned Xcode package dependency.

References: [Clerk iOS setup](https://clerk.com/docs/ios/getting-started/quickstart), [native Auth API](https://clerk.com/docs/ios/reference/native-mobile/auth), [SDK configuration](https://clerk.com/docs/ios/reference/native-mobile/configuration), [pinned SDK source](https://github.com/clerk/clerk-ios/tree/1.5.4).

## Web and native sessions

- **Web:** Clerk React displays the Email flow and restores the Clerk session. Same-origin API calls send the Clerk `__session` cookie. Clerk handles its session renewal through its frontend service. Patch does not copy tokens into localStorage. The short-lived `__session` JWT is not HttpOnly; Clerk also uses a longer-lived HttpOnly client cookie on the authentication domain. Continue normal XSS prevention and HTTPS deployment.
- **iOS:** `PatchAuthPlugin.swift` registers on `PatchBridgeViewController`. Email/code attempts and session restoration use ClerkKit. The SDK persists native credentials in its app-private Keychain service, separated by Clerk domain, with no shared access group. SDK 1.5.4 uses `AfterFirstUnlockThisDeviceOnly`. This implementation does not invent/store its own refresh token.
- **Transport:** `mobile/main.tsx` still uses `CapacitorHttp` and `PATCH_API_URL`. `lib/api-client.ts` remains the Phase 1 raw origin/transport boundary. `lib/account-scope.ts` wraps it for all private consumers. On native requests, the bridge gets the current short-lived Clerk session token and supplies `Authorization: Bearer …`; cookies are not the native auth mechanism. The bridge checks expected session ID before and after token acquisition. Token values exist only transiently in memory and native HTTP headers; they are never logged, placed in URLs, or written to WebView storage.
- **Expiration:** Clerk owns absolute/inactivity limits and token renewal. The client asks the native SDK for a token for each API request; the SDK refreshes/caches it. The API rejects expired tokens. 401 or account-binding failure locks the private tree and offers retry/login recovery. Review/state 409 conflicts retain their existing handling. No blind mutation retry is added.
- **Logout:** immediately invalidate requests/private UI, mark a nonsecret pending logout intent, delete the departing account's local workspace, and ask Clerk to end that session. A failed/offline logout stays locked and offers retry; after reload it completes provider logout before bootstrap. Other browser tabs observe the pending intent and Clerk session changes. BFCache restoration reloads before using a cached private tree. This is current-session logout, not log out everywhere. As with standard offline JWT verification, an already issued token can remain valid until its short expiration (plus configured 5-second clock tolerance). Immediate global revocation is outside Phase 2A.
- **Storage:** only `patch:workspace:v2:<internal UUID>` is read/written for private drafts, including pending reviews, edit drafts, and AI drafts. The JSON envelope repeats the owner UUID. Same-account reload retains it; logout/account departure clears it. An account change remounts the private React tree. `loop-language` is a nonprivate device display preference and remains shared. LocalStorage remains unencrypted as explicitly scoped.

## Configuration

Server/Web `.env.local` or hosting environment:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web public key, same Clerk instance as iOS/API |
| `CLERK_SECRET_KEY` | Server-only Clerk key used for JWKS fetching; never bundle it |
| `CLERK_ISSUER` | Exact token issuer URL, no guessed/alternative issuers |
| `AUTH_ALLOWED_ORIGINS` | Comma-separated exact Web origins, e.g. `http://localhost:3001,https://app.example.com`; no wildcard or trailing slash |
| `CLERK_JWT_KEY` | Optional PEM public verification key instead of remote key retrieval; requires deployment updates on key rotation |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Existing database configuration |
| `OPENAI_API_KEY` | Existing AI configuration, not required for login |

Mobile `mobile/.env.development.local` / `mobile/.env.production.local`:

| Variable | Purpose |
| --- | --- |
| `PATCH_API_URL` | API origin; local Simulator usually `http://localhost:3001`; distribution requires HTTPS |
| `PATCH_CLERK_PUBLISHABLE_KEY` | Public key for that backend's Clerk instance |

Mobile builds only read `PATCH_` settings from the mobile directory. Never put a secret key in this file. A production mobile build requires an explicit backend origin and public-key-shaped setting; missing development settings show a locked configuration screen, not guest access. For browser Vite development, add `http://127.0.0.1:5173` to allowed origins and the Clerk development configuration as needed. Next Web at port 3001 is the primary Web verification path.

### Clerk Dashboard tasks

1. Create/configure development and production instances separately. Use matching Web/mobile/API keys within each environment. Set the production domain/DNS according to Clerk setup and deploy over HTTPS.
2. Enable Email as the identifier and **email verification codes** for sign-in/sign-up. Require email verification. For this limited native flow, do not require a password, username, phone number, extra sign-up fields, legal acceptance field, MFA, or additional session tasks. If those policies become necessary, extend the native continuation UI first; it currently fails closed on incomplete authentication.
3. Disable social providers for the Phase 2A release; Apple is deferred. Configure native applications for the bundle identifier `com.patch.learning` using Clerk's Native applications settings. Enable native API access as required by the instance configuration.
4. Configure session maximum/inactivity durations explicitly for the product. Keep default short session JWT lifetime; do not extend it to simulate native persistence. Record chosen dashboard values with deployment configuration.
5. Configure production email delivery/branding and test delivery. Test sign-up, sign-in, wrong/expired code, existing email, session expiry and network failure with real keys before release.

### Xcode / Apple Developer tasks

- Use Xcode with Swift 6.2 support, resolve the pinned Swift packages, and use an iOS 17+ Simulator/device.
- Bundle identifier remains `com.patch.learning`. Select your signing team for a physical device or distribution. Simulator build uses `CODE_SIGNING_ALLOWED=NO`.
- Email login requires no Sign in with Apple, APNs, App Groups, or Keychain Sharing capability. The SDK uses the app's own Keychain. Do not enable those capabilities as part of 2A.
- Set the mobile environment and run `npm run ios:sync:local`, then open/run the existing Xcode project. For distribution use `npm run ios:sync` with production mobile settings and verify the bundle check.

## Database migration and legacy quarantine

`drizzle/0007_tired_king_cobra.sql` is additive: creates only `users`, `auth_identities`, the mapping primary key/foreign key and lookup index. Drizzle metadata is included. Existing business-table `user_id` columns are reused; no table rewrite, review rowid change, or user reassignment occurs. The existing DB initialization mechanism applies unapplied migrations in a transaction on first DB use. Back up and rehearse on a copy of the production database before deployment.

All `loop-owner` rows stay exactly where they are. No Clerk identity maps to that string; newly provisioned users receive random UUIDs and empty private workspaces. Legacy `loop-workspace-v1` browser content is ignored, preserved for separately authorized recovery, and is never automatically copied into a new namespace. The legacy data is inaccessible through authenticated application APIs, but database administrators and the person with direct access to old browser storage still have their existing access.

A later, separate migration should: freeze old writes; back up and count all legacy rows by table; establish the intended owner through an explicit administrator-verified claim (never first signup/email matching); rehearse all ownership updates on a copy; move related rows in one transaction preserving review rowids and operation IDs; verify orphan/cross-owner relationships and counts; record the claim/audit and rollback procedure. Do not run the old import/migration scripts against the new deployment without this review. No part of that ownership migration is executed here.

## Testing

Use Node 22. Automated security tests create temporary/in-memory SQLite databases and freshly signed test RSA JWTs. They exercise real Clerk backend verification and actual route handlers, not an authentication bypass. They check 401, A/B access, spoofed client IDs, issuer/signature/expiry/authorized party/CSRF, mapping uniqueness, legacy quarantine, foreign/missing resources, AI ownership, review/undo/recovery isolation and idempotency. Scope/storage tests cover dispatch, token-refresh races, delayed response JSON, logout and restored workspace mapping.

`npm run test:auth-browser` uses an isolated Chrome profile and the actual React authentication/workspace components under StrictMode, with a test-only SDK/HTTP adapter. It checks no private mount before readiness, reload persistence, A→B switching, an A response delivered after B mounts, logout, and interrupted logout followed by reload. It does not prove real Clerk email delivery, Keychain restoration, or native token issuance. No test fixture is imported by the production app.

Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, `npm run check`, `npm run test:auth-browser`, `npm run mobile:build:local`, `npm run ios:sync:local`, and an Xcode Simulator build. Production mobile compilation can be checked using explicit nonsecret fixture values but is not a real backend connection test.

Manual Web acceptance: configure a Clerk development instance and a disposable DB; sign up A with an email code; create a private set/draft and submit a review; reload and confirm the same account/data; log out; sign up B and confirm empty onboarding; attempt A's set/card IDs with B's credential and confirm denial; return to A and confirm server data, with local drafts cleared by logout. Repeat with two browser profiles and two tabs. Delay a request in DevTools, switch account, and check that no stale result appears.

Manual Simulator acceptance: point `PATCH_API_URL` at that test API, supply the same instance public key, sync and run. Sign up/sign in A with email/code; create/review; terminate and relaunch to verify Keychain session restoration; log out and sign in B; check all account data. Repeat foreground/background and offline/logout/relaunch. Test an expired code and a session expired/revoked in Clerk Dashboard. Inspect WebView storage to confirm it contains only scoped workspace/preferences/logout intent, not auth tokens. Actual Clerk credentials and email access are required for these acceptance checks.

## Next phase: 2B

Add Sign in with Apple through the native ClerkKit/AuthenticationServices path, including nonce/state, native Apple credential exchange and continuity with the same Clerk instance. Add the corresponding Web Apple OAuth path using Clerk. Configure Apple App ID entitlement, Services ID for Web, return URLs/domains and private key/Team ID/Key ID in Clerk. Validate private relay email and explicit, verified account linking; never merge users solely by email. Continue mapping all login methods through the same issuer/subject to internal UUID architecture. Account deletion and Apple revocation need their own approved lifecycle design. Push/APNs, widgets, device installations/jobs, app-group credential sharing, encryption and global revocation remain unimplemented; future local widget/notification snapshots and payload handling must carry the internal owner, clear on departure, and reject stale account updates before display.

## Changed/new files

| Area | Files |
| --- | --- |
| Server credential verification | new `lib/auth-server.ts`, new `app/api/auth/session/route.ts`; updated `app/api/data/route.ts`, `app/api/ai/cards/route.ts`, `app/api/ai/chat/route.ts` |
| Internal users / ownership | new `db/auth-store.ts`; updated `db/schema.ts`, `db/store.ts`; new `drizzle/0007_tired_king_cobra.sql`, `drizzle/meta/0007_snapshot.json`; updated `drizzle/meta/_journal.json` |
| Account lifetime / storage | new `lib/account-scope.ts`, `lib/account-storage.ts`, `lib/auth-platform.ts`, `app/account-context.tsx`, `app/auth-provider.tsx`, `app/sign-up/page.tsx`; updated `app/use-workspace.ts` |
| Private API consumers / logout | updated `app/page.tsx`, `app/onboarding.tsx`, `app/material-manager.tsx`, `app/set-library.tsx`, `app/study-card-editor.tsx`, `app/settings-dialog.tsx`, `app/globals.css` |
| Native bridge / build | new `mobile/native-auth.ts`, `ios/App/App/PatchAuthPlugin.swift`; updated `mobile/main.tsx`, `mobile/vite.config.ts`, `ios/App/App/SceneDelegate.swift`, `ios/App/App.xcodeproj/project.pbxproj`, Xcode workspace `xcshareddata/swiftpm/Package.resolved`, generated `ios/App/CapApp-SPM/Package.swift` |
| Dependencies / configuration | updated `package.json`, `package-lock.json`, `.env.example`, `mobile/.env.example`, `mobile/README.md`; new this document |
| Tests | new `tests/auth-fixture.mjs`, `tests/auth-isolation.test.mjs`, `tests/account-scope.test.mjs`, `tests/fixtures/auth.html`, `tests/fixtures/auth.jsx`, `tests/fixtures/onboarding.html`, `tests/fixtures/onboarding.jsx`, `scripts/check-auth-browser.mjs`; updated `tests/database-client.test.mjs`, `tests/review-delivery.test.mjs`, `scripts/check-onboarding.mjs` |

The onboarding browser test now serves a test-only UI entry with an isolated signed test session. Its backend remains the actual Next API against a temporary database. Production handlers have no test or guest authentication switch. `lib/api-client.ts`, `ARCHITECTURE.md`, and `STATUS.md` have no Phase 2A edits.

## Verification record — 2026-09-12

- `npm run typecheck`: passed.
- `npm run lint`: exit 0; 0 errors, 41 existing warnings (unused variables/images).
- `npm run test:unit`: **84/84 passed**, including existing review/idempotency tests.
- `npm run build`: passed; all four API paths and sign-up page emitted.
- `npm run check`: passed (typecheck + lint + unit + production build).
- `npm run test:auth-browser`: passed (isolated test SDK, actual React lifecycle).
- `npm run test:onboarding-browser`: passed (actual protected APIs; first run, lost response retry, DB resume, three-card lesson, Day 1, home, reload, responsive widths).
- `npm run ios:sync:local`: passed, including `mobile:build:local` and Capacitor sync.
- `npm run ios:sync`: passed with explicitly supplied **nonfunctional public fixture key and HTTPS fixture origin**, including production mobile build. Release bundle validation script passed. This checks compilation/configuration rules, not connectivity to a real service. Local development bundle was restored afterward.
- Xcode Debug Simulator build with ClerkKit 1.5.4: passed using the existing App scheme and iOS 17 minimum. No signing team was required for this build.
- `git diff --check`: passed. Phase 1 ancestor `ca7cafd` confirmed.

Real Clerk Web Email login and iOS Email/Keychain/token persistence still require the deployment's Clerk keys and a reachable configured API; they are manual acceptance checks, not claimed as automated successes. No Apple sign-in, account deletion, global logout, notifications/widgets, legacy migration or deployment was performed.
