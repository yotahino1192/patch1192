# Mepamo — controlled Production validation and TestFlight gates

Recorded 2026-09-29, on top of local Dev `37acfdc4d254d8b47605737c57a339483bfe42ec`. This is a **documentation-only procedure**, not authorization to change a service, deploy, promote, invite users or invoke deletion. Re-approve the exact resulting Dev SHA before a future deployment; do not deploy the older baseline merely because it appears here.

This procedure resolves the sequencing ambiguity in the master runbook. **Phase A is owner-only infrastructure validation; Phase B is user distribution readiness.** `check:release`, `check:operations`, environment/allowlist checks, artifact checks and native guards remain unchanged. A known incomplete operations handoff is recorded as incomplete, never converted to a PASS or hidden with `|| true`. The existing protected `release_candidate` CI job remains a Phase B gate; do not remove its operations step.

## Phase A — purpose and entry gates

A creates the first Production backend solely for owner-controlled validation, with no TestFlight invitations, external testers or general application traffic. A1 is a protected, unaliased deployment with read-only probes. A2 is a separately approved, still-protected canonical-domain validation window for authentication, monitoring and deletion. A1 does not automatically authorize A2 or public promotion.

All entry conditions must be recorded against the exact candidate:

1. **Source:** reviewed clean Dev SHA; after a separately authorized safe push, local Dev, origin/Dev and GitHub Dev agree. Inspect any newly fetched remote work and integrate/revalidate normally; no force-push, main/default-branch change or unreviewed dirty/untracked upload. Verify linked Vercel project/workspace/repository and source SHA, not only the branch label.
2. **Environment:** actual Production-only configuration validated in a protected execution environment with Node 22, `NODE_ENV=production`, `PATCH_ENV=production`, `AI_ENABLED=false`, Vercel system variables enabled and provider identity Production. All 13 required app variables remain required, including a valid OpenAI key while AI is disabled. No Preview environment may reuse Production credentials. No secret in argv, output, source or downloaded env files; use approved secret injection. If that protected validation environment is not available, STOP rather than substituting fixtures.
3. **Offline gates:** `check:env`, `check:schema`, `scan:secrets`, Production web build, Production mobile build and unchanged `check:release` must succeed for the exact SHA. The mobile artifact is required by the existing release command even though A distributes no mobile app; use `npm run mobile:build`, without native sync/signing changes. Existing relevant regression/CI must pass. Local development checks are not a substitute for these real Production checks.
4. **Database/recovery:** verify target `mepamo-production` and the allowlisted Tokyo Turso URL; accept the recorded initial migration/validation/encrypted-backup/restore evidence only with traceable timestamps and target identity. Confirm schema/integrity/FK/lock status and baseline aggregate counts through separately authorized guarded read-only checks. Confirm an off-Mac ciphertext+manifest copy and recoverable original key. A usable backup must remain within the approved 24-hour maximum success age during the attended validation window; stale/ambiguous evidence blocks entry. No repeat migration or baseline operation. Do not infer recurring backup from the initial manual iCloud copy.
5. **Isolation:** verify protection of the unique URL before any application/account work; no shareable access links, public protection exceptions or tester access. Only the owner and explicitly approved automation may pass the hosting layer. `draft/noindex` is not access control. Do not point general traffic or a native client at the unique URL. Keep all schedules disabled until their intended phase/target is approved.
6. **Change/incident control:** Git-triggered deployment creation must be stopped and verified before push; domain assignment must be skipped for A1. Record operator 日野 陽太, private incident contact, attended window and stop plan. On unexpected access, writes, identity, secret-scan/schema failure or AI dispatch: stop validation, keep AI off, retain/reinstate protection, disable newly enabled schedules and do not promote. A first deployment has no known-good prior deployment to roll back to; never roll back the DB automatically.

Run each offline gate and check its exit status individually in the protected Production environment:

