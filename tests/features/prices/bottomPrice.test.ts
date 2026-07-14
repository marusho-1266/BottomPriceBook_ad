import { describe, expect, it } from 'vitest';
import {
  bottomPrice,
  bottomPricesByStore,
  rankAllRecordsByUnitPrice,
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

describe('rankAllRecordsByUnitPrice(カテゴリ内の全記録ランキング)', () => {
  it('商品へ集約せず全記録を単価の安い順に並べる(同一商品が複数回登場する)', () => {
    const products = [
      { id: 'p1', name: 'キュキュット 240ml' },
      { id: 'p2', name: 'ジョイ 300ml' },
    ];
    const records = [
      record({ id: 'a', productId: 'p1', price: 158, quantity: 240, unit: 'ml' }), // 0.658
      record({ id: 'b', productId: 'p1', price: 120, quantity: 240, unit: 'ml' }), // 0.5
      record({ id: 'c', productId: 'p2', price: 180, quantity: 300, unit: 'ml' }), // 0.6
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'ml', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['b', 'c', 'a']);
    expect(ranking.map((r) => r.product.id)).toEqual(['p1', 'p2', 'p1']);
    expect(ranking[0].unitPrice).toBeCloseTo(0.5);
  });

  it('kg / L 表記の記録も基準単位に換算して順位付けする', () => {
    const products = [{ id: 'p1', name: '洗剤' }];
    const records = [
      record({ id: 'small', productId: 'p1', price: 158, quantity: 240, unit: 'ml' }), // 0.658
      record({ id: 'big', productId: 'p1', price: 598, quantity: 1.2, unit: 'L' }), // 0.498
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'ml', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['big', 'small']);
    expect(ranking[0].unitPrice).toBeCloseTo(598 / 1200);
  });

  it('対象期間外の記録は含めない', () => {
    const products = [{ id: 'p1', name: 'A' }];
    const records = [
      record({ id: 'old', productId: 'p1', recordedAt: new Date('2025-12-31') }),
      record({ id: 'recent', productId: 'p1', recordedAt: new Date('2026-07-01') }),
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'g', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['recent']);
  });

  it('特売記録も除外せずに含める', () => {
    const products = [{ id: 'p1', name: 'A' }];
    const records = [
      record({ id: 'sale', productId: 'p1', price: 80, isSale: true }),
      record({ id: 'regular', productId: 'p1', price: 100 }),
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'g', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['sale', 'regular']);
  });

  it('単価換算できない記録(単位不整合)は unitPrice = null として末尾に置く', () => {
    const products = [{ id: 'p1', name: 'A' }];
    const records = [
      record({ id: 'broken', productId: 'p1', price: 10, unit: 'ml' }), // g カテゴリに ml
      record({ id: 'ok', productId: 'p1', price: 100 }),
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'g', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['ok', 'broken']);
    expect(ranking[1].unitPrice).toBeNull();
  });

  it('同一単価は記録日の新しい順に並べる', () => {
    const products = [{ id: 'p1', name: 'A' }];
    const records = [
      record({ id: 'older', productId: 'p1', recordedAt: new Date('2026-06-01') }),
      record({ id: 'newer', productId: 'p1', recordedAt: new Date('2026-07-01') }),
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'g', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['newer', 'older']);
  });

  it('カテゴリ外の商品の記録は含めない', () => {
    const products = [{ id: 'p1', name: 'A' }];
    const records = [
      record({ id: 'in', productId: 'p1' }),
      record({ id: 'out', productId: 'p-other' }),
    ];
    const ranking = rankAllRecordsByUnitPrice(products, records, 'g', {
      windowMonths: 6,
      now: NOW,
    });
    expect(ranking.map((r) => r.record.id)).toEqual(['in']);
  });

  it('記録がなければ空配列を返す', () => {
    expect(
      rankAllRecordsByUnitPrice([{ id: 'p1', name: 'A' }], [], 'g', {
        windowMonths: 6,
        now: NOW,
      }),
    ).toEqual([]);
  });
});
