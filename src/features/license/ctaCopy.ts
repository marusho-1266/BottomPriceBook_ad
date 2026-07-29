/**
 * 帳の実効ライセンス(ownerLicense)でゲートが掛かったときの説明文。
 * プラン名(accountLicense)と混同しないよう、オーナー／ゲストで文言を分ける。
 */
export type LicenseCtaKind = 'product' | 'store' | 'csv' | 'invite';

/** 招待発行 UI はオーナーにしか出ないため、ゲスト向け文言を持たない */
type GuestCtaKind = Exclude<LicenseCtaKind, 'invite'>;

const OWNER_COPY: Record<LicenseCtaKind, string> = {
  product: '商品の上限に達しました。買い切りで無制限になります',
  store: '店舗の上限に達しました。買い切りで無制限になります',
  csv: '買い切り後に CSV エクスポートできます',
  invite: '買い切り後に招待できます',
};

// ゲストは購入しても解決しないため、購入誘導の副文は出さない(showPurchaseHint: false)
const GUEST_COPY: Record<GuestCtaKind, string> = {
  product: 'この帳のオーナーが無料プランのため、これ以上商品を追加できません',
  store: 'この帳のオーナーが無料プランのため、これ以上店舗を追加できません',
  csv: 'この帳のオーナーが無料プランのため CSV は使えません',
};

export function ownerLimitCta(
  kind: LicenseCtaKind,
  isOwner: boolean,
): { message: string; showPurchaseHint: boolean } {
  if (!isOwner && kind !== 'invite') {
    return { message: GUEST_COPY[kind], showPurchaseHint: false };
  }
  return { message: OWNER_COPY[kind], showPurchaseHint: true };
}
