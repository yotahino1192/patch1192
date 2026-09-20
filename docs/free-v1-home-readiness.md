# Free v1 Home visual readiness

Baseline inspected: shared Dev `716d298`, Home `88f2b49`. Dev merged without conflicts. The reviewed approved Home/Splash follow-up history through `d382da8` was then incorporated; Add Material already contained that same history. No active branch history was rewritten.

Start and Continue now remain inside Today's Lesson, including the completed-today state. The Peach button has a 44px minimum target and 14px text. Existing selection, session resume, due counts, Streak snapshots, real recent-set history and all four navigation destinations are preserved. No curriculum, scoring or core rules were introduced.

Startup uses the approved transparent waving mascot on Evergreen. Existing startup lifetime tests verify bootstrap/session restore only, no minimum delay, no return during navigation/account changes, and existing startup recovery. No new auth or startup lifecycle changes were needed.

Validation: 253 unit/API tests passed; typecheck; lint (13 existing warnings, zero errors); Web build/seal; local mobile build/seal. The first sandboxed Web build could not fetch Google Fonts; the unchanged build passed with network access. Home browser states, real destination callbacks, 320/393/430/768 widths, 150% text, containment of Start/Continue, and startup/auth regressions passed. Screenshots under `outputs/ui-phase1` and `outputs/startup`; no physical-device QA.

During final verification local Dev advanced to `b51ba1e` while origin/Dev remained `716d298`. The newer Dev was reviewed and merged without conflicts as `f9759ee`. Full validation was rerun: **258 tests passed**, typecheck, lint (13 existing warnings, zero errors), Web/mobile builds and artifact seals. Onboarding's older Home-label/external-CTA waits were updated to the actual Home/Complete screens and Today-contained action; real onboarding, Day 1, reload/resume, Retention deep links and logout regressions passed. No product auth or learning-core change was needed.

This is a Home/Splash component checkpoint, not a complete Free v1 product gate. Free v1 study-format exposure, Add Material and missing learning-core contracts are covered by the Add Material branch's Free v1 checkpoint. Recommended merge order: Home first, Add Material next after review; do not publish TestFlight until CLI3 resolves the documented product contracts. No merge into Dev or push performed.
