> Updated backend implementation and AI-specific recovery constraints: [Production Hardening](production-hardening.md). The Phase 1 verification record below is historical.

# Production Infrastructure Hardening Phase 1

This is infrastructure, not AI budget/rate limiting or Privacy/Consent/Account Lifecycle.
No Production services have been configured, migrated, backed up, restored or deployed by this change.
Phase 2A behavior remains covered by its existing tests. iOS Email/Keychain and Sign in with Apple remain deferred until the personal Apple Developer account is ready. Company Apple assets must not be used.

## Environment and release trust

Set PATCH_ENV explicitly to development, staging or production. NODE_ENV controls compilation, not deployment identity.
Local commands require PATCH_ENV=development (or an ignored .env.local with that value). Run db:migrate explicitly before starting the app; requests never apply migrations, including in development.

config/release-policy.json is the reviewed, nonsecret allowlist. Both hosted allowlists intentionally start empty. Register actual origins, Clerk issuers, full database URLs, database ID and approved model names through a reviewed change before hosted builds can succeed. Do not populate them with dummy examples to silence validation.

Server inputs: VERCEL_PROJECT_PRODUCTION_URL (approved Web hostname; avoids metadata localhost fallback), PATCH_ENV, PATCH_API_ORIGIN, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_ISSUER, AUTH_ALLOWED_ORIGINS, CLERK_SECRET_KEY, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, OPENAI_API_KEY, OPENAI_CARD_MODEL, OPENAI_CHAT_MODEL.
Mobile inputs (only these public values are injected): PATCH_ENV, PATCH_API_URL, PATCH_CLERK_PUBLISHABLE_KEY, PATCH_CLERK_ISSUER. Root server .env is never loaded by Vite.
No APNs/Apple secret belongs in PATCH_*, NEXT_PUBLIC_* or VITE_* variables.

Production requires live Clerk, exact issuer/key-host match, HTTPS approved public DNS origins, approved hosted DB, nonfixture credentials and approved models. All IP literal endpoints are rejected, including public IPs, to avoid ambiguous private/loopback encodings. Local, test, example and bypass configurations fail closed. Staging uses its own allowlist and may use Clerk Development.
Credentials are format-validated offline, not authenticated with providers. Before actual deployment an operator must verify that each key belongs to the correct instance/project and that permissions are minimal. A syntactically valid key does not prove this.

The server module imports node:fs and is checked against transitive client imports. next.config does not inject server environment values. Secret scanning covers tracked/untracked nonignored repository files and public/server build artifacts; Publishable Keys are public and are not flagged as secrets. Exact known secret values are also scanned in release artifacts. Pattern scanning is defense in depth, not a substitute for secret-store access control.

## Commands

- npm run check:env: validate current server configuration, no connections.
- npm run db:migrate: explicitly migrate the configured development DB.
- npm run db:migrate -- --baseline: adopt an unmanaged existing DB ONLY if its full schema equals the complete current migration schema.
- npm run db:validate: read-only history, checksum, schema, FK and ownership verification.
- npm run check:schema: validate checked-in schema manifest against all immutable SQL.
- node scripts/check-schema-manifest.mjs --write: regenerate manifest AFTER adding reviewed migrations; never rewrite old SQL.
- npm run db:backup -- --out <new-directory>: encrypted snapshot + manifest.
- npm run db:restore-check -- --backup <backup-directory>: restore only into a fresh temporary DB, validate, delete it.
- npm run scan:secrets: repository secret scan and client dependency boundary scan.
- npm run check:release: Production config, Web/mobile artifacts, secrets and local migration rehearsal. No external service connections. This is an OFFLINE gate, not a deployment authorization.
- npm run test:infra: invalid config, artifact, migration failure/lock, backup/restore and actual review/undo/session recovery tests.

Remote DB commands additionally require --allow-remote --confirm-db <allowlisted-database-id>. Production migration also requires --maintenance-confirmation <same-id>. CI refuses remote DB commands. These flags express operator intent, not proof that writes are stopped. Use the maintenance checklist below. The scripts must never be run against Production just to complete development tests.

