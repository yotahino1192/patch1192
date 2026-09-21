# App Store metadata draft — not approved for publication

Current baseline: fetched `origin/Dev` **7e5335b240ffec3512cae717904333f496188de4** (2026-09-21). Topic input and Free v1 learning/UI are integrated. See the [master go-live runbook](testflight-go-live-runbook.md) and [Free v1 scope](free-v1-release-scope.md); deferred features are not release blockers.

Scope: integrated/frozen Free v1 at `7e5335b`. Verify all wording against the exact signed candidate. **Yota final product/legal decisions** are marked below; no production URLs, mail addresses or credentials have been invented.

| Field | Draft / action |
| --- | --- |
| App name | **Patch** — Yota confirms name availability/trademark and final localized naming |
| Subtitle | Recommendation: **教材をカードに、毎日の学習へ** — Yota approves; recheck store length limits/localizations |
| Primary category | Recommendation: **Education / 教育**; optional secondary Productivity only if warranted; Yota chooses. Do not select Kids category without separate age/privacy review |
| Keywords | Draft: `学習,復習,暗記,教材,カード,ノート,勉強,AI` — Yota prioritizes and checks final field limits |
| Support URL | `<YOTA_FINAL_HTTPS_PUBLIC_ORIGIN>/support` — must work without login |
| Privacy Policy URL | `<YOTA_FINAL_HTTPS_PUBLIC_ORIGIN>/privacy` — must be published, complete and match app |
| Terms URL | `<YOTA_FINAL_HTTPS_PUBLIC_ORIGIN>/terms` — complete before release |
| Promotional text | `<YOTA_APPROVED_LAUNCH_MESSAGE>`; no unverified performance, learning-outcome, free/unlimited or offline claims |
| Copyright / provider | `<YOTA_LEGAL_OWNER_AND_YEAR>` |
| Price, availability, age rating | Yota decides based on actual product/eligibility and Connect questionnaire; no subscription/purchase claim is drafted |

## Description structure and proposed text

Initial Free v1 / TestFlight scope: Topic/Text/currently supported file input, **Flashcards and Multiple Choice only** as study formats, History/Review and Streak/Retention. Verify these claims on the integrated candidate before publication. Fill in the Blank is future work, excluded from launch copy, reviewer requirements and screenshots; it is **not a TestFlight or App Store blocker**. No implementation or preparation for it is included in this release task.

**Opening:** Patchは、教材を学習カードにまとめ、学習と復習を続けるためのアプリです。

**Implemented learning workflow:** 教材の文章を使ってカードを作成し、内容を確認して保存。保存したカードで学習し、途中からの再開や日々の復習に取り組めます。

**AI features:** AIによるカード生成を利用できます。AIへデータを送信する前に内容と送信先を確認して許可でき、設定から停止できます。AIの生成内容には誤りが含まれることがあるため、元の教材と照らし合わせてください。学習中のAI Tutorや自動AI振り返りは初期Free v1の提供機能として記載しません。

**Optional final paragraph, only after signed-device QA:** 学習状況を確認するWidgetと、端末内の学習リマインダーを利用できます。

**Requirements/support:** メールアドレスによるアカウント登録・確認が必要です。AI生成・同期などには通信が必要です。お問い合わせとデータの取り扱いはサポート・プライバシーページをご確認ください。

Yota approves final copy and languages. Avoid promises of OCR, camera/photo capture, microphone, web/YouTube import, social sharing, universal offline use, push notifications, Apple login, unlimited AI, subscriptions or unimplemented input formats. Implemented formats are PDF, DOCX, PPTX, TXT, Markdown and CSV (10 MB/file); extraction is not OCR and formatting is not preserved. Yota approves final file-type claims after device QA.

## Reviewer access plan — ordinary email OTP only

Current `PatchAuthPlugin.swift` and app auth UI support email signup/signin and real emailed codes, not password login. An email address alone is insufficient for a reviewer. No master OTP, auth bypass, hidden reviewer entry, test mode or fixed universal code is permitted.

Recommended preparation (**YOTA MANUAL ACTION**, not performed):

1. Create a dedicated review-only mailbox with no personal or operational email, using a provider that permits practical webmail access by the reviewer. Give it unique credentials; never provide Clerk/Apple/admin mailbox access. Use a second disposable mailbox/account for deletion testing, or allow the reviewer to create their own ordinary account.
2. Through normal app sign-up, create the review account in the **production** Clerk instance and add small rights-cleared sample study materials. Do not seed DB privileges or grant exceptions. Keep AI consent unset if demonstrating first-use consent; pre-saved cards permit learning before consent.
3. Put mailbox URL, review email, private webmail access instructions and credentials only in App Store Connect's private Review Information/Notes. Explain that the app uses email OTP and has no app password; the supplied webmail password belongs to the dedicated mailbox. Do not put credentials in Git, screenshots or public support pages.
4. Rehearse from a fresh browser and signed device outside the developer's sessions/network: access review inbox independently, request code in app, use the **new** code, sign in and use all features. Inbox access must not require Yota's phone, device approval or synchronous code relay. If the chosen provider prevents this, resolve reviewer access with App Review **before submission**; do not rely on developer-assisted OTP forwarding.
5. Leave backend/email/AI quotas usable through review, monitor support, restore review sample data when needed, and rotate dedicated mailbox credentials after review. Do not promise deletion works unless R03 has been rehearsed.

