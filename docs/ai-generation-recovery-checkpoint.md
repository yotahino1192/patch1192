# AI generation recovery checkpoint

Scope: conservative recovery of the local Add Material generation incident and better classification/diagnostics. No schema/migration, new API endpoint, consent policy, budget policy, domain, Retention or Streak changes. No production data access. No live provider calls during recovery validation.

## Incident verification

The local ledger contained two AI requests total: an earlier successful cards request and one incident cards request in `unknown`. The incident had one 3,600 `cost_micros` reservation and one dispatch-stage transition. Its usage/result/provider ID were not retained. The available server log contained the initial 503 followed by two pre-admission 429 responses; there were no additional request/operation records or cost reservations for those retries. Total ledger cost was 4,004 (404 previous success + 3,600 incident maximum hold).

The two logged 429 attempts did not use the original request key: the existing-key lookup precedes concurrency admission and would have returned a replay/conflict response instead. Their exact keys, and whether they reused the same new key with each other, cannot be reconstructed because rejected attempts were not logged with identity. Only these two retries are evidenced by the available server log; additional UI clicks cannot be equated to additional HTTP calls. No provider ID exists in the retained evidence for any retry. OpenAI receipt/charge of the original call and its precise failure cause remain unknown.

## Local recovery and invariants

Stopped the local preview worker, backed up the DB, and used the new development-only `resolve-local-unknown` operator command for the exact request and owner after lease expiry. This explicitly acknowledges an unknown provider outcome instead of falsely asserting provider-final confirmation. The affected row changed only from `unknown` to `failed_final`. A full before/after table comparison verified that no other fields or rows changed. The maximum cost and idempotency tombstones remain; active occupancy fell from one to zero. No duplicate rows/reservations required removal. A protected local audit records IDs, timestamps and the resolution diagnostic separately from this repository.

Admission was verified on an exact post-recovery DB copy through `runAi` with a mocked provider worker. It accepted an explicit new operation; no request was sent to OpenAI and the user's recovered ledger was not polluted by a test reservation.

## Permanent behavior

- `unknown` keeps the existing no-redispatch guarantee and maximum hold. Different-key admission blocked by the user's unknown request returns `AI_PREVIOUS_UNRESOLVED`.
- Metadata-only structured diagnostics correlate admitted/replayed/denied attempts, dispatch, completion/failure and operator resolution. Capture protected stdout logs for retention; no diagnostic DB migration was introduced.
- Network/timeout, provider HTTP failure, response parsing, completed material validation, and local persistence failures are classified separately. A completed but unusable material response is terminal, rather than unnecessarily consuming concurrency forever.
- Add Material distinguishes consent, unresolved/in-progress, provider/network, usage limits, and generic failures. The consent dialog's rejection now carries the consent code without changing consent behavior.
- Retry preserves uncertain identity. Resolving the old operation does not auto-generate: the old key is terminal, and only a subsequent explicit action may use a new key.

Unknown still requires administrator reconciliation and may block indefinitely without it. Production requires the existing provider-final review. Automated provider reconciliation, durable diagnostic storage, and a self-service recovery flow are deferred; see [production hardening](production-hardening.md).

## Validation

267 unit/API tests; typecheck; lint (zero errors, 13 existing warnings); Web build/artifact seal; local mobile build/artifact seal. Browser coverage: Add Material retry identity and classified errors (including explicit recovery), Review/Ready/save, Privacy consent and account isolation, and the existing Patch core integration flow. Mobile widths 320/390/430/768 tested; unresolved error screenshot inspected at 390px. Existing mobile bundle-size and Privacy fixture font allowlist warnings remain. Real provider generation/charging was deliberately not used as a test oracle.
