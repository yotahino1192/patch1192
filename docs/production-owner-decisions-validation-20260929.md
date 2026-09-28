# Mepamo owner decisions checkpoint — validation 2026-09-29

Branch: `codex/testflight-production-readiness`, parent `a0978c1375b37ba9b288c4bc3f152ce2fa57f120`. Approved Dev baseline remains the owner-supplied `0e69f2f5fb2d438d14e50a1c1f4f5914ac72a4d8`; no fetch/merge/push was part of this checkpoint. [Approved Sections 1–9 / remaining gates](release-owner-inputs.md).

## Scope

- Record all approved owner decisions, retaining `legalAddress=null`, `effectiveDate=null`, draft/noindex. Contact support@mepamo.com is now an actual mailto link; its inbound-only service status is documented separately from the manual outbound notice plan.
- Public copy uses actual conditional retention, approved rights/liability/notice terms and overseas processing disclosure; current Free v1 and AI-disabled state remain intact. Remove obsolete unconfigured-contact/undecided-terms prose without changing application behavior.
- Record named operator/recovery owner, approved 12h / 24h / 7d / RPO24h / RTO48h targets, owner-confirmed iCloud initial copy, separate Passwords custody and existing `mepamo-production-v1` key ID.
- Record Workers Free + Cron / Healthchecks.io Free architecture and UptimeRobot Free selection as pending external implementation/setup. Do not fill live-service references or fabricate delivery/deletion evidence.
- No worker/API/lease/retry/timeout/DB code or validation guard was changed. No native IDs, signing, main, Production environment/services, deployment or AI enablement change.

## Checks

Node **22.23.2**; local development fixtures only. No Production credentials retrieved and no hosted DB accessed.

| Check | Result |
| --- | --- |
| `node --test tests/public-pages.test.mjs tests/infra-operations-config.test.mjs tests/infra-operations.test.mjs` | **11/11 pass**: public/embedded rendering, contact validation, draft/noindex guards, operations config rejection, guarded worker outcomes and local read-only aggregate status |
| `npm run typecheck` with `PATCH_ENV=development AI_ENABLED=false` | **Pass**. First invocation without PATCH_ENV correctly stopped with CONFIG_INVALID:PATCH_ENV; rerun supplied the local development identity, without weakening validation |
| `npm run lint` | **Pass**, 0 errors / 11 existing warnings in unchanged files |
| `npm run build` in a cleared environment with local development identity and AI disabled | **Pass**: ENV_VALID, SCHEMA_MANIFEST_OK, SECRET_SCAN_OK, WEB_ARTIFACT_SEALED. This is a local validation artifact, not a Production deployment artifact |
| `node tests/public-pages-browser.mjs` | **Pass**: anonymous 200, noindex, 320/768/1280 reflow, headings/anchors, keyboard skip/focus, no-JS content and embedded navigation; no auth/API/DB access. Initial sandbox attempt timed out starting localhost; rerun with localhost/browser permission succeeded |
| Public publication state inspection | Exactly **legalAddress, effectiveDate** null; draft; `canIndexPublicPages()=false`; contact mailto valid. Final publication intentionally blocked |
| `npm run check:operations` | **Expected exit 1** on exactly the five missing external/evidence references below; populated references and numeric relationships accepted |
| `node scripts/scan-secrets.mjs` | **SECRET_SCAN_OK** |
| `git diff --check` | **Pass** |

Remaining operations fields: `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.deliveryEvidenceRef`, `deletion.schedulerRef`, `deletion.completionEvidenceRef`. An approved provider choice is not a configured collector, and an idle deletion tick is not completed-account evidence.

## Acceptance boundary

Ready for review and later Dev integration as an honest partial configuration checkpoint; **not ready to mark operational handoff complete or publish final legal pages**. No full unit suite, mobile/iOS rebuild, hosted configuration inspection, external notification delivery, cloud retrieval, key recovery or live deletion validation is claimed. Those were not necessary to validate this copy/config-only change and remain scoped to their corresponding operational/release steps.

The owner still intentionally owes a publishable address and exact first-tester date before public finalization. Remaining external work: monitoring and alert delivery, reviewed scheduler adapter and hosted wiring, controlled post-deployment deletion evidence/completion target, separate guarded aggregate-status monitoring, recurring backup/offsite/expiry automation and retrieval/recovery rehearsal, and outbound notice delivery test. Initial backup/restore success and manual iCloud copy do not prove those operations.
