# Free v1 release scope and integration boundary

Current integration baseline: Dev `d9e304f980711f7c9859b156b89efce4d36cd063`. It already contains CLI2 operations through `6105780` (via `b51ba1e`) and the CLI1 Home/Add Material/Free v1 UI merges. CLI2 was fast-forwarded to this exact Dev tree; no UI, learning, session, grading, retention, domain or DB changes are introduced by this documentation update.

## Required initial scope

- Input: short topic, pasted text, PDF / currently supported files.
- Study formats: **Flashcards and Multiple Choice (MCQ) only**.
- Complete / History / Review and existing Retention / Streak behavior.

This is the intended release scope, not a claim that every input contract is implemented. At this baseline, short topic input is still a **CLI3 product/server contract gap**: the current source-only generation endpoint requires at least 80 source characters. Do not advertise short-topic support as shipped, pad input or bypass validation. Pasted text and supported files remain subject to actual parser/size limits. See [CLI1 checkpoint and CLI3 gaps](free-v1-ui-readiness.md#cli3-contracts--release-gaps); no gap is implemented or worked around in this release-integration task.

## Deferred — not initial-release requirements

**Fill in the Blank is future work.** It is not a TestFlight blocker, App Store blocker, required QA format, required screenshot or release metadata claim. Do not implement or prepare it in this task.

Also deferred: **Advanced Lesson Composer; LEARN / EXPLAIN / APPLY; Advanced AI Tutor; Deep Session; Pro; Creator / Business; video upload; YouTube ingestion; sharing**. These are not initial-release blockers, required QA, screenshots or metadata claims. Retained legacy engine tests verify compatibility only; they do not expose or promise these features in Free v1. Existing data and compatibility behavior must remain intact.

## Remaining release decisions

Production provider configuration, worker scheduling/monitoring, recovery operations, legal values, Apple signing and physical-device gates remain unchanged. CLI3 must resolve the documented short-topic and learning-core contracts separately. Preserve current Study Session logic, Flashcard behavior, MCQ grading and Retention/Streak semantics until that separately reviewed work is integrated; do not change them to satisfy release paperwork.

All final copy, reviewer instructions, physical-device QA and screenshots must use the exact integrated candidate and only its verified in-scope behavior. No live provider, production DB, deployment or Apple account operation is authorized by this document.
