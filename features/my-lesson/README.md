# My Lesson / Patch U2

The existing React shell and five renderers now use real Domain and contextual AI Help in production. Full implementation status and remaining boundaries: [Lesson Shell implementation plan](../../docs/lesson-shell-implementation-plan.md).

## Integration

Mount `DomainLesson` with an existing, assigned `lessonId` and `onHome` under the existing Account/Privacy/Language providers. The app also accepts `/?lesson=<id>` after authentication/onboarding through `LessonEntry`; this is a selected Lesson entry, not a new Home/Continue selection policy. The legacy study flow is preserved. No demo lesson is created.

`DomainLesson` supplies the authenticated Domain client, real Help adapter and account-scoped checkpoint to `LessonExperience`. Account/lesson/adapter changes remount the experience and invalidate old work. Five fixed renderers share one header, progress, feedback region and primary Continue action. Visuals remain provisional.

## Existing Domain authority

The adapter reads existing Lesson/Activity/Attempt APIs. CREATED starts explicitly; ACTIVE resumes from the latest non-undone Attempt for each assignment. LEARN records COMPLETED; RECALL self-reports recall; CHOICE compares the selected answer; EXPLAIN/APPLY collect text and explicit self-assessment against a reference. Incorrect results remain unfinished and require explicit practice. No AI grading or mastery formula is introduced.

After all assignments succeed, `completeLesson` and an authoritative reload must confirm COMPLETED before showing results. Storage/transport errors never imply completion. ObjectiveState is read-only; Retention, Streak, Due and legacy reviews are not mutated. The existing Domain DB constraints still exclude these Lessons from Streak qualification.

## Retry, interruption and time

The existing deterministic operation ID now includes the latest historical Attempt even when undone, allowing a fresh answer after Undo. Each pending RecordAttempt payload is frozen and persisted before dispatch. Reload reconciles it with server evidence; uncertain retries cannot silently become a different answer. Unsent drafts/reveal/assessment restore only when content/Attempt revision matches.

`patch:lesson:<userId>` stores one current Lesson checkpoint per account. Existing cleanup hooks remove it on logout/deletion. Its draft and foreground elapsed time are convenience state, never completion evidence. Foreground time includes Help and feedback; background/explicit pause is excluded. At the budget limit the learner can pause and resume; no activities are silently removed and no completion is forced. Per-Attempt duration remains unmeasured (0). Device time is not synchronized across devices.

## AI Help

Real calls use `useApiFetch → PrivacyProvider → AccountScope → sendAi → /api/ai/chat → runAi('chat')`. The existing endpoint accepts a discriminated Lesson context. Server-owned Activity/membership/Source context is validated at admission and finalization; material is untrusted provider input. Existing consent, idempotency, cancellation, limits and unknown-state rules apply.

Short follow-ups use up to three prior successful receipts from the existing 24-hour AI result cache, filtered by account/consent generation and Lesson/Activity. There is no new chat table, permanent conversation product, or learner-state mutation. The visible sheet conversation is ephemeral. Closing/backgrounding aborts and fences late UI results, including transports that ignore abort. Production does not offer the preview-only retainLearning action.

## Validation / preview

Use Node 22. Mock data remains exclusively in the test/development harness:

- `node scripts/preview-my-lesson.mjs`
- `node --test tests/my-lesson.test.mjs tests/domain-lesson.test.mjs tests/lesson-checkpoint.test.mjs tests/ai-lesson.test.mjs`
- `node scripts/check-my-lesson-browser.mjs`
- `node scripts/check-domain-lesson-browser.mjs` after building Next
- `npm run check` and `npm run mobile:build:local`

Browser fixtures use isolated accounts/DB and a test-only Help provider stub; backend tests independently exercise the real AI route with mocked upstream responses. No real AI key or production DB is required.
