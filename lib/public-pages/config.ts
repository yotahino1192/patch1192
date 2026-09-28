// Public, non-secret publication settings. Null is rendered explicitly, never as a fake contact.
export const publicService = { name: 'Mepamo', origin: 'https://mepamo.com' } as const;
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
    operatorName: "日野 陽太",
    contactEmail: "support@mepamo.com",
    legalAddress: null,
    serviceCountries: "日本のみ。",
    processingRegions: "Mepamoのデータは日本国外でも処理されます。Tursoの本番データベースは東京（AWS ap-northeast-1）に配置していますが、VercelのAPI処理は米国ワシントンD.C.地域（iad1 / us-east-1）で行います。Clerkの認証基盤は米国で運用され、各事業者の運用・サポート・再委託先による国外での取り扱いもあり得ます。OpenAIのプロジェクトはGlobal設定で、処理地域を日本に限定する契約・設定は確認していません。現在、本番のAI機能は停止中です。有効化後、必要な同意を得て送信する教材・質問等は、米国を含む日本国外で処理される可能性があります。東京のデータベース配置は、全サービスの保存・処理が日本国内で完結することを意味しません。",
    effectiveDate: null,
    retentionPolicy: "アカウント・プロフィール、教材・カード・学習履歴・保存された会話は、サービス提供のため保持し、アカウント削除処理で対象データを消去します。カードを通常の削除操作で非表示にしても、直ちに物理消去されるとは限りません。AIリクエストの再送用結果には利用期限がありますが、期限到来と同時の自動消去は保証していません。AIの二重実行防止、利用量・費用・予算管理の記録には、一律の自動消去期限を設けていません。AI送信同意の証跡は同意撤回だけでは消去されず、アカウント削除処理の対象になります。削除後も、不正な再利用の防止、削除処理の確認・再試行、AIの二重実行防止・費用確認に必要な最小限の識別情報や処理記録を残します。これらの残存記録にも現在は固定の自動消去期限がなく、完全な匿名情報とは扱いません。運用ログは障害・安全性の確認に使い、アプリの構造化ログには教材本文・認証情報等を記録しない設計です。ログの保持期間は保存先の設定に依存し、現時点で一律の期間を保証していません。バックアップは以下の別方針で扱います。",
    backupRetention: "バックアップは7日保持を基準とする方針です。期限を過ぎたバックアップの削除と、復旧時に削除済みデータを復活させないための削除記録の反映を整備・検証します。現在は初回の暗号化バックアップと復元確認が完了していますが、定期バックアップと期限消去は運用準備中です。7日後の自動消去や、アカウント削除と同時のバックアップ内データ消去を保証するものではありません。",
    deletionTiming: "削除依頼への一次対応は1営業日以内を目標とします。通常のアカウント削除は、アプリ内の本人確認済み削除手順をご利用ください。受付と削除完了は同時とは限らず、外部サービスや通信の状況により再試行が必要になる場合があります。削除完了の目標は本番環境で削除フローを検証した後に確定します。現時点では固定の完了期限を保証していません。削除後に残る最小限の記録とバックアップの扱いは、保持方針をご確認ください。",
    rightsProcedure: "データ確認・削除等のご相談はsupport@mepamo.comで受け付けます。通常のアカウント削除は、アプリ内の本人確認済み削除手順をご案内します。認証コード・パスワードはメールでは受け取りません。ログインできない場合は、個別に本人確認したうえで対応します。",
    supportResponse: "担当者の日野 陽太が平日に確認し、3営業日以内の一次回答を目標とします。解決期限を保証するものではありません。",
    eligibility: "日本にお住まいの、招待済みの18歳以上の方を対象とします。",
    contentRights: "利用者が入力・アップロードする教材その他のコンテンツについて、利用者が有する権利は利用者に留保されます。利用者は、アップロードおよび本サービスでの利用に必要な権利・許諾を有するものとします。Mepamoの運営者は、保存、表示、処理その他サービス提供に必要な範囲に限り、当該コンテンツを利用する許諾を受けます。これには、利用者から必要な同意を得た場合のAI提供事業者への送信を含みます。AI生成結果について、利用者による独占的な所有や完全な知的財産権の成立・帰属、第三者の権利を侵害しないことを保証しません。",
    commercialTerms: "現在のFree v1は無料です。有料プラン、アプリ内購入、定期課金は提供していません。この版には支払い、有料契約の解約、購入代金の返金の対象となる取引はありません。",
    liability: "AIが生成した内容には誤りや不足が含まれる場合があります。Mepamoは、内容の正確性、試験の結果、成績その他の学習成果を保証しません。本サービスは無料のTestFlightベータ版であり、停止、不具合、データの消失が生じる場合があります。重要な内容は元資料等と照合してご利用ください。運営者の責任は適用法令に従い、法令上免除・制限できない責任を除外するものではありません。この初期ベータ版では、契約上の金銭的な損害賠償上限を設けません。",
    governingLaw: "本規約には日本法を適用します。",
    disputeResolution: "本サービスに関する問題・紛争は、まずsupport@mepamo.comを通じて誠実に協議し、解決を図ります。協議で解決しない場合の裁判管轄は、適用法令の定めに従います。特定の裁判所を専属的合意管轄とは定めません。",
    serviceChanges: "重要なサービス変更、予定された中断またはサービス終了については、合理的に可能な限り事前にお知らせします。緊急対応、セキュリティ上の必要、障害、法令上の要請その他これらに類する事情により事前の通知が合理的に困難な場合は、その後、合理的に可能な限り速やかにお知らせします。ベータ版における通常の機能改善や軽微な変更には、固定の事前通知期間を設けません。",
    revisionNotice: "利用規約・プライバシーポリシーを変更した場合は、公開ページを更新します。招待テスターに影響する重要な変更は、原則として適用日の14日前までに個別のメールでお知らせします。法令上の要請や緊急の安全対策等によりこの期間を確保できない場合は、適用法令に従い、合理的に可能な限り速やかにお知らせします。AIへのデータ送信範囲の重要な変更など、改めて同意が必要な場合は、通知だけで代替せず、必要な同意を取得します。",
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
