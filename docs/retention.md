# Patch Retention System

Implementation base: Dev `7f2800ef8378eaacb3f859f910a5c94778d11577`. This branch is not merged or deployed.

## Authority and persistence

`db/retention.ts` owns the authenticated user's clock, Study Session evidence and Due Count. `GET /api/retention` returns the shared snapshot; `POST` starts a session or updates notification preferences. `/api/data` includes the same snapshot after review/undo. No client-supplied owner, completion flag, duration or streak is accepted. API access uses the existing Clerk/account-scope/lifecycle guards. The migration is **0010_gifted_hitman.sql**, following 0009; historical migrations are unchanged. Runtime initialization still only validates schema. Apply 0010 through the existing explicit operator migration runner, never at request time. No hosted DB has been migrated.

- `retention_state`: user-scoped logical day, actual deadline, effective/pending IANA timezone, opt-in notification preferences.
- `study_sessions`: user + session ID primary key, immutable assigned card IDs, server-estimated duration, qualification, onboarding exception, completion time and earned day. Lifecycle triggers reject writes after deletion begins.
- Review and undo update session completion in the **same transaction** as review evidence. Streak is derived from distinct earned days, without the 500-row UI history limit. Replaying a review operation or starting the same session cannot add a second achievement.
- A regular official Study Set plans approximately 300–600 seconds using card text length, format and difficulty. Assignment stops when its duration budget is met, not at a fixed number of cards. All assigned cards must be recalled successfully; `again` stays unfinished. A smaller material is short practice and does not qualify for Streak. Actual stopwatch time is not a gate. Initial onboarding's three-card completion is the explicit Day 1 exception, including `again` answers. Undo removes the achievement if it removes its only completed qualifying session.
- One earned day counts once. Days 1–4 are Normal, 5+ Hot. Yesterday's streak remains live until today's deadline; missing a complete logical day breaks it. Existing legacy daily-review completion records are not silently converted to official-session evidence.
- Due Count includes reviewed, active cards with `due_at < dayEnd`: overdue, later today and long-term review. New, archived and deleted cards are excluded. Home and native outputs use this same list/count.

## Timezone, DST and travel

First data load sends the device's IANA timezone. The server computes the next actual local-date boundary, including 23/25-hour DST days. A requested travel timezone is queued until the **existing** deadline. At that deadline, any partial day before the new zone’s midnight is grace on the existing logical day; the next full local day advances the counter. This avoids a one-hour travel day or a second achievement opportunity. Logical day numbers never go backwards. A repeated local date cannot replay an old achievement, and moving timezones cannot reset an active day's deadline. The device clock is used only for presenting an already timestamped server snapshot. General historical record charts still use the existing Tokyo grouping; they are not Streak authority.

## Continue and links

`lib/continue-learning.ts`: onboarding → local interrupted session → server interrupted session → today's due → recently studied material with new cards → other material with new cards → import. Invalid/missing resources fall back to Home. Schemes are strictly allow-listed: `patch://continue`, `patch://review/today`, `patch://set/{id}`, `patch://card/{id}`. No credential/query/fragment is accepted.

SceneDelegate captures cold/background URL launches and cold notification responses. The notification delegate captures taps. The private React tree consumes an intent only after auth and workspace hydration, fetches user-scoped data, and resolves against authorized resources. A server-restored session loads its complete session review history before reconciliation. Pending intents are bounded to one native entry and expire after five minutes; intents bound to another account are discarded. Network failure reports a retry message and returns control to the app; reopening the link retries it.

## Local notifications and cleanup

Settings exposes Review reminder, time and Streak warning. Permission is requested only after explicitly enabling and saving notification settings, never on initial launch. Both notifications are one-shot for the known current day; future unknown counts are never repeated. Warning is scheduled once at `dayEnd − 3h` only for a live, unfinished streak. An app-private scheduled-time ledger prevents resending a day’s warning after delivery or travel grace, even if its notification was dismissed. Account cleanup deletes this ledger. Sync replaces pending Patch notifications, canceling review when due is zero and warning when completed. Denied OS permission is explained without disabling learning.

Main App refreshes on foreground, every 30 seconds while mounted, settings changes and review/undo responses. `lib/retention-platform.ts` serializes activation/publication/cleanup and invalidates late responses by owner/epoch. The existing account cleanup registry invokes Retention cleanup on logout, switch and deletion. Failed cleanup retains the existing durable logout/deletion retry intent. Confirmed native signed-out restoration also clears old snapshots and notifications. Native ownership is app-private; no Clerk credential enters the group.

**Local-only limitation:** another device's completion/deletion cannot update a terminated device immediately without push/background delivery. Its snapshot expires (at most six hours, no later than the day deadline); pending current-day notifications can remain until that device next synchronizes. This is not a claim of cross-device real-time cancellation. Push/APNs is deliberately excluded.

## Widget and native targets

`App → PatchRetentionPlugin → atomic App Group JSON → WidgetKit PatchWidget`.

- App Group: `group.com.patch.learning.retention` (provisional identifier).
- Extension bundle: `com.patch.learning.widget`; host remains `com.patch.learning`.
- Small: Streak, state, existing Patch character. Medium adds Due Count and Continue label. Entire widget links to `patch://continue`.
- States: SIGNED_OUT, NEW_USER, NORMAL, AT_RISK (≤6h), LAST_CHANCE (≤3h), COMPLETED, BROKEN, STALE. Mint/green normally; red for Last Chance. Stale hides counts until refreshed. Timeline contains threshold/expiration entries; WidgetKit controls actual reload timing.
- Snapshot is a typed allow-list: counts, state inputs, times, timezone and version. No email, material, card IDs, chat, DB connection or token. The Swift decoder/encoder strips unknown fields; file writes are atomic. The widget has no network/data-store/auth dependencies.
- App Group unavailable: local notifications can still work, but group publication is reported unavailable by the bridge. No fallback reads from web storage or credentials. Real shared-container entitlement behavior must be accepted on a signed personal-team build.
- Required-reason manifest documents app-private UserDefaults use. This does not complete App Store privacy questionnaires or the full release privacy review.

## Verification and manual acceptance

Automated: Node 22 `npm run check`; auth/privacy/onboarding browser flows (onboarding runner also covers Retention links, restored session and snapshot projection); pure policy and real libSQL transaction tests; Swift state/Codable tests; mobile local build; unsigned Simulator App + embedded Widget build.

Swift policy command:
```
xcrun swiftc ios/App/Shared/RetentionSnapshot.swift tests/RetentionSnapshotTests.swift -o /private/tmp/patch-retention-tests
/private/tmp/patch-retention-tests
```

After personal Apple Developer enrollment: reserve final host/extension/group IDs; enable the **same App Group for both targets**, select only the personal team and generate profiles; verify signed physical-device sharing, widget gallery/sizes/timeline, locked-device notifications/taps, OS permission denial, logout/deletion cleanup and travel. Build an approved staging/production mobile artifact with the existing release allowlist and signing flow. Do not use a company team. App Store/TestFlight distribution and real Apple portal/provisioning operations are not performed here.

No APNs, push, Sign in with Apple, background scheduler, production configuration or deployment is included. Mobile production builds remain blocked by existing release guardrails until approved endpoints/Clerk instance are configured. Existing AI consent, cost controls, deletion, backup/restore and legacy `loop-owner` ownership rules remain in place.
