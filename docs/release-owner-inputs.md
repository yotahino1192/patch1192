# Release values / Yota input checklist

Current integration baseline: fetched `origin/Dev` **8ab9f4847c67c27e322c70366c834f40b2e6ce51** (2026-09-21), including Free v1 reliability fixes. See [integration validation](testflight-readiness-integration.md). Topic input and Free v1 learning/UI are integrated. See the [master go-live runbook](testflight-go-live-runbook.md) and [Free v1 scope](free-v1-release-scope.md); deferred features are not release blockers.

No invented identities, addresses, regions, retention promises or business claims. `lib/public-pages/config.ts` remains draft with all 19 fields null. Classification is preparation, not legal advice or publication approval.

| Class | Values / facts | Next action |
| --- | --- | --- |
| A — implementation evidence available | Clerk identity/email auth; Turso application DB; Vercel hosting configuration; OpenAI AI inputs under explicit consent; `store:false` is not a retention guarantee; asynchronous deletion with minimal tombstones/accounting; local notifications and Widget snapshot; encrypted backup and isolated verification | Codex can align factual disclosure with the final integrated code. No claim that any production account/provider region is already configured |
| B — Yota supplies | `operatorName`, `contactEmail`, `legalAddress`; actual owned API/web/support/privacy URLs, credential ownership, operational responder, brand assets and rights-cleared review material | Supply verified identity/contact/domain records and operational owners through appropriate private channels; secrets only via secret manager |
| B — Yota/legal approval | `serviceCountries`, `processingRegions`, `effectiveDate`, `retentionPolicy`, `backupRetention`, `deletionTiming`, `rightsProcedure`, `supportResponse`, `eligibility`, `contentRights`, `commercialTerms`, `liability`, `governingLaw`, `disputeResolution`, `serviceChanges`, `revisionNotice` | Yota/legal decide each; confirm actual provider contracts/settings for processing regions and retention. Technical facts alone cannot determine these promises |
| C — external Production services | Production DNS/hosting, live Clerk/Turso/AI credentials, authenticated worker scheduler, log/alert destination and delivery test, encrypted offsite backups/key recovery and restore rehearsal | Complete the [configuration contract](production-configuration-contract.md) and operational evidence references; never enter secrets into Git |
| D — Apple/App Store later | Membership/entity/Team ID/App ID Prefix; final bundle/Widget/App Group IDs; signing/profiles; Connect record/SKU; age-rating answers/privacy labels/export compliance; availability/pricing/copyright; reviewer credentials/screenshots/beta feedback | Supply/verify after enrollment with the final shipped scope and data inventory. No Apple account operation performed here |
| E — physical devices | Signed iPhone/iPad, minimum and current supported iOS, independent reviewer mailbox access | Execute pre-archive QA and repeat against the exact TestFlight build using [device QA](physical-device-release-qa.md) |

## Concise owner checklist

- [ ] Formal operator identity/address and a monitored support mailbox; owned support/privacy URLs.
- [ ] Countries, eligible ages, data-processing locations from actual contracts/settings; legal reviewer and publication date.
- [ ] Retention per data type, backup retention/deletion replay rules, deletion completion wording; do not promise instant provider/offline-device erasure.
- [ ] Rights-request verification/process, support hours/response target and incident escalation owner.
- [ ] Content rights, Free v1 commercial terms, liability, governing law/disputes, service-change and policy-notice rules.
- [ ] Separate production/staging Clerk and Turso ownership, domains/allowlists, mail delivery, model approval and secret custody; scheduler and monitoring provider/receiver.
- [ ] Backup frequency/offsite storage/key custodians/RPO/RTO and a recovery drill date.
- [ ] Initial email-only login versus separately scoped Apple support; no Apple-linked deletion completion claim while revocation is absent.
- [ ] Final icons/splash/screenshots and approved store text; final bundle/team/group IDs after enrollment.
- [ ] Physical-device tester/hardware and reviewer mailbox/login procedure for the exact candidate.

Free v1 acceptance scope: Topic/Text/currently supported files → Flashcards / Multiple Choice; History/Review; Streak/Retention. Fill in the Blank is future work: no implementation or preparation in this release task, and **not a TestFlight or App Store blocker**. Advanced Lesson, Pro, Creator and Video remain outside the initial release scope. Topic and Free v1 integration are complete on this baseline; UI/learning changes are outside this readiness pass.
