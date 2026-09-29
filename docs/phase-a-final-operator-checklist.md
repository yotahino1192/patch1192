# Phase A — single final operator checklist

Preparation checkpoint based on Dev `27589ae5fdeb2897e6c07e4ca6ba2f2f99fffd6e`.
Use the **approved SHA of the resulting checkpoint**, not this historical parent SHA.
This is the single A–D checklist; [phase boundaries and unchanged gates](controlled-production-validation.md) still apply.
No secret entry, Production build/DB call, backup, restore, external provisioning or deployment is requested during preparation.

## A. Completed preparation; no expiry-bearing evidence

- Deletion adapter: `workers/deletion-scheduler/index.mjs`; imported reviewed API allowlist, production-only, disabled unless explicitly enabled, no DB bindings/credentials, no public HTTP execution. Inert `wrangler.jsonc.example` has no cron and disables workers.dev/preview URLs. It must not be deployed during preparation.
- Mock coverage: disabled/invalid config, one POST/Bearer, separate hosting header, idle/completed/retry, HTTP/redirect/network/JSON/oversized-body errors, 55s request **and body** timeout, 5s heartbeat timeout, missing/rate-limited heartbeat acknowledgement, redaction and scheduled failure propagation. No live provider is contacted.
- Reviewed [non-live monitoring plan](../config/production-monitoring.plan.json) and setup/recurring-operation procedure below. Plans are not installed resources or delivery evidence. `config/production-operations.json` remains truthful with its five empty references.
- Preserve `legalAddress=null`, `effectiveDate=null`, draft/noindex and deletion-completion target pending live evidence. AI remains off. Full Phase B gates are unchanged.
- Normal CI, schema, secret scan and local fixture rehearsals are preparation evidence, **not** exact-SHA Production `check:release`, current DB validity or a fresh Production backup.
- Verify Vercel Git remains disconnected before any push. Record local/origin/GitHub SHA equality and zero deployments after push. Do not reconnect.

### Monitoring preparation (installation waits for approved A2)

UptimeRobot Free: two Keyword monitors from the plan, each every 5 minutes; alert on missing expected keyword and non-200/unavailable response. Match the literal compact JSON keyword. A Vercel login page or redirect must fail. Use the owner's private, verified email receiver; never publish that address. Test actual failure **and recovery** delivery later. Do not intentionally break Production to manufacture a failure: use an approved isolated failing monitor or temporary wrong expected keyword and restore it.

Healthchecks Free: three planned checks (within the published 20-check free allowance). Scheduler: simple period 60s + grace 240s = missing success threshold 5min; ops: 300s + 600s = 15min; usable offsite backup: 12h + 12h = 24h. Keep checks paused/uncreated until their runner exists. Test `/fail`, stopped-runner alert and subsequent recovery with private email receipt. Never use the deletion credential for monitoring. Treat each full Healthchecks ping URL as a secret capability; store it only in the corresponding runner's secret store, never Git/logs/screenshots. No auto-provisioning query parameters.

The Worker sends one empty POST ping after its bounded API attempt: ordinary ping for **idle or completed**, `/fail` for retry/error/timeout. It accepts only HTTP 200 with body `OK` as acknowledgement; `OK (not found)` and `OK (rate limited)` fail. There are no automatic HTTP retries. A failed heartbeat also fails the scheduled invocation; missed-run monitoring covers crashes/config errors before a ping. Cloudflare's invocation records and the closed-vocabulary `deletion_scheduler` event provide the second diagnostic source; do not enable full request/header/subrequest logging or raw traces containing ping URLs.

**A green heartbeat means the scheduler's latest invocation worked, not that the deletion queue is empty.** A retry can be followed by idle while the server waits for its backoff/120s lease. Preserve failure/retry history in restricted incident evidence; do not auto-close a deletion incident on an idle ping, or on a completion of some other job. The independent 5-minute `ops:status` and controlled account receipt establish backlog/completion. No in-isolate memory is treated as durable state. If an unattended incident workflow cannot retain/acknowledge failures independently of the heartbeat's recovery email, do not declare deletion monitoring operational.

### Hosting protection and scheduler activation

Only canonical `https://mepamo.com` is accepted by this adapter. A1's unique URL is for owner read-only probes; no deletion scheduler is enabled in A1. A2 needs separate promotion/test approval and owner protection on **all** Production domains. Do not weaken protection to accommodate monitors.

