# Free v1 release scope and integration boundary

Current integration baseline: `origin/Dev` **8ab9f4847c67c27e322c70366c834f40b2e6ce51**, including [Free v1 reliability fixes](free-v1-reliability.md); see [integration validation](testflight-readiness-integration.md). Topic and Free v1 learning/UI are integrated and frozen. Current external gates: [master runbook](testflight-go-live-runbook.md).

Historical pre-CLI3 integration baseline: Dev `d9e304f980711f7c9859b156b89efce4d36cd063`. It already contains CLI2 operations through `6105780` (via `b51ba1e`) and the CLI1 Home/Add Material/Free v1 UI merges. CLI2 was fast-forwarded to this exact Dev tree; no UI, learning, session, grading, retention, domain or DB changes are introduced by this documentation update.

## Required initial scope

- Input: short topic, pasted text, currently supported files: `.pdf`, `.docx`, `.pptx`, `.txt`, `.md`, `.csv` (`lib/document-import.ts`; 10 MB per file, parser/extraction limits still apply).
- Study formats: **Flashcards and Multiple Choice (MCQ) only**.
- Complete / History / Review and existing Retention / Streak behavior.

The final CLI3 integration adds explicit short-topic input (1–200 characters), authoritative processed-item Study Sessions, MCQ grading/results and short-session qualification. Pasted source and uploaded material retain the 80–30,000-character source contract and parser/size limits. See [final integration review](free-v1-integration-review.md) for validation and migration/recovery evidence. Earlier CLI1/CLI2 references to the source-only topic gap describe the pre-CLI3 baseline; production readiness remains subject to the gates below.

## Deferred — not initial-release requirements

**Fill in the Blank is future work.** It is not a TestFlight blocker, App Store blocker, required QA format, required screenshot or release metadata claim. Do not implement or prepare it in this task.

Also deferred: **Advanced Lesson Composer; LEARN / EXPLAIN / APPLY; Advanced AI Tutor; Deep Session; Pro; Creator / Business; video upload; YouTube ingestion; sharing**. These are not initial-release blockers, required QA, screenshots or metadata claims. Retained legacy engine tests verify compatibility only; they do not expose or promise these features in Free v1. Existing data and compatibility behavior must remain intact.

## Remaining release decisions

Production provider configuration, worker scheduling/monitoring, recovery operations, legal values, Apple signing and physical-device gates remain unchanged. The CLI3 learning-core implementation and its verification are documented in the final integration review. Its completion does not satisfy the external release gates or authorize production operations.

All final copy, reviewer instructions, physical-device QA and screenshots must use the exact integrated candidate and only its verified in-scope behavior. No live provider, production DB, deployment or Apple account operation is authorized by this document.
