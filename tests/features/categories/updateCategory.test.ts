import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocs, writeBatch, doc, collection, query, where, serverTimestamp } = vi.hoisted(() => ({
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
  serverTimestamp: vi.fn(() => 'server-timestamp-sentinel'),
}));

vi.mock('firebase/firestore', () => ({
  getDocs,
  writeBatch,
  doc,
  collection,
  query,
  where,
  serverTimestamp,
}));
vi.mock('../../../src/lib/firebase', () => ({ db: {} }));

import { updateCategoryWithRecords } from '../../../src/features/categories/updateCategory';

function makeRecordDoc(id: string, quantity: number, unit: string) {
  return {
    id,
    ref: { id },
    data: () => ({ quantity, unit, productId: 'p1' }),
  };
}

describe('updateCategoryWithRecords', () => {
  const db = {} as never;
  const UID = 'uid-1';
  let batchUpdate: ReturnType<typeof vi.fn>;
  let batchSet: ReturnType<typeof vi.fn>;
  let batchCommit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    batchUpdate = vi.fn();
    batchSet = vi.fn();
    batchCommit = vi.fn().mockResolvedValue(undefined);
    writeBatch.mockReturnValue({ update: batchUpdate, set: batchSet, commit: batchCommit });
  });

  it('名称のみ変更(baseUnit 同じ)では価格記録を更新しない(rateLimits は更新)', async () => {
    await updateCategoryWithRecords(
      db,
      'b1',
      'food',
      UID,
      { name: '食料品', baseUnit: 'g' },
      { previousBaseUnit: 'g', productIds: ['p1'] },
    );

    expect(batchUpdate).toHaveBeenCalledWith(
      { path: 'books/b1/categories/food' },
      { name: '食料品', baseUnit: 'g' },
    );
    expect(batchSet).toHaveBeenCalledWith(
      { path: 'books/b1/rateLimits/uid-1' },
      { lastWriteAt: 'server-timestamp-sentinel' },
    );
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('商品 0 件なら baseUnit 変更でも価格記録を更新しない', async () => {
    await updateCategoryWithRecords(
      db,
      'b1',
      'food',
      UID,
      { name: '食品', baseUnit: 'ml' },
      { previousBaseUnit: 'g', productIds: [] },
    );

    expect(batchUpdate).toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('baseUnit 変更時は配下記録を正規化してリラベルし、カテゴリ更新と同一バッチにまとめる', async () => {
    getDocs.mockResolvedValue({
      docs: [makeRecordDoc('r1', 2, 'kg'), makeRecordDoc('r2', 100, 'g')],
    });

    await updateCategoryWithRecords(
      db,
      'b1',
      'food',
      UID,
      { name: '食品', baseUnit: 'ml' },
      { previousBaseUnit: 'g', productIds: ['p1'] },
    );

    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledWith(
      { path: 'books/b1/categories/food' },
      { name: '食品', baseUnit: 'ml' },
    );
    expect(batchUpdate).toHaveBeenCalledWith({ id: 'r1' }, { quantity: 2000, unit: 'ml' });
    expect(batchUpdate).toHaveBeenCalledWith({ id: 'r2' }, { quantity: 100, unit: 'ml' });
    expect(batchSet).toHaveBeenCalledTimes(1); // rateLimits のみ(カテゴリ更新も同バッチ)
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });
});