## Migration design

Business SQL 0000 onward is immutable. The explicit runner records name, SHA-256, applied_at, release_sha, runner_version and applied status in _patch_migrations. _patch_migration_runs records running/succeeded/failed outcomes with sanitized codes. _patch_migration_lock holds a database-clock lease and monotonically increasing fence.

Runtime uses config/schema-manifest.json and SELECT/PRAGMA only. Missing/mismatched schema returns 503 SCHEMA_NOT_READY through the existing auth error response path before business queries. The runtime does not import the runner or construct an in-memory migration DB.

Runner checks exact applied-prefix checksum and schema. No SQL IF NOT EXISTS rewriting, implicit column skipping or drift repair. Infrastructure tables use explicit CREATE IF NOT EXISTS only inside the runner. The legacy _loop_migrations table is preserved, but names alone are not trusted. Baseline requires exact full-schema match; partial/unknown legacy schemas fail and require a reviewed repair/adoption plan. Baseline history is registered in one transaction; interruption rolls back the entire registration. It is a controlled maintenance operation.

Each migration is a short write transaction. Lock owner, fence and unexpired lease are checked before work and immediately before commit; the write transaction prevents another runner acquiring the lock before completion. An expired/superseded runner cannot start/continue a later transaction. Long work must be split into reviewed short migrations/backfills; do not increase the lease to hide libSQL transaction timeout failures. Remote libSQL may have a roughly five-second transaction limit: rehearse remotely with the actual engine/plan and reject migrations that cannot fit. No external network calls inside a migration transaction.

If COMMIT throws, the transaction is closed and committed history/checksum is read before any further action. A matching applied entry permits continuation; missing/indeterminate state fails MIGRATION_COMMIT_UNCERTAIN. Never retry the SQL blindly. Transactional failures preserve the successfully committed prefix; fixes are reviewed before explicit rerun.

New business migrations require Drizzle schema/SQL, updated schema manifest and rehearsal together. This change adds no AI tables or business FKs. db:validate independently checks owner references, JSON card references and actual FK validity; legacy loop-owner rows require a separate quarantine/ownership migration, never automatic reassignment.

## Backup and recovery

PATCH_BACKUP_KEY is a 32-byte key supplied as 64 hexadecimal characters via the secret store; PATCH_BACKUP_KEY_ID identifies its version. Never pass it on the command line or print it. Retain old decryption keys for the lifetime of their backups.

Backup pins a read transaction, validates the DB, reads tables ordered by rowid, and writes an authenticated AES-256-GCM snapshot with mode 0600. Manifest includes schema checksum, release SHA, timestamp, nonsecret DB identifier, row counts, content hash, key ID and encrypted artifact hash. Data never goes to stdout. Internal migration lock/run tables are excluded so restoring cannot resurrect a held lock. Applied migration history is included.

Restore always uses a generated temporary directory and new local DB; it cannot target/overwrite Production. It verifies artifact hash, AES authentication, schema, every row including original rowid, counts, FK, ownership and integrity. The automated behavioral test additionally runs real store load/session recovery, operation ID replay and undo against the restored DB. A successful structural check alone is not the entire production acceptance test.

This snapshot implementation is for Patch's small current database. It reads the snapshot in memory and fails if the remote transaction times out. A failed/partial backup is NOT usable. At larger size use a fixed PITR clone plus provider-supported fully synchronized snapshot with equivalent rowid/integrity validation. Turso export alone may omit recent changes and must not be assumed current. No SQL dump that renumbers review_logs.rowid is acceptable. Nothing changes Retention's study-order semantics.

Recommended Production settings (NOT configured by this branch):
- PITR minimum 10 days, ideally 30, subject to plan.
- Independent encrypted backup every 6 hours, in a different provider/failure domain.
- Keep six-hour snapshots 7 days, daily snapshots 30 days, weekly snapshots 12 weeks.
- Pre-release backups 30 days.
- Weekly restore test; monthly full recovery drill.
- Logical recovery RPO target 15 minutes/RTO 2 hours; provider-wide disaster RPO 6 hours/RTO target 8 hours only after alternate-host drill.
- Encrypt backups, restrict access, enable object versioning/retention, monitor age and failures; app runtime must not delete backups.
- Retain enough database quota for a PITR/rehearsal copy. Restore clones are sensitive Production data; never expose them as public Staging.

