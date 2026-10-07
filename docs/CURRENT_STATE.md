# Mepamo — current operational state

Document last updated: **2026-10-07 (Asia/Tokyo)**.

Last owner-confirmed operational snapshot: **2026-10-06**. Individual live-check timestamps are not recorded here; Production, monitoring, TestFlight and other external services were **not freshly verified on 2026-10-07**. The document update date is not an operational verification date.

This is a frequently updated operational snapshot, **not a Product requirements document or release approval**. Keep facts dated and distinguish repository inspection, owner reports and live verification. Update it after relevant work without rewriting historical evidence. Do not store secrets, private alert addresses, token-bearing URLs or user data here.

## Sources and reference locator

- Longer-lived Product / Domain / Release authority: [v3.0 unified requirements](mepamo-unified-requirements-v3.0.md), faithfully converted from the finalized DOCX. Current implementation/tests establish actual technical behavior; this file records frequently changing operational state. The requirements document's dated operational snapshot is not fresh live evidence.
- Technical/application baseline below: implementation and tests at `aa1c7f48357d59604d307b6f488125632fe4e9b4` were inspected on 2026-10-06. Local `Dev` and cached `origin/Dev` refs were rechecked on 2026-10-07 before the documentation-only commits. Dev HEAD may advance when documentation is integrated without changing this application baseline. No remote fetch or live-service verification was performed.
- Live service/TestFlight facts below: **owner-reported current state**, including the completed monitoring/scheduler validation. No external service or DB was queried during this documentation task. These facts are not fresh release/backup evidence.
- [STATUS.md](../STATUS.md) and dated checkpoint documents retain historical evidence; their older “current” labels are not this snapshot. Existing release guards and runbooks still apply; this file does not waive them.

## Current state

| Item | Recorded state / evidence boundary |
| --- | --- |
| Public brand | Mepamo |
| Application/code baseline SHA | `aa1c7f48357d59604d307b6f488125632fe4e9b4` — last verified application baseline; documentation-only commits may advance Dev HEAD without changing this application baseline |
| Git branch HEAD | Read from Git when needed and intentionally not embedded here; verify the current branch, `Dev` and remote refs from the repository before integration or release work |
| Production app SHA | `aa1c7f48357d59604d307b6f488125632fe4e9b4` — owner-confirmed; independently versioned from Worker |
| Production deployment | Serving `https://mepamo.com`; healthy per latest confirmed operational state. Vercel Git integration last confirmed disconnected; verify before any future push that could deploy |
| Active Internal TestFlight | **1.0 (1)** installs and launches on a physical iPhone; Production OTP and AI material generation work (owner report) |
| Production AI | **Enabled**. Earlier `AI_ENABLED=false` checklists describe the initial controlled deployment stage, not current runtime state. Changing admission still requires explicit approval |
| External TestFlight | Group **Mepamo friends** is in **Beta App Review**; approval/distribution is not confirmed |
| Worker | `mepamo-deletion-scheduler`; separate fix commit `cfae8d9cd4f12ddf9b45e2917dafaeddc8d4f58a`, branch `ops/deletion-scheduler-workerd-fix`. Do not merge it into Dev implicitly |
| Scheduler evidence | Last confirmed enabled, Cron `* * * * *`, no public Worker URL; five consecutive Production invocations reported `idle` / heartbeat `ok` |
| Monitoring | UptimeRobot Health (`/api/health`, `"status":"ok"`) and Ready (`/api/ready`, `"status":"ready"`), 5-minute keyword monitoring, reported Up; email incident delivery observed. Healthchecks.io scheduler heartbeat reported healthy |
| Recovery | Initial encrypted backup, restore-check and off-device copy previously confirmed. Current backup age, recurring execution and retention enforcement are **not freshly verified here** |
| Native identifiers | App `com.patch.learning`; Widget `com.patch.learning.widget`; App Group `group.com.patch.learning.retention` — preserve |

## Known gaps and conflicts to resolve separately

- For Product / Domain / Release decisions, read the [canonical v3.0 requirements](mepamo-unified-requirements-v3.0.md); report any conflict with inspected implementation or current operational evidence without silently rewriting the requirements.
- At the inspected Dev SHA, `lib/public-pages/config.ts` is still `draft`; `legalAddress` and `effectiveDate` are null. `processingRegions` still says AI is stopped and Vercel is in `iad1`, despite subsequently enabled AI and previously confirmed `hnd1` deployment. Public copy needs separately approved review against actual configuration; this task does not edit it.
- `config/production-operations.json` still has empty `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.deliveryEvidenceRef`, `deletion.schedulerRef` and `deletion.completionEvidenceRef`. Completed monitoring/idle-scheduler setup does not automatically populate or satisfy these evidence fields.
- Real account-deletion E2E and a validated deletion completion target have no completion evidence in the supplied state. Idle scheduler runs are not deletion-completion evidence.
- Recurring backup/offsite-copy/retention and aggregate `ops:status` monitoring evidence need confirmation. Previously successful one-time backup/restore is not proof of recurring operation.
- External Beta App Review remains pending. A functioning Internal build does not establish full distribution-readiness gate completion.

## Next five recommended actions

1. Review the relevant section of the [canonical v3.0 requirements](mepamo-unified-requirements-v3.0.md) before further scope decisions.
2. Record the Beta App Review outcome for **Mepamo friends** and any requested follow-up; do not assume approval or broaden distribution automatically.
3. Plan the smallest approved public-document correction: legal address/effective date, AI availability and actual processing-region wording; preserve current source until approved.
4. Register non-secret references for completed monitoring/scheduler evidence and confirm recurring operations evidence. Plan an explicitly approved disposable-account deletion E2E; do not run it implicitly.
5. Continue scoped TestFlight QA with isolated branches/worktrees, record evidence and remaining risks, and run the applicable release gates before the next distribution/release decision.

## Operational references

- [Master TestFlight go-live runbook](testflight-go-live-runbook.md)
- [Controlled Production validation](controlled-production-validation.md)
- [Phase A final operator checklist](phase-a-final-operator-checklist.md) — initial-deployment procedure; do not blindly rerun against the already-live service
- [Production operations readiness](production-operations-readiness.md)
- [Production configuration contract](production-configuration-contract.md)
- [Owner decisions](release-owner-inputs.md)

Use these procedures with the actual approved target, current configuration and fresh evidence where required. Never change Production just to make this snapshot match an older checklist.