The adapter supports `x-vercel-protection-bypass` with a **separate**, independently injected `VERCEL_AUTOMATION_BYPASS_SECRET`; the template requires it. Bearer authentication remains `ACCOUNT_DELETION_WORKER_SECRET`. Neither is passed in a URL or to Healthchecks. This capability is repository preparation, not approval to generate a hosting bypass token now. Before A2, authorize the hosting-access credential and verify the selected monitor can store/send its header securely on the actual Free plan. If that is unavailable, stop that setup and choose/review an alternative; do not place the key in a URL, open the endpoint, or assume Free supports it. Unprotected mode is explicit and forbidden during owner-only A.

Future A2 operator: review bundle and config, create the Worker **disabled with empty cron**, add only the three secret bindings named in the example, verify private delivery/target/protection, then separately authorize `SCHEDULER_ENABLED=true` and `* * * * *` UTC. One bounded API call per tick; server backoff/lease is untouched. Observe CPU/invocation limits on Free; reaching a limit is a failure, not permission to upgrade or relax the timeout. Propagation of cron changes can take up to 15 minutes; after disable, verify no further invocations before assuming it has stopped.

### Recurring operations and recovery preparation

- **Runner remains unprovisioned.** `ops:status`/encrypted backups require an access-controlled Node 22 runner with approved source, secrets injection, storage and outbound monitoring. Do not run remote DB operations in GitHub Actions: `CI_REMOTE_DATABASE_FORBIDDEN` remains enforced. The deletion Worker never receives Turso or backup credentials. A Mac-only job cannot promise operation while asleep/offline; no such promise is made. Choose/approve the recurring host and iCloud transfer mechanism before Phase B; no new paid service is authorized here.
- `ops:status`: every 5min via the disabled cron template; post success only for exit 0 **and** reviewed aggregate thresholds. Alert on unknown/expired AI, Apple-blocked deletion, oldest pending >1h, nonzero exit or missing success >15min. Keep retry/pending counts in restricted history until reconciled; do not dump user rows. Also compare latest verified backup's snapshot age on each run, so a delayed copy/ping cannot extend the 24h limit.
- Backup at 00:00 and 12:00 UTC (09:00 and 21:00 JST): no overlap, guarded `db:backup`, original key ID `mepamo-production-v1`, local `db:restore-check`, ciphertext+manifest offsite copy, byte/hash comparison and actual iCloud sync/retrieval confirmation. Publish a backup-success heartbeat **only after all stages succeed**, referenced to `backupTimestamp`, not upload time. At age >24h, alert even if a runner is alive. Missing success is independently detected by Healthchecks. Slow/failed runs must not silently refresh the success timestamp.
- Initial beta destination remains private iCloud Drive **Mepamo Production Backups**. A completed local copy is not proof of cloud sync or off-device durability; retain restricted proof that both files were available from iCloud/off-device. Recurring auto-sync/offsite transfer has not been installed or verified. Use restrictive file/directory access (0600/0700) on an encrypted disk. Do not store plaintext exports or the key in that folder.
- Seven-day retention: inventory only dedicated completed backup folders by authenticated manifest timestamp; exclude unrelated/in-progress files. After a newer snapshot has passed restore, offsite verification and deletion/consent reconciliation, remove expired ciphertext+manifest pairs from both local and offsite locations and verify removal, including recoverable copies under the chosen storage policy. Never remove the last usable copy merely to satisfy a timer; if preservation conflicts with retention, block release and resolve explicitly. This is an operator procedure, not installed automatic expiry, and public documents must retain their condition-based wording.
- Key retrieval: owner retrieves **Mepamo Production Backup Key v1** from macOS Passwords into the protected process only; match manifest `keyId=mepamo-production-v1`, never replace/rotate the key during validation. Verify ciphertext retrieval and original-key recovery. Restore-check uses temporary local plaintext and removes it in `finally`; interruptions require checking restricted scratch leftovers. No restore into the live DB.
- Recovery retains the [existing reconciliation plan](production-recovery-rehearsal.md): apply newer deletion/tombstone/consent and AI records before any recovered system receives traffic. Missing reconciliation evidence blocks cutover. RPO24h/RTO48h are targets, not measured SLA evidence. Initial restore success is not recurring operation or achieved RTO.

