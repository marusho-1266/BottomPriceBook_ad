import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { BottomResult } from '../../../src/features/prices/bottomPrice';
import { WEEK_MS, computeHomeSummary } from '../../../src/features/prices/homeSummary';
import type { PriceRecord, WithId } from '../../../src/types/models';

function record(
  id: string,
  recordedAt: Date,
  extras: Partial<WithId<PriceRecord>> = {},
): WithId<PriceRecord> {
  return {
    id,
    productId: 'p1',
    storeId: 's1',
    price: 100,
    quantity: 1,
    unit: '個',
    isSale: false,
    recordedAt: Timestamp.fromDate(recordedAt),
    ...extras,
  };
}

function bottom(recordId: string): BottomResult<WithId<PriceRecord>> {
  return {
    record: record(recordId, new Date()),
    unitPrice: 100,
  };
}

describe('computeHomeSummary', () => {
  const now = new Date('2026-07-23T12:00:00Z');

  it('登録商品数はそのまま返す', () => {
    const summary = computeHomeSummary(5, [], new Map(), now);
    expect(summary.productCount).toBe(5);
    expect(summary.weekRecordCount).toBe(0);
    expect(summary.bottomUpdatedCount).toBe(0);
  });

  it('直近 7 日以内の記録だけを今週の記録に数える', () => {
    const records = [
      record('r1', new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
      record('r2', new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
      record('r3', new Date(now.getTime() - WEEK_MS)),
      record('r4', new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)),
    ];
    const summary = computeHomeSummary(1, records, new Map(), now);
    // WEEK_MS ちょうどは < なので除外。8 日前も除外 → r1, r2 の 2 件
    expect(summary.weekRecordCount).toBe(2);
  });

  it('底値更新は今週記録のうち現行底値 record id と一致するものの件数', () => {
    const records = [
      record('r1', new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
      record('r2', new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
      record('r3', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
    ];
    const bottoms = new Map([
      ['p1', bottom('r1')],
      ['p2', bottom('r9')],
    ]);
    const summary = computeHomeSummary(2, records, bottoms, now);
    expect(summary.weekRecordCount).toBe(3);
    expect(summary.bottomUpdatedCount).toBe(1);
  });
});
