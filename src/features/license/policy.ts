import type { LicenseStatus } from '../../types/models';

/** 無料プランの商品上限（オーナー帳ごと） */
export const FREE_PRODUCT_LIMIT = 20;

/** 無料プランの店舗上限（オーナー帳ごと） */
export const FREE_STORE_LIMIT = 3;

/**
 * license 欠落・未知 status は free（安全側）。
 * book.ownerLicenseStatus や users.license のどちらからでも使える。
 */
export function resolveLicenseStatus(
  license: { status?: string } | null | undefined,
): LicenseStatus {
  return license?.status === 'lifetime' ? 'lifetime' : 'free';
}

/** 帳に対する権限は常にオーナーの license で決める */
export function canAddProduct(ownerLicense: LicenseStatus, productCount: number): boolean {
  if (ownerLicense === 'lifetime') return true;
  return productCount < FREE_PRODUCT_LIMIT;
}

export function canAddStore(ownerLicense: LicenseStatus, storeCount: number): boolean {
  if (ownerLicense === 'lifetime') return true;
  return storeCount < FREE_STORE_LIMIT;
}

export function canInvite(ownerLicense: LicenseStatus): boolean {
  return ownerLicense === 'lifetime';
}

export function canExportCsv(ownerLicense: LicenseStatus): boolean {
  return ownerLicense === 'lifetime';
}

/** lifetime は null（無制限表示用）。free は 0 以上の残り */
export function remainingProductSlots(
  ownerLicense: LicenseStatus,
  productCount: number,
): number | null {
  if (ownerLicense === 'lifetime') return null;
  return Math.max(0, FREE_PRODUCT_LIMIT - productCount);
}

export function remainingStoreSlots(
  ownerLicense: LicenseStatus,
  storeCount: number,
): number | null {
  if (ownerLicense === 'lifetime') return null;
  return Math.max(0, FREE_STORE_LIMIT - storeCount);
}
