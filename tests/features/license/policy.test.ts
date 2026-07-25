import { describe, expect, it } from 'vitest';
import {
  FREE_PRODUCT_LIMIT,
  FREE_STORE_LIMIT,
  canAddProduct,
  canAddStore,
  canExportCsv,
  canInvite,
  remainingProductSlots,
  remainingStoreSlots,
  resolveLicenseStatus,
} from '../../../src/features/license/policy';

describe('resolveLicenseStatus', () => {
  it('lifetime はそのまま返す', () => {
    expect(resolveLicenseStatus({ status: 'lifetime' })).toBe('lifetime');
  });

  it('free はそのまま返す', () => {
    expect(resolveLicenseStatus({ status: 'free' })).toBe('free');
  });

  it('null / undefined / 欠落 status は free', () => {
    expect(resolveLicenseStatus(null)).toBe('free');
    expect(resolveLicenseStatus(undefined)).toBe('free');
    expect(resolveLicenseStatus({})).toBe('free');
    expect(resolveLicenseStatus({ status: undefined })).toBe('free');
  });

  it('未知の status 文字列は free（安全側）', () => {
    expect(resolveLicenseStatus({ status: 'premium' as 'free' })).toBe('free');
  });
});

describe('canAddProduct / remainingProductSlots', () => {
  it('lifetime は件数に関わらず追加可・残りは null（無制限）', () => {
    expect(canAddProduct('lifetime', 0)).toBe(true);
    expect(canAddProduct('lifetime', FREE_PRODUCT_LIMIT)).toBe(true);
    expect(canAddProduct('lifetime', FREE_PRODUCT_LIMIT + 5)).toBe(true);
    expect(remainingProductSlots('lifetime', 10)).toBeNull();
  });

  it('free は上限未満のみ追加可', () => {
    expect(canAddProduct('free', 0)).toBe(true);
    expect(canAddProduct('free', FREE_PRODUCT_LIMIT - 1)).toBe(true);
    expect(canAddProduct('free', FREE_PRODUCT_LIMIT)).toBe(false);
    expect(canAddProduct('free', FREE_PRODUCT_LIMIT + 3)).toBe(false);
  });

  it('free の残り枠は max(0, limit - count)', () => {
    expect(remainingProductSlots('free', 0)).toBe(FREE_PRODUCT_LIMIT);
    expect(remainingProductSlots('free', 12)).toBe(FREE_PRODUCT_LIMIT - 12);
    expect(remainingProductSlots('free', FREE_PRODUCT_LIMIT)).toBe(0);
    expect(remainingProductSlots('free', FREE_PRODUCT_LIMIT + 5)).toBe(0);
  });
});

describe('canAddStore / remainingStoreSlots', () => {
  it('lifetime は無制限', () => {
    expect(canAddStore('lifetime', FREE_STORE_LIMIT + 1)).toBe(true);
    expect(remainingStoreSlots('lifetime', 1)).toBeNull();
  });

  it('free は上限 3', () => {
    expect(canAddStore('free', 2)).toBe(true);
    expect(canAddStore('free', FREE_STORE_LIMIT)).toBe(false);
    expect(remainingStoreSlots('free', 1)).toBe(2);
    expect(remainingStoreSlots('free', 5)).toBe(0);
  });
});

describe('canInvite / canExportCsv', () => {
  it('lifetime のみ招待・CSV 可', () => {
    expect(canInvite('lifetime')).toBe(true);
    expect(canExportCsv('lifetime')).toBe(true);
    expect(canInvite('free')).toBe(false);
    expect(canExportCsv('free')).toBe(false);
  });
});

describe('limits', () => {
  it('無料枠定数は仕様どおり', () => {
    expect(FREE_PRODUCT_LIMIT).toBe(20);
    expect(FREE_STORE_LIMIT).toBe(3);
  });
});
