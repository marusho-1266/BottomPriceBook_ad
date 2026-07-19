import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { chunk } from '../../lib/chunk';
import { withRateLimit } from '../../lib/rateLimit';
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
 * 書込レート制限(Issue #16)を満たすため、カテゴリ更新と最初のリラベル分は
 * 同一バッチにまとめる。バッチが複数必要な場合(記録数が多い)は、
 * レート制限の間隔(1 秒)を空けてから次のバッチをコミットする。
 */
export async function updateCategoryWithRecords(
  db: Firestore,
  bookId: string,
  categoryId: string,
  uid: string,
  input: UpdateCategoryInput,
  options: UpdateCategoryOptions,
): Promise<void> {
  const categoryRef = doc(db, 'books', bookId, 'categories', categoryId);
  const baseUnitChanged = options.previousBaseUnit !== input.baseUnit;

  if (!baseUnitChanged || options.productIds.length === 0) {
    const batch = writeBatch(db);
    batch.update(categoryRef, { name: input.name, baseUnit: input.baseUnit });
    withRateLimit(batch, bookId, uid);
    await batch.commit();
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
  for (let i = 0; i < batches.length; i += 1) {
    if (i > 0) {
      // レート制限(1 秒間隔)を満たすため、2 バッチ目以降は前回のコミットから間隔を空ける
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
    const batch = writeBatch(db);
    if (i === 0) {
      batch.update(categoryRef, { name: input.name, baseUnit: input.baseUnit });
    }
    for (const recordDoc of batches[i]) {
      const data = recordDoc.data() as { quantity: number; unit: string };
      const next = relabelRecordToBaseUnit(
        { quantity: data.quantity, unit: data.unit },
        options.previousBaseUnit,
        input.baseUnit,
      );
      batch.update(recordDoc.ref, { quantity: next.quantity, unit: next.unit });
    }
    withRateLimit(batch, bookId, uid);
    await batch.commit();
  }
}
