# App Store metadata draft — not approved for publication

Current scope and integration status: [Free v1 release scope](free-v1-release-scope.md). Its full deferred list applies to QA, screenshots, metadata and blockers. Short topic input remains an unresolved CLI3 contract at Dev `d9e304f`; older baseline/test observations below are historical, not proof of that feature or current production readiness.

Scope: current Dev cb2a0f2 plus release preparation; see release-dev-compatibility.md. Add Material / Review / Ready UI is still changing elsewhere. Verify all wording against the final integrated build. **Yota final product/legal decisions** are marked below; no production URLs, mail addresses or credentials have been invented.

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

Initial Free v1 / TestFlight scope: Topic/Text/PDF input, **Flashcards and Multiple Choice only** as study formats, History/Review and Streak/Retention. Verify these claims on the integrated candidate before publication. Fill in the Blank is future work, excluded from launch copy, reviewer requirements and screenshots; it is **not a TestFlight or App Store blocker**. No implementation or preparation for it is included in this release task.

**Opening:** Patchは、教材を学習カードにまとめ、学習と復習を続けるためのアプリです。

**Implemented learning workflow:** 教材の文章を使ってカードを作成し、内容を確認して保存。保存したカードで学習し、途中からの再開や日々の復習に取り組めます。

**AI features:** AIによるカード生成を利用できます。AIへデータを送信する前に内容と送信先を確認して許可でき、設定から停止できます。AIの生成内容には誤りが含まれることがあるため、元の教材と照らし合わせてください。学習中のAI Tutorや自動AI振り返りは初期Free v1の提供機能として記載しません。

**Optional final paragraph, only after signed-device QA:** 学習状況を確認するWidgetと、端末内の学習リマインダーを利用できます。

**Requirements/support:** メールアドレスによるアカウント登録・確認が必要です。AI生成・同期などには通信が必要です。お問い合わせとデータの取り扱いはサポート・プライバシーページをご確認ください。

Yota approves final copy and languages. Avoid promises of OCR, camera/photo capture, microphone, web/YouTube import, social sharing, universal offline use, push notifications, Apple login, unlimited AI, subscriptions or unimplemented input formats. File-type claims and screenshots wait for final Add Material implementation and QA.

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
- Authentication: “Patch uses email verification codes. Open the dedicated review inbox at `<PRIVATE_WEBMAIL_URL>` using the credentials supplied privately, then enter `<REVIEW_EMAIL>` in Patch Sign In and enter the latest code. There is no fixed app password or verification code.” Add precise final screen labels after UI freeze.
- Sample path: sign in → open supplied sample material → study with Flashcards or Multiple Choice, complete a Study Set → return to learning progress. For creation: Add Material → enter supplied non-sensitive sample text → read/allow AI disclosure if desired → generate → review → save. Verify final names and available actions.
- AI: “Optional features send entered/extracted text and relevant learning/chat context/settings to OpenAI only after explicit permission. Declining still allows saved/sample study. Permission can be withdrawn in Settings.” Describe only AI features verified in the Free v1 candidate and explain that earlier transmissions may not be retractable; advanced Lesson features are not required for review. No guaranteed correctness claims.
- Account deletion: Settings → account deletion → email reauthentication → final confirmation. Use `<DISPOSABLE_REVIEW_EMAIL / PRIVATE_INBOX_INSTRUCTIONS>`. Explain asynchronous completion and where status is shown; give the **actual published completion target** after worker QA. Deleting the primary review account may remove its sample content.
- Notifications/Widget: local reminders requested from settings; add Small/Medium Patch Widget manually. No Push/APNs. Include only after device QA.
- Known review-relevant constraints: network required for sync/AI, quota messages, available languages, final supported formats. No unreleased feature promises.

## Screenshots

Use [store asset inventory](store-asset-inventory.md). Capture final candidate Home/progress, Add Material, generated Review/save, Flashcards, Multiple Choice and completion; optional Widget after device validation. Need clean rights-cleared data, no inbox/OTP/account identifiers, and matching iPhone/iPad layouts. Do not generate final screenshots while another session is implementing these screens.