## B. One time-sensitive block — only immediately before approved A1

Run this once in a protected owner-controlled terminal on an encrypted machine, with Node 22, installed locked dependencies, exact approved SHA and a clean worktree. Do **not** do it now. First finish non-secret preconditions: owner attended window/stop plan, project/scope/domain/protection review, upload exclusions, disconnected Git, and deployment budget/time to stay within backup age. If these are unresolved, do not start the freshness clock.

Inject actual Production config and the four existing server secrets from their original custody **once** into this protected process (no chat, argv, shell tracing/history or env download). Inject the original backup key and key ID from separate custody in the same operator session. Sensitive Vercel values cannot be read back; `vercel env run` alone is insufficient. Never downgrade them. Use in-memory secret injection; values stay out of logs/Git. If custody/injection is unavailable, STOP before any command.

Set non-secret `APPROVED_SHA` to the reviewed final Dev SHA; `DB_ID=mepamo-production`; `BACKUP_DIR` and `OFFSITE_DIR` to new, separate restricted directories outside the repo (the latter in the approved private iCloud location). `NODE_ENV=production`, `PATCH_ENV=production`, `AI_ENABLED=false`; exact canonical non-secret configuration must match Vercel. For **local offline validation**, map the verified web hostname `mepamo.com` to `VERCEL_PROJECT_PRODUCTION_URL`, as the existing CI `WEB_HOST` mapping does. Do not pretend this verifies actual provider-injected system variables at deployment. Mobile mappings: `PATCH_API_URL=PATCH_API_ORIGIN`, `PATCH_CLERK_PUBLISHABLE_KEY=NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `PATCH_CLERK_ISSUER=CLERK_ISSUER` (copy variable **values**, not these literal names). Keep credentials out of mobile config files.

Execute with fail-fast shell behavior and each exit checked:

```sh
set -eu
set +x
umask 077
test "$(git rev-parse HEAD)" = "$APPROVED_SHA"
test -z "$(git status --porcelain)"
test -z "${CI:-}"
test "$NODE_ENV" = production
test "$PATCH_ENV" = production
test "$AI_ENABLED" = false
test "$DB_ID" = mepamo-production
test "$PATCH_BACKUP_KEY_ID" = mepamo-production-v1
node -e 'if(process.versions.node.split(".")[0]!=="22") process.exit(1)'
date -u '+PHASE_A_START %Y-%m-%dT%H:%M:%SZ'
npm run check:env
npm run check:schema
npm run scan:secrets
npm run build
npm run mobile:build
npm run check:release
npm run db:validate -- --allow-remote --confirm-db "$DB_ID"
npm run ops:status -- --allow-remote --confirm-db "$DB_ID"
# Aggregate-only first-deployment baseline; never migrates or changes live rows.
node --input-type=module - --allow-remote --confirm-db "$DB_ID" <<'BASELINE'
import { command, target } from './scripts/infra/cli.mjs';
await command(async () => {
  const {client} = target();
  try {
    const integrity = await client.execute('PRAGMA integrity_check');
    if (integrity.rows.length !== 1 || integrity.rows[0].integrity_check !== 'ok') throw Error('INTEGRITY_INVALID');
    if ((await client.execute('PRAGMA foreign_key_check')).rows.length) throw Error('FOREIGN_KEY_INVALID');
    const lock = await client.execute('SELECT id,owner,lease_until FROM _patch_migration_lock');
    if (lock.rows.length !== 1 || Number(lock.rows[0].id) !== 1 || lock.rows[0].owner !== null || Number(lock.rows[0].lease_until) !== 0) throw Error('MIGRATION_LOCK_NOT_RELEASED');
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const business = tables.rows.filter(({name}) => !String(name).startsWith('sqlite_') &&
      !['_patch_migrations','_patch_migration_lock','_patch_migration_runs'].includes(name));
    if (business.length !== 26 || !business.some(({name}) => name === 'ai_control')) throw Error('PRODUCTION_TABLE_INVENTORY_INVALID');
    const control = (await client.execute('SELECT id,enabled FROM ai_control')).rows;
    if (control.length !== 1 || Number(control[0].id) !== 1 || Number(control[0].enabled) !== 1) throw Error('AI_CONTROL_INITIAL_STATE_INVALID');
    for (const {name} of business) {
      if (name === 'ai_control') continue; // The exact migration-created singleton was checked above.
      const quoted = '"' + String(name).replaceAll('"', '""') + '"';
      if (Number((await client.execute('SELECT count(*) n FROM ' + quoted)).rows[0].n) !== 0) throw Error('UNEXPECTED_PRODUCTION_DATA');
    }
    console.log('PRODUCTION_BASELINE_INITIALIZED_VALIDATED');
  } finally {client.close();}
});
BASELINE
npm run db:backup -- --allow-remote --confirm-db "$DB_ID" --out "$BACKUP_DIR"
npm run db:restore-check -- --backup "$BACKUP_DIR"
# Copy ciphertext+manifest into the NEW dedicated OFFSITE_DIR; never copy the key.
mkdir -m 700 "$OFFSITE_DIR"
cp -n "$BACKUP_DIR/snapshot.enc" "$BACKUP_DIR/manifest.json" "$OFFSITE_DIR/"
cmp "$BACKUP_DIR/snapshot.enc" "$OFFSITE_DIR/snapshot.enc"
cmp "$BACKUP_DIR/manifest.json" "$OFFSITE_DIR/manifest.json"
npm run db:restore-check -- --backup "$OFFSITE_DIR"
# Pause for actual cloud sync/off-device retrieval; local cmp alone is insufficient.
printf "Type verified only after off-device retrieval is confirmed: "
read -r OFFSITE_CONFIRMED
test "$OFFSITE_CONFIRMED" = verified
# Run immediately before approval.
node --input-type=module - "$BACKUP_DIR" "$APPROVED_SHA" <<'AGE'
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const m = JSON.parse(await readFile(join(process.argv[2], 'manifest.json'), 'utf8'));
const schema = JSON.parse(await readFile('config/schema-manifest.json', 'utf8'));
const age = Date.now() - Date.parse(m.backupTimestamp);
if (m.dbIdentifier !== 'mepamo-production' || m.keyId !== 'mepamo-production-v1' ||
    m.releaseSha !== process.argv[3] || m.migrationCount !== schema.migrations.length ||
    m.schemaChecksum !== schema.schemaChecksum || !Number.isFinite(age) || age < 0 || age > 86400000) {
  throw Error('BACKUP_EVIDENCE_INVALID_OR_STALE');
}
console.log('BACKUP_AGE_VALID', JSON.stringify({ageHours: age / 3600000,
  expiresAt: new Date(Date.parse(m.backupTimestamp) + 86400000).toISOString()}));