```sh
npm run check:env
npm run check:schema
npm run scan:secrets
npm run build
npm run mobile:build
npm run check:release
npm run check:operations
```

The last command must still return its real nonzero result while evidence is missing. The A operator records the exact missing fields and their phase assignment below, with named ownership and a completion plan. Any unexpected invalid field or failed numeric/reference relationship blocks A. This is a manual phase acceptance record, not a new CLI bypass flag or a claim that the Phase B CI job passed. Do not add a deploy step to ordinary push/PR CI.

## Allowed pending evidence and non-waived prerequisites

Only **live API-dependent evidence** can be accepted as pending in Phase A:

| Item | A limit / point of completion |
| --- | --- |
| `monitoring.deliveryEvidenceRef` | Live health/readiness failure/recovery delivery and actual worker missed-run evidence can wait for A2. Account/receiver setup and synthetic alert delivery do not inherently require a deployed API; complete before relying on unattended monitoring |
| `deletion.completionEvidenceRef` | Requires an approved test account and deployed API; complete in A2 including app-closed, interruption/retry and isolation checks. Idle or HTTP 200/retry is not completion |
| Scheduler/API live outcome and heartbeat evidence | A2 only, preserving POST/Bearer, timeout, lease/backoff and `idle/completed/retry/failed`; stop on ambiguous target |
| Deployment-derived operational evidence | Exact deployment/domain mapping, real readiness, sanitized/no-store responses, no unexpected DB changes, live aggregate/alert correlation; collect in A1/A2 as applicable |

The currently blank `monitoring.providerRef`, `monitoring.destinationRef` and `deletion.schedulerRef` are **setup gaps, not inherently API-dependent evidence**. A1's attended read-only probes may precede their installation, but record that limited scope explicitly. They must be real, verified references before A2 enables their corresponding monitoring/scheduler or starts controlled deletion, and all five references must be complete before B. Prepare/review the Workers adapter and mock timeout/redirect/JSON/retry/lease tests before live scheduler execution; do not relabel missing implementation as missing evidence.

Other scope boundaries are explicit, not live-evidence exceptions:

- `legalAddress` and `effectiveDate` remain intentionally null, and pages remain draft/noindex, only while A is protected and owner-only. They do not depend on an API and are mandatory before B/public user access. The actual deletion completion target is finalized after A2 validation.
- Recurring 12-hour backups/offsite transfer, 24-hour stale alerts, 7-day expiry, deletion reconciliation and RPO24h/RTO48h evidence remain mandatory for B. A is an attended, bounded window covered by verified initial/recent backup and recovery evidence; it must not become ongoing user service or outlive backup freshness. Enabling recurring operations during A requires separate authorization.
- Private receiver setup, synthetic delivery, existing outbound mailbox delivery check and restoration/key-retrieval preparation are real tasks, not automatically postponed because the API is absent. Their applicable gates still apply. No new paid plan/resource or secret retrieval is authorized by this document.

## Staged Vercel deployment: compatibility and limits

Read-only metadata inspection on 2026-09-29: workspace display `mepamo` (CLI scope `campus-ring-3f45e625`), project `mepamo1192`; GitHub `yotahino1192/patch1192`, Production Branch `Dev`; Node 22.x, Next.js, root null (= repository root), `npm ci`, `npm run build`, output null (= default); system env enabled. Git deployment creation is `enabled`, automatic custom-domain assignment true, ignored build command null, protection `all_except_custom_domains`. Registered verified Production domains: `mepamo.com` and `mepamo1192.vercel.app`; latest deployment list empty. These are observations, not changes or proof of future state.

The recommended first action after **all A entry gates and separate deployment authorization** is a source deployment from a clean, exact-SHA checkout linked to the existing project:

```sh
vercel deploy --prod --skip-domain --scope campus-ring-3f45e625
```

