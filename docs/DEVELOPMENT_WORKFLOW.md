# Mepamo development workflow

Read [AGENTS.md](../AGENTS.md) and [CURRENT_STATE.md](CURRENT_STATE.md) first. This document defines the working method; the [v3.0 unified requirements](mepamo-unified-requirements-v3.0.md) define longer-lived Product / Domain / Release requirements, while current implementation/tests establish actual technical behavior and CURRENT_STATE records frequently changing operational facts. Resolve conflicts explicitly rather than treating historical notes as current facts.

## Default CLI roles

These are default task-routing roles, **not permanent ownership** or permission to spawn agents or mutate Production. Assign a concrete scope for each task; roles may change with explicit coordination.

| Role | Default scope |
| --- | --- |
| CLI1 — UI / Visual / Client | UI implementation, visual fidelity, responsive behavior, i18n, assets, client presentation, visual QA |
| CLI2 — Production / Release / Infrastructure | Vercel, Turso, Clerk, OpenAI Production, Cloudflare Worker, monitoring, backups, TestFlight/release, Production safety |
| CLI3 — Learning Core / AI / Domain | Lesson/activity, learning logic, material/file handling, AI generation, idempotency, AI state/recovery, domain/API integration |

A cross-boundary task needs an agreed integration contract and one integration owner. API/domain behavior is not changed independently in multiple worktrees.

## Risk and approval

- **Low risk:** scoped, reversible implementation can go directly to Codex with relevant validation.
- **Medium risk:** Codex can implement in an isolated branch, then present the result for review before integration/release.
- **High risk:** Production, DB, Auth, AI controls, migrations, release, security and cross-agent architecture work should be planned/reviewed through ChatGPT before execution. State the target, intended mutations, evidence, rollback and boundaries. Read-only investigation may prepare that review; it is not approval to mutate.
- Production mutations always require explicit operator approval for the proposed action/target. Existing approval within the current task remains valid within its scope; do not repeatedly ask for the same approval. Stop on material scope changes or unexpected state.
- Never infer approval to deploy, migrate, enable AI, change secrets/signing or publish a build from approval to edit repository files. Never weaken a guard to finish a task.

## Task execution and coordination

1. Inspect branch, commit, working tree, worktree inventory, existing implementation and relevant tests/docs. Preserve unrelated and operator-local changes.
2. Agree the goal, affected files/contracts, base SHA and validation. Check whether another session is already working on the same feature/files; if ownership is unclear, clarify before overlapping edits.
3. Independent work requires a separate branch/worktree. An existing clean dedicated worktree may be safely reused when its ownership and scope are clear; a brand-new worktree is not required for every task. Do not reset/clean/rebase someone else's workspace, duplicate an in-progress implementation or silently combine unrelated commits. Keep application and Worker-only releases distinct when the current release strategy requires it.
4. Prefer **inspect → implement → test → fix → report** within one bounded task. Choose minimal changes; avoid architecture rewrites without demonstrated need.
5. Run relevant existing tests and required checks. Match validation to risk; a documentation-only change normally needs content, link, whitespace and scope checks, not application builds or Production credentials. Clearly identify mock/local versus live evidence.
6. Before any approved integration, inspect the latest target branch and remote changes; integrate safely, never overwrite remote work. Check deployment triggers before pushing release-linked branches. Commit, push and deploy only within the task's authorization.
7. Report exact files changed, tests/results, risks, remaining work and any commit/branch outcome. Update CURRENT_STATE when operational facts change, with date/source and verification limits; do not fabricate evidence or update old historical reports to look current.

No duplicate work should be assigned merely because another CLI is available. A handoff should give the branch/worktree, base/current SHA, scope, changed files, validation and remaining work, without secrets, credentials, personal data, confidential user content, real Production records or private operational destinations. Explicitly approved anonymized fixtures/test data may be included after confirming that none of those protected data remain.

## Concise Codex task prompt

Provide the goal, constraints, source of truth, validation and required completion report. Specify implementation details only where they are a real contract or constraint; let inspection determine the smallest correct solution.

```text
Goal: [observable outcome]
Scope/constraints: [allowed changes, prohibited actions, approval boundary]
Source of truth: [docs/mepamo-unified-requirements-v3.0.md section, repository paths, approved base SHA]
Validation: [relevant tests/checks and acceptance criteria]
Completion report: files changed; tests/results; risks; remaining work;
                   branch/SHA and commit/push status if relevant.
```

Manual instructions for Yota must identify the exact **app → page → menu → button** path, prerequisites, expected result and stopping point. Verify current UI labels when giving actionable instructions; do not guess. Never ask for secrets in chat; use an approved non-echoing local/provider mechanism when a separately authorized task requires them.

## New Session Boot Procedure

1. Read repository-root **AGENTS.md**, including applicable directory-specific instructions.
2. Read **docs/CURRENT_STATE.md**; note its date, source labels and unverified items.
3. Read the relevant section of the [canonical v3.0 unified requirements](mepamo-unified-requirements-v3.0.md). Do not reconstruct its scope from older chat; distinguish its dated operational snapshot from current evidence.
4. Inspect the current repository before editing:

   ```sh
   pwd
   git status --short --branch
   git branch --show-current
   git rev-parse HEAD
   git rev-parse --verify Dev
   git worktree list
   ```

   A remote-tracking ref may be stale. Fetch when current remote state is required by the task; do not claim GitHub equality from a cached ref alone.
5. State the current task scope, base SHA/worktree, allowed changes and validation plan. Identify conflicts or overlapping work before editing.
6. Do not assume old chat history is authoritative over inspected repository state. For live services, distinguish owner-confirmed status from fresh read-only verification; repository defaults alone do not prove runtime state. Report discrepancies and retain all existing approval/release gates.
