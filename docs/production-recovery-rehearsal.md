# Guarded recovery rehearsal — future manual operations

No remote DB was accessed in this task. Commands below are not authorization. Run local fixtures now; run staging only after target approval; production requires explicit authorization naming database, action, time and operator. Node 22, clean reviewed commit, matching schema manifest and full environment contract are prerequisites.

## Local verification

```sh
PATCH_ENV=development npm run db:rehearse-local
```

No URL/provider secret is needed. Tests use in-memory sources, encrypted temp backups and isolated file restores; application reads, review/undo/session recovery, consent, AI dedup, deletion/tombstone behavior and isolation are verified. The fixtures mock external deletion calls; they never delete a Clerk account. Run without production environment files or credentials.

## Staging, then separately authorized production rehearsal

Before execution, securely inject all required server environment values and `PATCH_BACKUP_KEY` (32 random bytes encoded as 64 hex characters) plus approved key ID. Store encryption key independently from backup files. Do not generate a replacement key when attempting to recover old backups. Choose a **new** restricted backup directory and approved checkout on an encrypted, access-controlled machine. Set `DB_ID` to reviewed policy databaseId, `BACKUP_DIR` to that new directory; these shell variables are metadata, never credentials.

```sh
npm run check:env
npm run db:validate -- --allow-remote --confirm-db "$DB_ID"
npm run ops:status -- --allow-remote --confirm-db "$DB_ID"
npm run db:backup -- --allow-remote --confirm-db "$DB_ID" --out "$BACKUP_DIR"
npm run db:restore-check -- --backup "$BACKUP_DIR"
```

Use explicit `PATCH_ENV=staging` or `production` in the reviewed environment, not CLI URL overrides. `db:backup` reads the selected live DB; it still needs prior approval. `db:restore-check` authenticates/decrypts locally and always uses scratch DB; no target/remote flag or production write is needed. Decrypted data resides in scratch until cleanup, so use an encrypted disk and restricted operator access. Interruptions/kill may leave temp directories requiring controlled cleanup. Do not retain plaintext snapshots or paste manifests/counts into public tickets.

Record source release SHA/schema, backup timestamp, opaque key ID/storage location, encrypted hash, validation outcome and elapsed durations in restricted evidence. Measure actual DB size, duration, interruption behavior and RPO/RTO versus the owner's approved objectives. Test retrieving ciphertext AND the correct key from separate custody, including a different recovery operator. Mark backup usable only after a successful authenticated restore-check and offsite copy verification. An uploaded ciphertext file or `BACKUP_OK` alone is insufficient.

## Incident cutover — not automated here

1. Get explicit incident/production maintenance approval. Stop app writes, AI dispatch and deletion scheduling; retain tombstones/deletion receipts and AI ledger evidence newer than the selected snapshot securely. Keep the original DB intact for forensic comparison.
2. Choose a verified backup/key pair and exact compatible code/migration set. Restore to a **new isolated replacement DB**, never overwrite production in place. Current restore-check is validation-only and deletes scratch; a persistent remote restore/import tool and provider-specific cutover must be separately prepared/reviewed. Do not adapt the script ad hoc during an incident.
3. Reconcile all post-snapshot account deletions, lifecycle/tombstones and consent revocations before traffic; prevent resurrection or provider identity recreation. Reconcile post-snapshot AI dispatch/unknown/success records so recovery cannot grant fresh budget/idempotency to prior calls. If evidence is unavailable, keep writes/AI blocked and escalate. Old backups are not evidence of current consent or provider finality.
4. Validate schema/checksums/integrity/row counts and app reads against replacement, then test disposable-account isolation, review/session recovery and deletion using mocked or explicitly approved staging providers. The local fixture rehearsal does not establish correctness of production recovered data.
5. Review downtime/data-loss outcome and rollback target. Only with explicit cutover authorization update the production DB reference/allowlist/secrets, deploy the matching artifact and run smoke checks. Resume worker/AI/writes separately after verification. Observe alerts and document incident results.

Future production **write** CLIs (`db:migrate`, AI stop/resolve/resume) require both `--allow-remote --confirm-db "$DB_ID"` and `--maintenance-confirmation "$DB_ID"`. CI remote targets are prohibited by the existing guard. Do not append these flags merely to bypass a failure. Migrations are never a repair-on-start action.

Remaining decisions: backup interval and retention, deletion propagation deadline into retained backups, recovery evidence retention, storage/cross-region policy, key owners/rotation, RPO/RTO and incident responder. No promises are entered into legal pages until Yota approves them.