Reviewer-controlled email sign-up is an additional ordinary path, but relying on the reviewer to invent an account is not a substitute for prepared usable access. Apple decides whether the supplied review resources are sufficient; see [App Review access guidance](https://developer.apple.com/app-store/review/guidelines/).

## Private Review Notes template

- Contact: `<YOTA_NAME / WORKING_EMAIL / PHONE>`.
- Candidate: `<VERSION (BUILD), COMMIT, SUPPORTED_DEVICES>`; main experience is Japanese / `<FINAL_LANGUAGES>`.
- Authentication: “Patch uses email verification codes. Open the dedicated review inbox at `<PRIVATE_WEBMAIL_URL>` using the credentials supplied privately, then enter `<REVIEW_EMAIL>` in Patch Sign In and enter the latest code. There is no fixed app password or verification code.” Use the screen labels from the exact signed candidate.
- Sample path: sign in → open supplied sample material → study with Flashcards or Multiple Choice, complete a Study Set → return to learning progress. For creation: Add Material → enter supplied non-sensitive sample text → read/allow AI disclosure if desired → generate → review → save. Verify final names and available actions.
- AI: “Optional features send entered/extracted text and relevant learning/chat context/settings to OpenAI only after explicit permission. Declining still allows saved/sample study. Permission can be withdrawn in Settings.” Describe only AI features verified in the Free v1 candidate and explain that earlier transmissions may not be retractable; advanced Lesson features are not required for review. No guaranteed correctness claims.
- Account deletion: Settings → account deletion → email reauthentication → final confirmation. Use `<DISPOSABLE_REVIEW_EMAIL / PRIVATE_INBOX_INSTRUCTIONS>`. Explain asynchronous completion and where status is shown; give the **actual published completion target** after worker QA. Deleting the primary review account may remove its sample content.
- Notifications/Widget: local reminders requested from settings; add Small/Medium Patch Widget manually. No Push/APNs. Include only after device QA.
- Known review-relevant constraints: network required for sync/AI, quota messages, available languages, final supported formats. No unreleased feature promises.

## Screenshots

Use [store asset inventory](store-asset-inventory.md). Capture final candidate Home/progress, Add Material, generated Review/save, Flashcards, Multiple Choice and completion; optional Widget after device validation. Need clean rights-cleared data, no inbox/OTP/account identifiers, and matching iPhone/iPad layouts. UI integration is complete; capture from the exact signed candidate after QA and approval of sample content.

## Privacy questionnaire input inventory — Yota must confirm each answer

This inventory supplies code evidence, not final Apple categories, purposes, linkage or retention answers. **YOTA INPUT REQUIRED** for every final questionnaire answer, including third-party settings. No tracking SDK was found; confirm actual provider configuration before answering tracking questions.

| Data / behavior | Source and recipient | Yota / operator confirmation |
| --- | --- | --- |
| Email, identity/session IDs | Native Clerk email OTP; server resolves internal account in Turso | Account purpose/linkage, provider regions, retention, reviewer contact |
| Topic/text/extracted file content; saved cards and answers | `lib/document-import.ts`, app/API/store, Turso; OpenAI receives approved generation input under consent | User Content categories, purposes/linkage, storage/deletion periods; don't claim file contents stay only on device |
| Study answers, review/session history, Streak | Application DB and owner-scoped local state | Product interaction categories and retention; do not describe deferred Tutor as a launch feature |
| AI usage/operation metadata | AI ledger, structured failure/usage logs, OpenAI provider | Diagnostics/usage categories, provider retention; `store:false` does not mean no provider retention |
| Deletion receipts/tombstones, consent evidence | Lifecycle tables and encrypted backups | Minimal retained data, deletion/backup replay deadlines and legal basis |
| Notification permission, reminder ledger, Widget snapshot | On-device UserNotifications, standard UserDefaults and App Group file | Local use; no APNs implementation; verify any transfer before questionnaire submission |
| Service/transport logs | Hosting, Clerk, Turso, OpenAI and chosen monitoring service | Actual IP/device/diagnostic collection, access and retention; disable body/header/query/session capture |

Own `PrivacyInfo.xcprivacy` declares UserDefaults reason CA92.1; absence of collection entries is not a “Data Not Collected” answer. Generate the final device archive Privacy Report and reconcile linked SDKs with the above inventory. See [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## TestFlight information draft

- Beta app name: **Patch — YOTA CONFIRM**. Beta description: reuse the approved Free v1 description above.
- Feedback email, support/privacy URLs, contact name/phone, locales: **YOTA INPUT REQUIRED**.
- What to Test: “Topic/Text/supported file → Flashcards/Multiple Choice → History/Review; Streak, Widget and local reminders; login/session, consent and deletion.” Use disposable content/accounts and report build/device/OS plus reproduction steps, without content/credentials.
- Internal testers use their own normal email OTP accounts. Review mailbox instructions above are for external beta/App Review when requested, not a prerequisite to creating an internal tester group.
- Store screenshots/subtitle/marketing assets are store-submission work; missing final store screenshots alone is **not** an Internal TestFlight gate. Production safety, signing, privacy/support readiness and core device QA remain gates.