AGE
date -u '+PHASE_A_CHECKS_END %Y-%m-%dT%H:%M:%SZ' 
```

Before acceptance, verify guarded read-only baseline: 13 applied migrations, integrity/FK valid, migration lock owner null/lease released, 26 business tables: exactly one `ai_control(id=1, enabled=1)` row and zero rows in the other 25 tables; `ops:status` alone does not prove all of these. The aggregate-only block above checks the post-migration first-deployment baseline; never rerun migration or the pre-migration empty-DB preflight on the migrated DB. Record counts privately without user/content output. Verify manifest DB identity, schema, exact SHA, key ID, timestamp and ciphertext hash. Both Production artifact inventories/SHA are checked by unchanged `check:release`; no synthetic artifacts or stale Development build may substitute.

The singleton is created by `drizzle/0009_talented_shockwave.sql` and remains required after migrations 0000–0012. It is **not** an AI request or user record. `AI_ENABLED=false` still blocks AI dispatch independently of the database control value; never update/delete the singleton to make this baseline pass. Missing/changed control, unexpected data, integrity/FK failure or an unreleased lock must stop validation. Only the three named migration bookkeeping tables (whose history/lock rows are expected) and SQLite internals are excluded; there is no blanket `_patch_*` exemption. The preceding `db:validate` remains mandatory for exact schema, migration checksums and table identities.

Checklist consistency review: `ops:status` counts AI requests/deletion jobs, so its zero counts are compatible with this singleton. Backup/restore must preserve the singleton, not discard it. Initial migration history may retain its original release SHA; do not remigrate it to the candidate SHA. The **new backup** and freshly built web/mobile artifacts must use the approved candidate SHA, as already checked below/above. `tests/infra-phase-a-checklist.test.mjs` executes the actual documented BASELINE and AGE blocks against local fixtures, including the freshly migrated database and encrypted backup/offsite-copy restore; no Production credentials or remote DB are used.

**Pause within the same operator session** for actual iCloud sync/off-device retrieval confirmation; `cmp` only proves local bytes. Verify `now - backupTimestamp <= 24h`, timestamp not future, enough remaining age for the attended A1 window, successful restore and offsite retrieval. Preserve sanitized timestamps/results; no raw manifests, keys or private data in chat/Git. If the window expires, do not waive freshness: repeat only the now-stale checks when rescheduled. “Once” avoids premature work, not the existing fail-closed expiry guard.

Run `check:operations` separately and record its real nonzero result: only `monitoring.providerRef`, `monitoring.destinationRef`, `monitoring.deliveryEvidenceRef`, `deletion.schedulerRef`, `deletion.completionEvidenceRef` may remain blank for attended A1 under the phase procedure. Any additional issue blocks entry. Do not hide this failure with `|| true` or call Phase B ready. Never run `ios:sync`, migration, deletion worker or AI-control as part of B above.

## C. Exact A1 approval and first staged command

After B succeeds and evidence is accepted, request explicit approval naming exact SHA, project `mepamo1192`, workspace `mepamo` (CLI scope `campus-ring-3f45e625`), protected unaliased A1 only and attended window. Recheck Git disconnected/zero deployments and ensure the clean checkout is linked to the **existing** project with only ignored non-secret project metadata. Review CLI upload set: no env, backups, outputs/private evidence, fixture credentials or unrelated untracked files.

Only after that approval, from the exact clean candidate:

```sh
vercel deploy --prod --skip-domain --scope campus-ring-3f45e625
```

No deployment now; no bare `vercel`, `--public`, reconnect, domain alias, automatic promotion or new project. Keep real canonical app origins; check actual provider `VERCEL_ENV=production` and `VERCEL_PROJECT_PRODUCTION_URL=mepamo.com`. A fallback hostname must fail closed, not be spoofed/allowlisted. Never use a Preview deployment with Production credentials. This step is not A2 promotion authorization.

## D. Work requiring the live backend

1. A1: verify exact deployed SHA and Production target, successful build, **no assigned canonical/stable domain**, AI off. Anonymous unique-URL access must be challenged by hosting protection; owner-hosting-authenticated requests without Clerk session must return health 200/ok, ready 200/ready, data **application** 401. Check no-store/request IDs/sanitized errors without logging credentials. Compare read-only DB baseline; no unexpected writes. Stop for review, retain protection and no users.
2. Before A2: separate approval for All Deployments protection, canonical promotion and disposable test account. Create/configure approved monitoring and Worker resources only with that authorization. Provision/verify private email receipt and secure automation hosting access first. No paid upgrade or weakened protection by assumption. Keep raw capability URLs private.
3. A2: canonical auth/isolation, UptimeRobot failure/recovery email, scheduler every-minute invocation, idle/retry/error/timeout/missed-run/failure delivery, app-closed deletion and eventual completion. Complete separate queue status evidence and actual deletion target; an HTTP 200/retry or later idle does not pass. Resolve the five real operations references only when the corresponding setup/evidence exists.
4. Before any Internal/External TestFlight: recurring status/backup/expiry/offsite/key-recovery proof; final legalAddress/effectiveDate/publication decision; full `check:operations` and release-candidate gates, physical-device/signing/App Store Connect requirements. Keep AI disabled until separately approved live validation. A is not ongoing general service and cannot outlive its attended/backup window.

## Provider references reviewed during preparation

- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [scheduled handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/), [Free limits](https://developers.cloudflare.com/workers/platform/limits/).
- [Healthchecks ping/acknowledgement semantics](https://healthchecks.io/docs/http_api/), [pricing](https://healthchecks.io/#pricing).
- [UptimeRobot keyword monitors](https://uptimerobot.com/keyword-monitoring/), [plan limits](https://uptimerobot.com/pricing/).
- [Vercel automation protection header](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), [staged deployment](https://vercel.com/docs/cli/deploy#skip-domain).
