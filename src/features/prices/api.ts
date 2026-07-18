import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  query,
  writeBatch,
} from 'firebase/firestore';
import { useMemo } from 'react';
import { auth, db } from '../../lib/firebase';
import { trackEvent } from '../../lib/analytics';
import { useCollection } from '../../lib/firestoreHooks';
import { withRateLimit } from '../../lib/rateLimit';
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

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('not authenticated');
  }
  return uid;
}

export async function addPriceRecord(bookId: string, draft: PriceRecordDraft): Promise<unknown> {
  if (draft.price <= 0 || draft.quantity <= 0) {
    return Promise.reject(new Error('price and quantity must be positive'));
  }
  const uid = requireUid();
  const ref = doc(collection(db, 'books', bookId, 'priceRecords'));
  const batch = writeBatch(db);
  batch.set(ref, { ...draft, recordedAt: Timestamp.fromDate(draft.recordedAt) });
  withRateLimit(batch, bookId, uid);
  await batch.commit();
  void trackEvent('record_price', { isSale: draft.isSale });
  return ref;
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
  const uid = requireUid();
  const { recordedAt, ...rest } = patch;
  const batch = writeBatch(db);
  batch.update(doc(db, 'books', bookId, 'priceRecords', recordId), {
    ...rest,
    ...(recordedAt ? { recordedAt: Timestamp.fromDate(recordedAt) } : {}),
  });
  withRateLimit(batch, bookId, uid);
  return batch.commit();
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