## Release runbook (operator execution only)

1. CI and immutable artifact hashes/commit must pass. Configure the protected production-validation CI environment and reviewed allowlists. PR jobs receive no Production secrets. The release-check job builds artifacts and validates only; it never deploys.
2. Freeze the release SHA, schema manifest, allowlist and Web/mobile inventory. Public environment values are build-time values: rebuild if they change. A metadata file/hash is not a signature; protect artifact storage/promotion permissions and require CI provenance before deployment.
3. Stop AI and all writes using a verified maintenance mechanism. Drain in-flight work. Existing Phase 2A GET paths can provision profiles/daily plans, so simply blocking POST is insufficient. This Phase 1 does not implement the maintenance/AI switch: until Privacy/AI hardening provides it, stop application traffic and jobs at the platform. Verify runtime credentials/old deployments cannot keep writing.
4. Create pre-migration backup, record restore point and manifest, verify independent storage receipt.
5. Restore into an isolated clone; verify integrity, ownership, rowid, operation replay, undo and session resume. Apply account-deletion tombstones so deleted accounts are never republished.
6. Rehearse exact migrations on the clone, including time limits and compatibility with rollback application version.
7. Acquire the release concurrency guard and DB lease; explicitly apply Production migrations using restricted migration credentials.
8. Run read-only schema/ownership validation and compare expected counts. Any failure stops release.
9. Deploy the frozen application. Do not automatically promote a main push ahead of this sequence; configure Vercel/Git protections operationally.
10. Smoke test real auth, unauthenticated 401, A/B isolation, load/save/review/undo with a real controlled test account (no bypass), session persistence, metadata and secret hygiene. AI test awaits the separate AI consent/cost controls.
11. Resume writes, then AI only when Privacy/AI controls are ready. Observe errors/latency before broadening access.
12. Keep logs sanitized and alert on migration/backup failure, DB errors and stale backups. Monitoring service setup is separate.

Rollback: pre-commit failure rolls back that migration. Post-commit prefer forward fix or a backward-compatible old app. Never blindly run destructive down migrations. Whole-DB PITR loses later good writes; only use after impact assessment and write freeze. Restore to a new DB, issue a scoped token, validate, update allowlist/runtime config, deploy and retire the old DB later. Turso outage must not silently switch to a writable local SQLite.

When AI ledgers are introduced by a later branch, DB restore must keep AI off, reconcile provider spend, and rotate recovery epoch before replay is allowed. This Phase 1 does not claim to implement that AI state machine.

## Integration and remaining blockers

Likely merge overlaps with Privacy: lib/auth-server.ts (only shared 503 infrastructure mapping here), package.json/lockfile, db/client.ts and shared test setup. No app/page, auth-provider, app/api/ai, lib/openai, business schema or account lifecycle edits.
Retention must regenerate schema-manifest after adding migrations. Coordinate migration numbering at integration; don't rewrite applied SQL or change review rowids.

Still manual/unverified: actual Production/Staging endpoints and credentials, provider permission scopes, hosted FK/transaction semantics, remote migration duration, actual encrypted backup/restore, PITR plan, external storage scheduling, operational maintenance, protected promotion/provenance, secret rotation, monitoring alerts and real production smoke tests. AI budget/rate limit and Privacy/Consent remain independent release blockers. Passing check:release alone does not make the entire product Production-ready.

## Local verification record

Node 22: typecheck, lint (0 errors; 41 pre-existing warnings), all 104 unit tests, production-mode Web compilation with development deployment identity, mobile development compilation, auth browser regression and onboarding browser regression passed. The production artifact validator's positive/negative paths are exercised with isolated synthetic artifacts, not live credentials. Actual Production check:release remains blocked by intentionally unconfigured allowlists/credentials. No hosted DB, OpenAI or Clerk request was needed for these infrastructure tests.
