# Mepamo safe configuration checkpoint — 2026-09-28

Base: fetched `origin/Dev` **0e69f2f5fb2d438d14e50a1c1f4f5914ac72a4d8**. Branch: `codex/testflight-production-readiness`. This checkpoint records confirmed facts and preserves unresolved gates; it is not a Production release approval.

## Changes

- Public Mepamo brand and canonical `https://mepamo.com/{privacy,terms,support}`.
- Free v1 free/no-billing commercial statement; current Flashcards/MCQ and short Explain scope. Deferred capabilities are not advertised as available; AI is explicitly currently disabled.
- Turso Tokyo placement disclosed without claiming every provider processes only in Japan.
- Initial bootstrap/backup/restore recorded as owner-reported evidence, without rerunning or independently attesting it. Existing reconciliation procedure referenced without claiming live recovery readiness.
- [One owner questionnaire and complete field classification](release-owner-inputs.md); public fields 19 → 18 missing, operations fields 17 → 15 missing. Draft/noindex/contact guard and operations validator unchanged.

## Validation

All execution below used Node **22.23.2**, development fixtures and no Production environment/credentials.

| Check | Result |
| --- | --- |
| `node --test tests/public-pages.test.mjs tests/infra-operations-config.test.mjs tests/infra-restore.test.mjs` | 10/10 pass (public 5, config 3, isolated encrypted restore 2); external AI/deletion calls mocked |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass: 0 errors, 11 pre-existing warnings outside changed files |
| `npm run build` | Pass with ENV_VALID, SCHEMA_MANIFEST_OK, SECRET_SCAN_OK, WEB_ARTIFACT_SEALED; local development identity, not a Production artifact |
| `node tests/public-pages-browser.mjs` | Pass: anonymous HTTP 200; draft noindex; 320/768/1280 reflow; keyboard skip/focus; no-JS content; embedded navigation; no API/auth/DB access. Initial sandbox attempt timed out starting localhost; rerun with localhost/browser permission passed |
| Public publication validation | **Not publishable:** 18 fields unresolved; `publicationStatus=draft`, `canIndexPublicPages()=false`, no fake mailto |
| `npm run check:operations` | **Expected exit 1**, 15 unresolved fields below; filled references accepted |
| `git diff --check` | Pass |

Operations still requires `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.responderRef`, `monitoring.deliveryEvidenceRef`, `deletion.schedulerRef`, `deletion.completionEvidenceRef`, `backup.storageRef`, `backup.keyCustodyRef`, `backup.keyId`, `backup.recoveryOwnerRef`, `backup.intervalHours`, `backup.maxSuccessAgeHours`, `backup.retentionDays`, `backup.rpoHours`, `backup.rtoHours`.

No changes to API/database behavior, bounded materials collection/detail architecture, learning/MCQ/import, retention/notifications/Widget native implementation, IDs or signing. No full unit-suite/iOS build rerun is claimed for this public-copy/config-only checkpoint. Web/mobile shared legal rendering is covered by static and browser tests.

No Dev merge/push, main change, deployment, AI enablement, Production DB command, credential retrieval or external configuration change performed. There is no new code-regression blocker found for review/integration of this **partial** checkpoint; remaining owner/external items still block complete Production readiness. Before future AI enablement, update the public disabled-state copy with the reviewed candidate; this copy does not itself control AI admission.