Do not run bare `vercel`, omit `--skip-domain`, use `--public`, or manually alias afterward. Do not auto-create/link a new project. Verify project identity first, and inspect what will be uploaded; exclude env/backup/untracked private artifacts. Prefer the remote source build with already-configured Production environment over a `vercel pull` flow that downloads secrets. A separate protected offline validation environment is still necessary for the full preflight above. The remote deployment build alone does not run `check:release` or `check:operations` and cannot replace them.

[Vercel CLI staged deployment](https://vercel.com/docs/cli/deploying-from-cli) and [skip-domain semantics](https://vercel.com/docs/cli/deploy#skip-domain) document Production environment without automatic domain assignment, followed later by explicit promotion. The flag overrides automatic domain assignment for that invocation; it does **not** pause future Git deployments.

Code inspection establishes **conditional compatibility for A1**, not full E2E compatibility on an alternate origin:

| Contract | Required behavior |
| --- | --- |
| `lib/env/server.ts` | `VERCEL_ENV=production` + `PATCH_ENV=production`; Preview + Production identity fails. Keep `PATCH_API_ORIGIN=https://mepamo.com`, `AUTH_ALLOWED_ORIGINS=https://mepamo.com`, existing Clerk/Turso identity unchanged |
| Production system hostname | Vercel selects the shortest registered Production custom domain, independently of the unique deployment hostname. `mepamo.com` is registered, so `VERCEL_PROJECT_PRODUCTION_URL=mepamo.com` is expected; verify the actual supplied non-secret hostname. If it falls back to `.vercel.app`, STOP with `WEB_ORIGIN`; do not spoof a system variable or expand policy |
| Unique `VERCEL_URL` | Not used as the canonical origin by current validation. Health/ready handlers and the missing-token data path can be probed through the protected unique deployment URL without rewriting origins |
| Browser/Clerk/native authentication | Unique URL is not an approved web origin; Clerk origin/session checks and Production configuration remain canonical. Do not add it to allowlists or fake Host/Origin/azp to make login work. A1 is not evidence of canonical login or native functionality |
| Existing deletion caller | `scripts/infra/operations.mjs` explicitly requires the allowlisted canonical origin and rejects redirects. It cannot target the unique URL. Live scheduler/account-deletion E2E waits for protected canonical-domain A2 |

The [system-variable contract](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_project_production_url) supports the hostname distinction. Offline fixtures verify code compatibility only; actual injected environment, deployment protection and domain non-assignment still require provider-side confirmation during the authorized operation. Do not call this a Preview deployment or use the empty `staging` policy.

## Stop Git deployments before a future Dev push

**Do not perform this change in the documentation checkpoint.** Re-check the project/deployment list before the future pause. Neither disabling custom-domain assignment nor setting an Ignored Build Step is sufficient to guarantee no deployment is created.

The deterministic documented manual route is:

1. Vercel → workspace **mepamo** → project **mepamo1192** → **Settings → Git → Connected Git Repository → Disconnect**, confirming that the connection is `yotahino1192/patch1192`. Record current `Dev` Production Branch and settings first. This disconnects this project's Git integration, not the GitHub default branch or repository itself.
2. Verify the Dashboard shows no connected repository (read-only Project API `link` absent/null), no queued/in-flight deployment and no other deploy hook/CI automation that will deploy this project on push. Repository CI currently contains no deploy step. Do not treat unknown status as paused.
3. Fetch Dev again, inspect changes, push normally only when safe, and verify local/origin/GitHub SHA equality plus no new Vercel deployment. Do not reconnect as part of the push; CLI can deploy the existing project manually while Git remains disconnected. Keep recording the exact source SHA independently.
4. Reconnection/re-enablement is a separate approved action after the controlled phase. Recheck Production Branch=Dev and ensure automatic deployments stay disabled before reconnecting; reconnection itself must not become an implicit first deployment.

Official [Dashboard disconnection procedure](https://vercel.com/docs/project-configuration/git-settings#disconnect-your-git-repository) and [CLI Git connection management](https://vercel.com/docs/cli/git). No disconnect/reconnect has been executed here.

A supported repository alternative, requiring its own reviewed code/config change, is `"git": { "deploymentEnabled": false }` in `vercel.json` ([official Git configuration](https://vercel.com/docs/project-configuration/git-configuration)). It is **not added by this documentation change**. Do not assume the existing JSON disables deployments. Do not blindly PATCH `gitProviderOptions.createDeployments`: the current [public OpenAPI](https://openapi.vercel.sh) exposes it in the project response but not in the `updateProject` request schema inspected on this date. An observed response field is not proof of a supported writable API.

## A1 post-deployment sequence — no canonical alias, no user data

1. Check deployment target Production, expected project and exact approved source/artifact SHA, build success and AI disabled. Check deployment aliases and confirm neither `mepamo.com` nor the stable `mepamo1192.vercel.app` Production domain was assigned to this deployment. Do not infer this solely from the CLI flag.
2. Check the unique URL without hosting credentials: it must be denied/challenged by Vercel. Then use the owner's Vercel-authenticated browser to access the unique URL. That hosting identity must not supply a Clerk application session. Do not create shareable links or disable protection for probes.
3. In that context, request `/api/health` → 200 with `status:ok`, `/api/ready` → 200 with `status:ready`, and `/api/data` with no Clerk cookie/Bearer → **application** 401. A Vercel login redirect/401 is not the application's 401. Verify `Cache-Control: no-store`, safe error shape and request IDs without logging cookies/headers containing credentials. Error sanitization failure paths can be covered locally; do not damage Production DB/schema to induce errors.
4. Compare guarded read-only baseline/status after probes: no new application users/content or unexpected AI/deletion changes; no migrations/locks introduced. Health is liveness only; readiness checks schema read-only and does not prove external credentials or deletion completion. Keep raw data/logs private.
5. Record sanitized evidence and stop for review. No promotion, scheduler calls, account creation/deletion or B readiness claim follows automatically. If A2 is not ready, keep the unique deployment protected and unaliased.

## A2 — protected canonical domain and live evidence

A2 needs a separate exact-deployment promotion and controlled-test authorization. Before assigning either Production domain, restrict **all deployment/Production URLs** to the owner and approved automation and verify the settings. Current `all_except_custom_domains` is insufficient. Vercel's [2026-09-09 announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan) says Vercel Authentication with **All Deployments** is available on every plan without extra cost (newer than older pricing/overview text). Future operator path: project → Security → Deployment Protection → Vercel Authentication → All Deployments. Verify availability/effect in this actual account; if unavailable or a paid change is required, STOP for a separate decision. No plan/settings changes are made now.

Once protection, preflight and the exact deployment are approved, the future promotion is `vercel promote <reviewed-deployment-id-or-url> --scope campus-ring-3f45e625`. This assigns Production domains; it is not a harmless status check. Recheck every assigned domain, denial of unapproved access, environment/artifact SHA, canonical probes, and protection immediately. On unexpected public exposure, stop and restore restricted access; no testers are authorized.

Under protected canonical access:

- Verify owner email OTP/session behavior; only explicitly approved disposable account(s) and test data may be created. Maintain baseline/delta evidence and account isolation; no general signup traffic.
- Configure UptimeRobot's approved 5-minute keyword monitors on canonical health/ready, and verify actual notification receipt and failure/recovery. A protected HTML login page must never count as an API success.
- Hosting protection also blocks unattended monitors and the scheduler. Before enabling them, review a secure automation-access design (e.g. a separately protected hosting automation credential, injected as a header). This is distinct from `ACCOUNT_DELETION_WORKER_SECRET` and requires additional approval/setup; it is not one of the existing 13 app variables. Do not expose either credential in URLs, code, logs or monitoring payloads, and never share the deletion worker credential with uptime monitoring. If the chosen free tools cannot securely reach the protected API, STOP this step rather than weakening protection or declaring live evidence complete.
- The pending Workers adapter must preserve POST-only, Bearer worker authentication, allowlisted `mepamo.com`, redirect rejection, 55-second caller timeout, current server lease/backoff and `idle/completed/retry/failed`. No Turso credentials in the scheduler. Any hosting-access header support requires separate reviewed implementation; the existing caller cannot be assumed to inject it.
- Enable the reviewed every-minute runner only after target/queue review; verify idle heartbeat, approved account deletion with app closed, interruption/retry and eventual completion. HTTP 200/retry is not completion. Healthchecks must detect failure/missed runs and recovery; retain retry/backlog evidence across later idle ticks.
- Establish separate guarded read-only `ops:status` every 5 minutes, 15-minute missing-success alert and structured failure thresholds. Finish real evidence references, deletion completion target, recurring backup/offsite/expiry/reconciliation and retrieval/recovery verification. AI stays disabled unless separately authorized for controlled live validation.

## Phase B — distribution acceptance (Internal and External TestFlight)

Before any tester invitation/distribution or removal of owner-only restrictions:

- Final public documents: approved publishable `legalAddress`, actual first-tester `effectiveDate`, accurate retention/backup/deletion completion claims and outbound notice delivery. Explicitly approve transition out of draft; do not set it automatically during A.
- Real monitoring/provider/private destination/delivery evidence and scheduler/deletion completion evidence; reviewed timestamps, configured receiver and single-operator absence policy. All five operations references complete; **unchanged `check:operations` must PASS**. Reference syntax alone is insufficient.
- Verified recurring backup/operations, 12h schedule, usable backup age ≤24h, 7d expiry, deletion/consent/AI reconciliation, separate existing-key recovery and measured RPO24h/RTO48h objectives. Initial copy/restore is not recurring evidence.
- Full exact-candidate Production checks including unchanged `check:release`, protected release-candidate CI and required regression. Real auth, isolation, consent/deletion and core-flow evidence; any enabled AI requires separately approved live validation. Disabled AI must not be presented as validated/enabled.
- Existing physical iPhone/iPad Release QA, Widget/App Group/notifications, signed entitlements/provisioning, version/build, archive validation, App Store Connect access/compliance/upload and Internal tester eligibility gates in the master runbook. External distribution additionally requires applicable Apple beta review/metadata and approved audience. No native guard is waived by A.
- Explicit promotion/access/distribution approval for the reviewed candidate. Rebuild/revalidate when code/config changes; moving a domain or opening user access does not inherit authorization from a previous smoke test.

## Documentation checkpoint verification

Node 22.23.2, documentation-only checkpoint:

| Check | Result |
| --- | --- |
| `node --test tests/infra-env.test.mjs tests/infra-operations.test.mjs tests/infra-operations-config.test.mjs tests/public-pages.test.mjs` | 27/27 pass, including unchanged full offline release gate with synthetic bound artifacts and rejection of leaked fixture credentials |
| In-memory compatibility check using actual release policy and disposable synthetic inputs | Canonical Production identity + unique VERCEL_URL accepted; Preview identity, fallback Production hostname, alternate API origin, alternate allowed origin and missing AI key all rejected; unique scheduler origin rejected before any network call |
| `npm run check:schema` | SCHEMA_MANIFEST_OK |
| `npm run scan:secrets` | SECRET_SCAN_OK |
| `npm run check:operations` | Expected exit 1 on the same five known missing references; no guard changed |
| Relative documentation links / `git diff --check` | Pass |

No actual Production environment values, DB data, application traffic, external configuration, deployment or push were used for these checks. Vercel project/domain metadata and public provider documentation were read only. No Production artifact build/live check is claimed; docs-only changes do not require another native/web build. Real Phase A preflight remains outstanding. All application/config/workflow files are unchanged from parent Dev.
