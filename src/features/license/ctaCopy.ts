/**
 * 帳の実効ライセンス(ownerLicense)でゲートが掛かったときの説明文。
 * プラン名(accountLicense)と混同しないよう、オーナー／ゲストで文言を分ける。
 */
export function ownerLimitCta(
  kind: 'product' | 'store' | 'csv' | 'invite',
  isOwner: boolean,
): { message: string; showPurchaseHint: boolean } {
  if (!isOwner) {
    const byKind = {
      product: 'この帳のオーナーが無料プランのため、これ以上商品を追加できません',
      store: 'この帳のオーナーが無料プランのため、これ以上店舗を追加できません',
      csv: 'この帳のオーナーが無料プランのため CSV は使えません',
      invite: '買い切り後に招待できます', // 招待発行 UI はオーナーのみ
    } as const;
    return { message: byKind[kind], showPurchaseHint: false };
  }

  const byKind = {
    product: '商品の上限に達しました。買い切りで無制限になります',
    store: '店舗の上限に達しました。買い切りで無制限になります',
    csv: '買い切り後に CSV エクスポートできます',
    invite: '買い切り後に招待できます',
  } as const;
  return { message: byKind[kind], showPurchaseHint: true };
}
