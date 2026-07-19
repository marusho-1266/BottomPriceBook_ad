import { beforeEach, describe, expect, it, vi } from 'vitest';

const { batchCommit, batchSet, batchUpdate, deleteDoc, collection, doc, trackEvent, query, where, useCollection, useBook } =
  vi.hoisted(() => ({
    batchCommit: vi.fn(),
    batchSet: vi.fn(),
    batchUpdate: vi.fn(),
    deleteDoc: vi.fn(),
    collection: vi.fn(() => 'collectionRef'),
    doc: vi.fn(() => 'docRef'),
    trackEvent: vi.fn(),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    useCollection: vi.fn(() => ({ data: [], loading: false })),
    useBook: vi.fn(() => ({ bookId: 'book1' })),
  }));

vi.mock('../../../src/lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));
vi.mock('../../../src/lib/analytics', () => ({ trackEvent }));
vi.mock('../../../src/lib/firestoreHooks', () => ({ useCollection }));
vi.mock('../../../src/features/books/BookProvider', () => ({ useBook }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection,
    doc,
    deleteDoc,
    query,
    where,
    writeBatch: () => ({ set: batchSet, update: batchUpdate, commit: batchCommit }),
  };
});

import { renderHook } from '@testing-library/react';
import {
  addPriceRecord,
  updatePriceRecord,
  deletePriceRecord,
  usePriceRecords,
  useProductPriceRecords,
} from '../../../src/features/prices/api';

describe('addPriceRecord の trackEvent 連携', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('登録に成功したら record_price イベントを送る', async () => {
    batchCommit.mockResolvedValue(undefined);

    await addPriceRecord('book1', {
      productId: 'p1',
      storeId: 's1',
      price: 100,
      quantity: 1,
      unit: '個',
      isSale: false,
      recordedAt: new Date('2026-07-01'),
    });

    expect(trackEvent).toHaveBeenCalledWith('record_price', { isSale: false });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(batchSet).toHaveBeenCalledTimes(2); // 記録本体 + rateLimits
  });

  it('バリデーションで弾かれたら record_price イベントを送らない', async () => {
    await expect(
      addPriceRecord('book1', {
        productId: 'p1',
        storeId: 's1',
        price: 0,
        quantity: 1,
        unit: '個',
        isSale: false,
        recordedAt: new Date('2026-07-01'),
      }),
    ).rejects.toThrow();

    expect(batchCommit).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('Firestore への書き込みが失敗したら record_price イベントを送らない', async () => {
    batchCommit.mockRejectedValue(new Error('write failed'));

    await expect(
      addPriceRecord('book1', {
        productId: 'p1',
        storeId: 's1',
        price: 100,
        quantity: 1,
        unit: '個',
        isSale: false,
        recordedAt: new Date('2026-07-01'),
      }),
    ).rejects.toThrow('write failed');

    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('updatePriceRecord / deletePriceRecord は計測イベントを送らない', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updatePriceRecord は trackEvent を呼ばない', async () => {
    batchCommit.mockResolvedValue(undefined);
    await updatePriceRecord('book1', 'rec1', { price: 200 });
    expect(trackEvent).not.toHaveBeenCalled();
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchSet).toHaveBeenCalledTimes(1); // rateLimits のみ
  });

  it('deletePriceRecord は trackEvent を呼ばない', async () => {
    deleteDoc.mockResolvedValue(undefined);
    await deletePriceRecord('book1', 'rec1');
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('usePriceRecords のクエリ絞り込み(Issue #17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('options を渡さない場合は期間で絞り込まない(全件購読)', () => {
    renderHook(() => usePriceRecords());
    expect(where).not.toHaveBeenCalled();
  });

  it('windowMonths が 0(全期間)の場合は期間で絞り込まない', () => {
    renderHook(() => usePriceRecords({ windowMonths: 0, now: new Date('2026-07-20') }));
    expect(where).not.toHaveBeenCalled();
  });

  it('windowMonths > 0 の場合は recordedAt >= カットオフ で絞り込む', () => {
    const now = new Date('2026-07-20');
    renderHook(() => usePriceRecords({ windowMonths: 6, now }));
    expect(where).toHaveBeenCalledWith('recordedAt', '>=', expect.anything());
    const cutoff = new Date('2026-07-20');
    cutoff.setMonth(cutoff.getMonth() - 6);
    const [, , timestampArg] = where.mock.calls[0];
    expect((timestampArg as { toDate(): Date }).toDate().getTime()).toBe(cutoff.getTime());
  });
});

describe('useProductPriceRecords(Issue #17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('productId で絞り込むクエリを発行する', () => {
    renderHook(() => useProductPriceRecords('p1'));
    expect(where).toHaveBeenCalledWith('productId', '==', 'p1');
  });
});
