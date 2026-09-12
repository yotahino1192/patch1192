// Shared, immutable disclosure. Changing its data scope requires a new consent version.
export const CONSENT_VERSION = "ai-learning-1";
export const POLICY_VERSION = "privacy-draft-1";
export const CONSENT_SCOPE = "ai_learning";
export const AI_DISCLOSURE = {
  ja: "Patchはカード作成・質問への回答・学習終了時の会話要約のため、入力文章と添付資料から抽出した文章、カードの質問・答え・カテゴリ、元資料、AIへの質問と関連する会話、生成形式・説明の詳しさ・表示言語などの設定をOpenAIへ送信します。個人情報や機密情報が含まれないか確認してください。許可しなくても保存済み教材・カードやサンプルで学習できます。設定からいつでも停止できます。停止前に開始した送信は取り消せない場合があります。",
  en: "Patch sends entered and extracted document text, card questions, answers and categories, source text, your questions related conversations and settings such as output format, explanation depth and language to OpenAI to create cards, answer questions and summarize conversations at the end of a lesson. Check for personal or confidential information. You can study saved cards and samples without permission. You can stop sharing in Settings. Requests started before stopping may not be retractable.",
} as const;
export type ConsentState = "unset" | "granted" | "denied" | "revoked";
export type Consent = { state: ConsentState; revision: number; consentVersion: string; policyVersion: string; textHash: string; language: "ja" | "en" };
