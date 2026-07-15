import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { chunk } from '../../lib/chunk';
import { relabelRecordToBaseUnit } from '../../lib/units';
import type { BaseUnit } from '../../types/models';

/** バッチ上限 500 に余裕を持たせる(L-5) */
const RECORDS_PER_BATCH = 450;

export type UpdateCategoryInput = {
  name: string;
  baseUnit: BaseUnit;
};

export type UpdateCategoryOptions = {
  previousBaseUnit: BaseUnit;
  productIds: string[];
};

/**
 * カテゴリの名称・基準単位を更新する。
 * baseUnit が変わり所属商品があるときは、配下 priceRecords を
 * 旧 baseUnit 正規化 → 新 baseUnit リラベルする(物理換算ではない)。
 */
export async function updateCategoryWithRecords(
  db: Firestore,
  bookId: string,
  categoryId: string,
  input: UpdateCategoryInput,
  options: UpdateCategoryOptions,
): Promise<void> {
  await updateDoc(doc(db, 'books', bookId, 'categories', categoryId), {
    name: input.name,
    baseUnit: input.baseUnit,
  });

  const baseUnitChanged = options.previousBaseUnit !== input.baseUnit;
  if (!baseUnitChanged || options.productIds.length === 0) {
    return;
  }

  const recordDocs = [];
  for (const productId of options.productIds) {
    const snapshot = await getDocs(
      query(collection(db, 'books', bookId, 'priceRecords'), where('productId', '==', productId)),
    );
    recordDocs.push(...snapshot.docs);
  }

  const batches = chunk(recordDocs, RECORDS_PER_BATCH);
  for (const docs of batches) {
    const batch = writeBatch(db);
    for (const recordDoc of docs) {
      const data = recordDoc.data() as { quantity: number; unit: string };
      const next = relabelRecordToBaseUnit(
        { quantity: data.quantity, unit: data.unit },
        options.previousBaseUnit,
        input.baseUnit,
      );
      batch.update(recordDoc.ref, { quantity: next.quantity, unit: next.unit });
    }
    await batch.commit();
  }
}
