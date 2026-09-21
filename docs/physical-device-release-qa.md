# Physical-device release QA

Current baseline: fetched `origin/Dev` **7e5335b240ffec3512cae717904333f496188de4** (2026-09-21). Topic input and Free v1 learning/UI are integrated. See the [master go-live runbook](testflight-go-live-runbook.md) and [Free v1 scope](free-v1-release-scope.md); deferred features are not release blockers.

Free v1 gate: Topic/Text/currently supported files, Flashcards/Multiple Choice, History/Review, Streak/Retention. Fill in the Blank is future work, with no required implementation, preparation or QA for this release, and is not a TestFlight or App Store blocker. Advanced Lesson / Pro / Creator / Video remain outside the initial release scope. Run the matrix first on a signed Release device install before archive, then repeat critical flows and install/update/reinstall checks on the exact uploaded TestFlight build; keep separate results. Close the app after requesting deletion and verify scheduler-driven completion independently; never treat the request receipt as completed deletion.

**All items NOT RUN.** No physical device was used in this preparation. A compiled Simulator app does not count as a pass. Use a signed Release device build for pre-archive QA and Internal TestFlight for distribution QA, real production email OTP, two disposable accounts A/B and non-sensitive rights-cleared sample text/file. Keep deletion testing separate from the primary review account.

Record tester/date, build/version/commit, device model, OS, locale, timezone, network, install type (fresh/update/reinstall), result and issue/evidence link. Run on iPhone and iPad while both are supported; include minimum iOS 17 and current supported iOS where hardware is available, small/large screens and advertised orientations. Never attach OTPs, tokens or personal learning content to evidence.

| Check | Acceptance | Result |
| --- | --- | --- |
| Install / launch / update | TestFlight installs and updates cleanly; first and subsequent launch reach working app, no blank view or crash; no wrong environment | NOT RUN |
| Startup splash | Final Patch branding appears correctly; no Capacitor placeholder, clipping, unexpected flash or stalled splash; portrait/landscape and light/dark | NOT RUN |
| Email signup/login | Ordinary sign-up/sign-in, actual inbox delivery, wrong/expired code, resend and network interruption recover safely | NOT RUN |
| Session persistence | Background/foreground, force quit, device reboot and token refresh preserve only valid current session; revoked/expired session prompts login | NOT RUN |
| Logout / A→B switch | A's drafts/results/history/queued writes, notifications and Widget snapshot never leak into B; delayed A response cannot repopulate B | NOT RUN |
| Add Material | Topic, Text and PDF/DOCX/PPTX/TXT/Markdown/CSV inputs: keyboard/file selection, extraction limits, long content, cancel/resume and invalid/encrypted files behave correctly; no unsupported permission prompt | NOT RUN |
| Generation | Unset/declined consent prevents dispatch; allow then generate works; double tap, quota, timeout and uncertain result do not silently duplicate AI work | NOT RUN |
| Review / save | Generated content can be checked and saved in intended destination; retry/duplicate tap produces one durable result; reload finds saved material | NOT RUN |
| Free v1 study | Flashcards and Multiple Choice start with correct material; resume/new session, answer/feedback and accessibility match integrated behavior | NOT RUN |
| History / Review | Completion saves once; saved history/review survives reload; retry/resume/Undo match current domain rules; no duplicate completion | NOT RUN |
| Streak | Formal Study Set completion yields expected day state; same-day repeats, Undo, day boundary and timezone change match existing rules; no test-only changes | NOT RUN |
| Continue Learning | Correct unfinished activity resumes after background/kill; deleted/stale material falls back safely | NOT RUN |
| Local Notifications | No prompt on first launch alone; allow/deny/settings toggle work; schedule then close app and lock device; tap opens intended route; same-day update does not duplicate; completion/logout/delete cancel; test OS permission revocation | NOT RUN |
| Widget | Add Small/Medium; confirm signed App Group available, live count/Streak, completed/stale/expired/signed-out states; cold device restart and lock/unlock recovery; tap resumes; A→B never shows A | NOT RUN |
| Deep Link | Cold/warm `patch://continue` and `patch://review/today`, logged in/out and after account switch; unknown route rejected; stale notification owner does not enter another account's content | NOT RUN |
| Offline / recovery | Airplane mode at launch/save/AI/completion; clear recoverable states; reconnect explicitly without lost confirmed data or cross-account writes. Do not claim full offline support | NOT RUN |
| AI consent | Fresh unset → decline → saved/sample study; grant → AI; revoke → new dispatch blocked; in-flight response fencing; app restart, second device and account switch; disclosure names actual data/recipient | NOT RUN |
| Account deletion | Challenge + fresh email verification + explicit final confirmation; immediate access block, local notification/Widget/draft cleanup, worker completion, Clerk removal, DB deletion and intentional minimal retained records; provider outage retries; repeated request/status safe | NOT RUN |
| Other device after deletion | Online session denied immediately on next authorized request; offline/closed device clears on reconnection as publicly described; no resurrection by queued writes | NOT RUN |
| Reinstall | Uninstall → TestFlight reinstall: inspect Clerk installation-marker/Keychain behavior, old account data isolation, Widget reset and notification state; compare documented expectations. Do not assume uninstall erases all Keychain values | NOT RUN |
| Legal/support/reviewer | Public URLs open without auth, contact works; AI/deletion wording matches; fresh reviewer mailbox/login rehearsal needs no developer intervention | NOT RUN |

Submission gate: all applicable rows passed on the **exact uploaded candidate**, no unresolved critical auth/data/privacy/learning defects, all exceptions explicitly owned. Optional browser/Simulator reproductions assist investigation but do not change NOT RUN device results.

## Evidence matrix (separate pre-archive and TestFlight records)

| Device coverage | Signed Release / pre-archive | Exact Internal TestFlight build |
| --- | --- | --- |
| iPhone / smallest available supported screen / minimum iOS 17 | NOT RUN | NOT RUN |
| iPhone / large screen / current supported iOS | NOT RUN | NOT RUN |
| iPad / supported orientations / minimum and current supported iPadOS | NOT RUN | NOT RUN |

Add device model/OS/build/tester/date and issue/evidence references to each cell. If minimum-OS hardware is unavailable, retain that explicit gap; Simulator coverage cannot silently replace it. Before archive prioritize real OTP/Keychain, App Group/Widget, notifications/deep links, consent/deletion and core Free v1 flow. After upload include TestFlight install/update/reinstall and first-tester full workflow. No device result is inferred from a successful build.
