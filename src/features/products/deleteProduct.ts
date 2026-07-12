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

/** バッチ上限 500 のうち、商品本体の削除分を残して記録を消す */
const RECORDS_PER_BATCH = 450;

/**
 * 商品と配下の価格記録をまとめて削除する(H-2)。
 * 記録が多い場合は分割バッチで削除する(L-5)。途中失敗で孤児が残っても
 * どの画面からも参照されないため実害は小さい。
 */
export async function deleteProductWithRecords(
  db: Firestore,
  bookId: string,
  productId: string,
): Promise<void> {
  const recordsSnapshot = await getDocs(
    query(collection(db, 'books', bookId, 'priceRecords'), where('productId', '==', productId)),
  );

  const batches = chunk(recordsSnapshot.docs, RECORDS_PER_BATCH);
  for (const docs of batches) {
    const batch = writeBatch(db);
    for (const recordDoc of docs) {
      batch.delete(recordDoc.ref);
    }
    await batch.commit();
  }

  const finalBatch = writeBatch(db);
  finalBatch.delete(doc(db, 'books', bookId, 'products', productId));
  await finalBatch.commit();
}
