// Public, non-secret publication settings. Null is rendered explicitly, never as a fake contact.
export const legalFieldLabels = {
  operatorName: '運営者の正式名称',
  contactEmail: '正式な問い合わせメール',
  legalAddress: '法的住所',
  serviceCountries: '配信対象国・地域',
  processingRegions: '外部サービスでの処理地域・越境移転に関する説明',
  effectiveDate: '正式版の施行日',
  retentionPolicy: 'データ種別ごとの最終的な保持期間',
  backupRetention: 'バックアップの保持期間・削除反映期限',
  deletionTiming: 'アカウント削除の完了目安・記録の保持方針',
  rightsProcedure: 'データに関する問い合わせ・権利行使の受付手順',
  supportResponse: 'サポート受付時間・回答目安',
  eligibility: '利用対象・年齢条件',
  contentRights: '教材・生成結果の権利と利用許諾条件',
  commercialTerms: '料金・支払い・解約・返金に関する条件',
  liability: '保証・責任・免責に関する条件',
  governingLaw: '準拠法',
  disputeResolution: '紛争解決・管轄',
  serviceChanges: 'サービス変更・中断・終了時の条件',
  revisionNotice: '規約・ポリシー変更の告知方法',
} as const;
export type LegalField = keyof typeof legalFieldLabels;
export type PublicLegalConfig = {
  publicationStatus: 'draft' | 'published';
  fields: Record<LegalField, string | null>;
};
export const publicLegalConfig: PublicLegalConfig = {
  publicationStatus: 'draft',
  fields: {
    operatorName: null, contactEmail: null, legalAddress: null,
    serviceCountries: null, processingRegions: null, effectiveDate: null,
    retentionPolicy: null, backupRetention: null, deletionTiming: null,
    rightsProcedure: null, supportResponse: null, eligibility: null,
    contentRights: null, commercialTerms: null, liability: null,
    governingLaw: null, disputeResolution: null, serviceChanges: null, revisionNotice: null,
  },
};
export function contactHref(config: PublicLegalConfig = publicLegalConfig): string | undefined {
  const email = config.fields.contactEmail?.trim();
  return email && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email) ? `mailto:${email}` : undefined;
}
export function canIndexPublicPages(config: PublicLegalConfig = publicLegalConfig): boolean {
  return config.publicationStatus === 'published' && Boolean(contactHref(config)) &&
    Object.values(config.fields).every(value => Boolean(value?.trim()) && !/未確定|未設定|TODO|TBD|placeholder/i.test(value!));
}
