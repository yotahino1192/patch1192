# UI phase 1 verification

Baseline: Dev `50ef687`, 224 tests. Designer inputs preserved at `66aeaee`. Implementation is isolated on `codex/ui-phase1` in `~/Documents/Yota-ui-phase1`.

## Results

- Node 22.23.2: full suite **229/229 PASS** (224 retained, five presentation/domain-mapping checks added).
- Typecheck PASS. Lint: **0 errors, 39 existing warnings** (baseline 41); no unrelated warning cleanup.
- Guarded production Web compilation, environment/schema/secret checks and artifact seal: PASS. Local development configuration only.
- Mobile development bundle + artifact seal + Capacitor sync: PASS.
- Unsigned generic iOS Simulator App build, including embedded PatchWidget: PASS. Existing cached Swift packages; no signing/Team/Apple configuration changes.
- Swift Retention/Widget policy executable: PASS.
- Browser regressions: auth, privacy/deletion/AI consent, onboarding/Study/Retention/deep links, reliability, public pages: PASS. Health/readiness HTTP: PASS.
- UI browser: actual Home/Shell/Study components, all seven states, 393×852 captures; 320×568, 430×852, 768×852 reflow; English/Japanese and long name: PASS. Native dialog opening/closing/Escape/Start, saved-session GET-only duration, and rejection of a late previous-session estimate: PASS.
- Actual API browser coverage: preview title follows the Continue resolver (due review can outrank new material), opening/closing does not create a session, Start enters the existing Study UI and creates the session through its existing handler.

Browser runs use isolated identities/databases and test-only SDK/native boundaries. Visual fixtures are only under `tests/fixtures`; production entrypoints do not import them. Initial harness issues from shared dependency paths and asynchronous navigation were corrected before passing runs. No production DB, deployment, migration, secrets, main branch or Developer settings were modified.

## Visual review

Reviewed `outputs/ui-phase1/{empty,normal,hot,broken,completed,complete,stale}-393.png`, `preview-393.png`, `resume-preview-393.png`, `preview-ja-long-320.png` against the supplied images. Captures/measurements are reproducible via `npm run test:ui-browser` and remain ignored development output.

Corrected CSS precedence, completion/early-state whitespace, button sizing, narrow Japanese label wrapping, mascot crop edge, vector navigation scale/colors, and iPhone safe-area spacing. Preserved current four navigation destinations and Settings access.

Remaining intentional differences: recently studied sets instead of unsupported sequential chapters/locks/milestones; Today’s Due/ToDo and real paused-session access remain available; two supported result metrics instead of three invented concept metrics; existing Undo, next-review and AI recap may extend completion below the initial viewport. New sessions have no duration until planning; saved sessions use the read-only Domain estimate. Original standing art has a sticker border; reference-extracted reading/celebration art retains some paper texture. See `ASSET_REQUESTS.md` for transparent master specifications.
