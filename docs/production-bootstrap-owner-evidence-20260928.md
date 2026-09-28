# Production bootstrap — owner confirmation recorded 2026-09-28

This is a non-secret record of Yota's completion report in this readiness session, not an independent rerun or a copy of private logs. The date is the record date; execution timestamps, backup hashes, key identifier and custody have not been supplied. Do not infer them.

- Approved source Dev: `0e69f2f5fb2d438d14e50a1c1f4f5914ac72a4d8`.
- Database ID: `mepamo-production`.
- Database URL: `libsql://mepamo-production-yotahino1192.aws-ap-northeast-1.turso.io`.
- Owner reported: `FRESH_DATABASE_CONFIRMED`, `MIGRATION_OK`, `DATABASE_VALID`, operations status AI/deletion counts all zero, `FRESH_DATABASE_VALIDATED`.
- Owner reported: initial encrypted Production backup completed and restore-check succeeded (`RESTORE_VALID`).
- Owner reported: no Production deployment; `AI_ENABLED=false`.

`backup.restoreEvidenceRef` references this completed initial restore-check report. It does **not** certify recurring backups, an offsite copy/retrieval, separate key recovery, an alternate operator, alert delivery, a recovery-time objective, or a live replacement/cutover rehearsal. Those remain open. No Production DB command was run for this repository checkpoint.

`backup.reconciliationPlanRef` references the existing [incident recovery plan](production-recovery-rehearsal.md): preserve newer deletion/tombstone/consent and AI evidence, restore into an isolated replacement, reconcile before traffic, and keep writes/AI blocked when evidence is missing. This is a documented procedure, not an installed operational service or evidence of a Production cutover. Local restore fixtures cover the relevant application invariants; real custody, evidence retention and replacement tooling still need owner decisions and external preparation.

Keep original logs, encrypted backup/manifest, timestamp/hash and key mapping in restricted owner-controlled custody. The public repository records only the result and its provenance. Do not put keys, tokens, raw manifests or user data here.

## Subsequent owner custody confirmation — 2026-09-29

The owner subsequently confirmed the initial encrypted backup folder was manually copied to private iCloud Drive **Mepamo Production Backups**, the existing encryption key is separately in macOS Passwords under **Mepamo Production Backup Key v1**, and manifest `keyId` is **mepamo-production-v1**. [Exact reference mapping and limits](release-owner-inputs.md#9-暗号化バックアップ保管鍵custody). This supplements the earlier report; no new restore, offsite retrieval, key recovery or recurring schedule was independently tested. The initial copy is accepted as off-device/off-Mac custody, not recurring offsite automation.
