import { Timestamp, addDoc, collection, deleteDoc, doc, query, updateDoc } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { trackEvent } from '../../lib/analytics';
import { useCollection } from '../../lib/firestoreHooks';
import { useBook } from '../books/BookProvider';
import type { PriceRecord } from '../../types/models';

export interface PriceRecordDraft {
  productId: string;
  storeId: string;
  price: number;
  quantity: number;
  unit: string;
  isSale: boolean;
  recordedAt: Date;
}

export function addPriceRecord(bookId: string, draft: PriceRecordDraft): Promise<unknown> {
  if (draft.price <= 0 || draft.quantity <= 0) {
    return Promise.reject(new Error('price and quantity must be positive'));
  }
  return addDoc(collection(db, 'books', bookId, 'priceRecords'), {
    ...draft,
    recordedAt: Timestamp.fromDate(draft.recordedAt),
  }).then((result) => {
    void trackEvent('record_price', { isSale: draft.isSale });
    return result;
  });
}

export function updatePriceRecord(
  bookId: string,
  recordId: string,
  patch: Partial<Omit<PriceRecordDraft, 'recordedAt'>> & { recordedAt?: Date },
): Promise<void> {
  if ((patch.price !== undefined && patch.price <= 0) ||
      (patch.quantity !== undefined && patch.quantity <= 0)) {
    return Promise.reject(new Error('price and quantity must be positive'));
  }
  const { recordedAt, ...rest } = patch;
  return updateDoc(doc(db, 'books', bookId, 'priceRecords', recordId), {
    ...rest,
    ...(recordedAt ? { recordedAt: Timestamp.fromDate(recordedAt) } : {}),
  });
}

export function deletePriceRecord(bookId: string, recordId: string): Promise<void> {
  return deleteDoc(doc(db, 'books', bookId, 'priceRecords', recordId));
}

/** book 内の全価格記録を購読する(底値算出・参照カウントに使用) */
export function usePriceRecords() {
  const { bookId } = useBook();
  const recordsQuery = useMemo(() => query(collection(db, 'books', bookId, 'priceRecords')), [bookId]);
  return useCollection<PriceRecord>(recordsQuery);
}
