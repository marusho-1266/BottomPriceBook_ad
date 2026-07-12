import { describe, expect, it } from 'vitest';
import {
  bottomPrice,
  bottomPricesByStore,
  rankByUnitPrice,
} from '../../../src/features/prices/bottomPrice';

const NOW = new Date('2026-07-12T00:00:00');

function record(over: Partial<Parameters<typeof bottomPrice>[0][number]> = {}) {
  return {
    id: 'r',
    productId: 'p1',
    storeId: 's1',
    price: 100,
    quantity: 100,
    unit: 'g',
    isSale: false,
    recordedAt: new Date('2026-07-01'),
    ...over,
  };
}

describe('bottomPrice(特売込み)', () => {
  it('期間内の最安単価の記録を底値として返す', () => {
    const records = [
      record({ id: 'a', price: 200 }),
      record({ id: 'b', price: 150 }),
      record({ id: 'c', price: 180 }),
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 6, now: NOW });
    expect(result?.record.id).toBe('b');
    expect(result?.unitPrice).toBeCloseTo(1.5);
  });

  it('内容量が違う記録は単価で比較する(総額最安 ≠ 底値)', () => {
    const records = [
      record({ id: 'small', price: 100, quantity: 100 }), // 1.0 円/g
      record({ id: 'big', price: 150, quantity: 200 }), // 0.75 円/g ← 底値
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 6, now: NOW });
    expect(result?.record.id).toBe('big');
  });

  it('kg 表記の記録も g に換算して比較する', () => {
    const records = [
      record({ id: 'gram', price: 100, quantity: 100, unit: 'g' }), // 1.0 円/g
      record({ id: 'kilo', price: 1980, quantity: 5, unit: 'kg' }), // 0.396 円/g ← 底値
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 6, now: NOW });
    expect(result?.record.id).toBe('kilo');
    expect(result?.unitPrice).toBeCloseTo(0.396);
  });

  it('期間外の記録は底値に含めない', () => {
    const records = [
      record({ id: 'old', price: 50, recordedAt: new Date('2025-12-31') }), // 6ヶ月より前
      record({ id: 'recent', price: 150, recordedAt: new Date('2026-07-01') }),
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 6, now: NOW });
    expect(result?.record.id).toBe('recent');
  });

  it('windowMonths = 0 は全期間を対象にする', () => {
    const records = [
      record({ id: 'old', price: 50, recordedAt: new Date('2020-01-01') }),
      record({ id: 'recent', price: 150 }),
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 0, now: NOW });
    expect(result?.record.id).toBe('old');
  });

  it('記録がなければ null', () => {
    expect(bottomPrice([], 'g', { windowMonths: 6, now: NOW })).toBeNull();
  });

  it('Firestore Timestamp(toDate を持つ値)も扱える', () => {
    const records = [
      record({ id: 'ts', recordedAt: { toDate: () => new Date('2026-07-01') } }),
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 6, now: NOW });
    expect(result?.record.id).toBe('ts');
  });
});

describe('bottomPrice(通常のみ)', () => {
  it('excludeSale で特売記録を除いた底値を返す', () => {
    const records = [
      record({ id: 'sale', price: 100, isSale: true }),
      record({ id: 'regular', price: 150 }),
    ];
    const result = bottomPrice(records, 'g', { windowMonths: 6, now: NOW, excludeSale: true });
    expect(result?.record.id).toBe('regular');
  });

  it('特売記録しかない場合は null(L-6)', () => {
    const records = [record({ id: 'sale', isSale: true })];
    expect(bottomPrice(records, 'g', { windowMonths: 6, now: NOW, excludeSale: true })).toBeNull();
  });
});

describe('bottomPricesByStore', () => {
  it('店舗ごとの底値を返す', () => {
    const records = [
      record({ id: 'a', storeId: 's1', price: 100 }),
      record({ id: 'b', storeId: 's1', price: 90 }),
      record({ id: 'c', storeId: 's2', price: 120 }),
    ];
    const byStore = bottomPricesByStore(records, 'g', { windowMonths: 6, now: NOW });
    expect(byStore.get('s1')?.record.id).toBe('b');
    expect(byStore.get('s2')?.record.id).toBe('c');
  });
});

describe('rankByUnitPrice(カテゴリ内比較)', () => {
  it('商品横断で基準単位あたり単価の安い順に並べる', () => {
    const products = [
      { id: 'p1', name: 'キュキュット 240ml', categoryId: 'detergent' },
      { id: 'p2', name: 'ジョイ 300ml', categoryId: 'detergent' },
      { id: 'p3', name: '大容量 1.2L', categoryId: 'detergent' },
    ];
    const records = [
      record({ id: 'a', productId: 'p1', price: 158, quantity: 240, unit: 'ml' }), // 0.658
      record({ id: 'b', productId: 'p2', price: 208, quantity: 300, unit: 'ml' }), // 0.693
      record({ id: 'c', productId: 'p3', price: 598, quantity: 1.2, unit: 'L' }), // 0.498
    ];
    const ranking = rankByUnitPrice(products, records, 'ml', { windowMonths: 6, now: NOW });
    expect(ranking.map((r) => r.product.id)).toEqual(['p3', 'p1', 'p2']);
    expect(ranking[0].best.unitPrice).toBeCloseTo(598 / 1200);
  });

  it('期間内に記録がない商品はランキングから除外する', () => {
    const products = [
      { id: 'p1', name: 'A', categoryId: 'c' },
      { id: 'p2', name: 'B', categoryId: 'c' },
    ];
    const records = [record({ id: 'a', productId: 'p1' })];
    const ranking = rankByUnitPrice(products, records, 'g', { windowMonths: 6, now: NOW });
    expect(ranking.map((r) => r.product.id)).toEqual(['p1']);
  });
});
