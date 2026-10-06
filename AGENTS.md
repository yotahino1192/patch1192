# Mepamo repository instructions

- Public product name: **Mepamo**. Internal names are not a rename request.
- Current implementation and tests are the technical source of truth for actual behavior. The [v3.0 unified requirements](docs/mepamo-unified-requirements-v3.0.md) are the longer-lived Product / Domain / Release requirements source of truth; [CURRENT_STATE](docs/CURRENT_STATE.md) records frequently changing operational facts.
- Inspect existing implementation, tests and relevant documentation before changing architecture. Prefer the smallest correct change. Report conflicts between intended requirements and implemented behavior; do not silently choose a new contract.
- Never expose or commit secrets, credentials, personal data, confidential user content or real Production records. Keep private operational destinations out of repository documents and reports. Use placeholders; explicitly approved anonymized fixtures/test data are allowed after checking that they contain none of the protected data above.
- Production mutations require explicit human approval for the action and target. A runbook, role assignment or past deployment is not standing authorization.
- Preserve `com.patch.learning`, `com.patch.learning.widget` and `group.com.patch.learning.retention`; renaming requires explicit approval.
- Check branch, SHA, dirty files and other worktrees before editing. Do not duplicate work or concurrently edit the same feature/files across agents. Preserve others' changes; use a separate branch/worktree for independent work. An existing clean dedicated worktree may be reused when ownership and scope are clear.
- Run relevant tests/checks before completion. Report files changed, tests and results, risks, and remaining work; state anything not verified. Do not claim a release gate passed without evidence.
- Read [CURRENT_STATE](docs/CURRENT_STATE.md) for changing operational context and [DEVELOPMENT_WORKFLOW](docs/DEVELOPMENT_WORKFLOW.md) for roles, risk handling and session startup. Historical chat/checkpoint notes do not override inspected repository state or authorize Production changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
