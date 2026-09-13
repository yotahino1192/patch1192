# My Lesson UI Foundation

Independent React feature, not connected to Home, Continue Learning or existing Study. No DB/API/auth/Retention changes. My Lesson is the learning session itself, not a selection screen. Visual styles inherit Patch tokens; layout is provisional pending UI Designer assets.

## Integration

Mount `LessonExperience` with a stable `LessonAdapter`, `sessionKey`, `onHome`, optional `variant` (`normal | firstLesson`) and `onBudgetChange`. Home/Composer chooses the lesson; adapter maps Domain data into `LessonViewModel`. Change `sessionKey` whenever account scope, selected lesson, or adapter changes. This remount aborts pending calls, clears answers/help and ignores stale results. The host must unmount on logout/deletion/consent transitions as appropriate; this mock-only feature does not implement auth or bypass consent.

Adapter methods receive AbortSignal and operationId. Evaluate retries preserve operationId for the same answer; no automatic retry is performed. Real adapters must implement server idempotency and unknown-state semantics before mutation/AI integration. `retainLearning` is idempotent by operationId and accepts a LearningObjective candidate; it must never report adding a card. Help errors preserve the Activity answer, and closing the native modal returns focus to the trigger. Help conversation is session-local, clears on close, and is not persisted.

Five renderers only, one shell/header/footer. Shared states live in state.ts; renderer inputs are controlled. Completion is based on exhausting the supplied activity array, never a five-card checkpoint. Streak and next timing are display-only adapter values. Completed concepts are supplied by Domain, not invented from a local scoring rule. Empty lessons show a normal empty state with Home, not an earned completion.

Time starts when the loaded, nonempty lesson is displayed. A monotonic clock includes AI Help and foreground/background elapsed time; completion freezes actual duration. `onBudgetChange` exposes elapsed/remaining/current estimate and completed/total progress. Reaching zero does not delete activities, dispatch AI, or force completion. Composer budgeting/resume persistence are future integration responsibilities. targetMinutes must be 5–15; short content may finish sooner.

## Preview and tests (Node 22)

- `node scripts/preview-my-lesson.mjs` — loopback-only development harness, no production route. Mock feedback and retained candidates are not persisted.
- `node --test tests/my-lesson.test.mjs`
- `node scripts/check-my-lesson-browser.mjs`

The fixture is outside Next/mobile entry graphs. Do not expose the harness in production. No real AI API is called.

## Designer handoff

Provide final Shell, five Activity content layouts, Help sheet, normal/first Lesson Complete, and loading/empty/error/disabled/selected/feedback states at mobile and web widths. Apply the visual treatment to the scoped CSS/renderers while retaining the state contract, one primary CTA, modal focus behavior and unchanged navigation.
