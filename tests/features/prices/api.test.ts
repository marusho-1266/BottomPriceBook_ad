import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addDoc, updateDoc, deleteDoc, collection, doc, trackEvent } = vi.hoisted(() => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(() => 'collectionRef'),
  doc: vi.fn(() => 'docRef'),
  trackEvent: vi.fn(),
}));

vi.mock('../../../src/lib/firebase', () => ({ db: {} }));
vi.mock('../../../src/lib/analytics', () => ({ trackEvent }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return { ...actual, addDoc, updateDoc, deleteDoc, collection, doc };
});

import { addPriceRecord, updatePriceRecord, deletePriceRecord } from '../../../src/features/prices/api';

describe('addPriceRecord の trackEvent 連携', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('登録に成功したら record_price イベントを送る', async () => {
    addDoc.mockResolvedValue({ id: 'new-id' });

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

    expect(addDoc).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('Firestore への書き込みが失敗したら record_price イベントを送らない', async () => {
    addDoc.mockRejectedValue(new Error('write failed'));

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
    updateDoc.mockResolvedValue(undefined);
    await updatePriceRecord('book1', 'rec1', { price: 200 });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('deletePriceRecord は trackEvent を呼ばない', async () => {
    deleteDoc.mockResolvedValue(undefined);
    await deletePriceRecord('book1', 'rec1');
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
