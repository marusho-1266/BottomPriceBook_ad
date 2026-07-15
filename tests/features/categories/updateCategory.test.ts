import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateDoc,
  getDocs,
  writeBatch,
  doc,
  collection,
  query,
  where,
} = vi.hoisted(() => ({
  updateDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  updateDoc,
  getDocs,
  writeBatch,
  doc,
  collection,
  query,
  where,
}));

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
  let batchUpdate: ReturnType<typeof vi.fn>;
  let batchCommit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    batchUpdate = vi.fn();
    batchCommit = vi.fn().mockResolvedValue(undefined);
    writeBatch.mockReturnValue({ update: batchUpdate, commit: batchCommit });
  });

  it('名称のみ変更(baseUnit 同じ)では価格記録を更新しない', async () => {
    await updateCategoryWithRecords(
      db,
      'b1',
      'food',
      { name: '食料品', baseUnit: 'g' },
      { previousBaseUnit: 'g', productIds: ['p1'] },
    );

    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'books/b1/categories/food' },
      { name: '食料品', baseUnit: 'g' },
    );
    expect(getDocs).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('商品 0 件なら baseUnit 変更でも価格記録を更新しない', async () => {
    await updateCategoryWithRecords(
      db,
      'b1',
      'food',
      { name: '食品', baseUnit: 'ml' },
      { previousBaseUnit: 'g', productIds: [] },
    );

    expect(updateDoc).toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('baseUnit 変更時は配下記録を正規化してリラベルする', async () => {
    getDocs.mockResolvedValue({
      docs: [makeRecordDoc('r1', 2, 'kg'), makeRecordDoc('r2', 100, 'g')],
    });

    await updateCategoryWithRecords(
      db,
      'b1',
      'food',
      { name: '食品', baseUnit: 'ml' },
      { previousBaseUnit: 'g', productIds: ['p1'] },
    );

    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledWith({ id: 'r1' }, { quantity: 2000, unit: 'ml' });
    expect(batchUpdate).toHaveBeenCalledWith({ id: 'r2' }, { quantity: 100, unit: 'ml' });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });
});
